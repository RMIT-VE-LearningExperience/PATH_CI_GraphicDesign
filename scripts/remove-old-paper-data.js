// Usage (the cutoff date is required):
//   npm run remove-old-paper-data -- --before=2026-10-01            # dry run: lists what would be deleted
//   npm run remove-old-paper-data -- --before=2026-10-01 --apply    # deletes it
//
// --before=YYYY-MM-DD: only items CREATED BEFORE this date are treated as old Papers. New Products
// also live under level_2, so pick a date after the last Paper was created and before the first
// new Product was. The dry run prints each item's creation date to help you choose.
//
// The hierarchy used to be Printer > Paper > Product, with Papers stored under level_2.
// It is now Printer > Product, and Products reuse the id level_2, so old Paper items would
// show up as Products. This removes the old Paper data:
//   - items under items/level_2 created before the cutoff   (the old Papers)
//   - printer links that point at those Papers, and the Paper > Product links beneath them
//   - soft-deleted Papers (deleted before the cutoff) in the deleted-items bin
// It does NOT touch Printers (level_1), the old Products (level_3, which simply become
// unreachable), steps, or any files in Storage.

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { readFileSync } = require("fs");

const apply = process.argv.includes("--apply");
const beforeArg = process.argv.find((a) => a.startsWith("--before="))?.slice("--before=".length);
const cutoff = beforeArg && /^\d{4}-\d{2}-\d{2}$/.test(beforeArg) ? new Date(`${beforeArg}T00:00:00`) : null;
if (!cutoff || Number.isNaN(cutoff.getTime())) {
  console.error("Pass a cutoff date, e.g. --before=2026-10-01 (only items created before it are removed).");
  process.exit(1);
}

function createdAt(doc) {
  const value = doc.data().createdAt;
  return value && typeof value.toDate === "function" ? value.toDate() : null;
}

function loadCredential() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return cert({ projectId, clientEmail, privateKey });
  }

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    try {
      return cert(JSON.parse(readFileSync(credPath, "utf-8")));
    } catch (err) {
      console.error("Failed to load service account from GOOGLE_APPLICATION_CREDENTIALS:", err.message);
      process.exit(1);
    }
  }

  console.error(
    "No credentials found. Set FIREBASE_PRIVATE_KEY (+ FIREBASE_PROJECT_ID and FIREBASE_CLIENT_EMAIL)\n" +
    "or GOOGLE_APPLICATION_CREDENTIALS in .env.local."
  );
  process.exit(1);
}

const app = initializeApp({ credential: loadCredential() });
const databaseId = process.env.FIREBASE_DATABASE_ID || "(default)";
if (databaseId === "(default)") {
  console.error('FIREBASE_DATABASE_ID is not set. Refusing to run against the "(default)" database.');
  process.exit(1);
}
const db = getFirestore(app, databaseId);

async function main() {
  console.log(`\n${apply ? "DELETING" : "Dry run for"} old Paper data in "${databaseId}"\n`);

  const toDelete = []; // { ref, label }

  // 1. Old Papers: items under level_2 created before the cutoff. Items with no creation date are
  //    kept, because they cannot be told apart from new Products.
  const allLevel2 = await db.collection("items").doc("level_2").collection("items").get();
  const kept = [];
  const papers = [];
  for (const d of allLevel2.docs) {
    const created = createdAt(d);
    (created && created < cutoff ? papers : kept).push({ doc: d, created });
  }
  const paperIds = new Set(papers.map((p) => p.doc.id));
  papers.forEach(({ doc, created }) => toDelete.push({ ref: doc.ref, label: `Paper item: ${doc.data().name ?? doc.id} (created ${created.toISOString().slice(0, 10)})` }));

  // 2. Links: printer > paper, and the paper > product links beneath them (composite keys contain ":")
  const children = await db.collectionGroup("children").get();
  for (const doc of children.docs) {
    const parts = doc.ref.path.split("/"); // links/{parentKey}/children/{childId}
    if (parts[0] !== "links") continue;
    const parentKey = parts[1];
    const isCompositeKey = parentKey.includes(":");
    const pointsAtPaper = doc.data().childLevelId === "level_2" && !isCompositeKey && paperIds.has(doc.id);
    // A composite key is "printerId:paperId": it belongs to the old structure if that paper is being removed
    const beneathPaper = isCompositeKey && paperIds.has(parentKey.split(":").pop());
    if (beneathPaper || pointsAtPaper) {
      toDelete.push({ ref: doc.ref, label: `Link: ${parentKey} -> ${doc.id}${isCompositeKey ? " (paper > product)" : " (printer > paper)"}` });
    }
  }

  // 3. Soft-deleted Papers
  const bin = await db.collection("deletedItems").where("type", "==", "level_2").get();
  bin.docs
    .filter((d) => {
      const deleted = d.data().deletedAt;
      const when = deleted && typeof deleted.toDate === "function" ? deleted.toDate() : null;
      return when && when < cutoff;
    })
    .forEach((d) => toDelete.push({ ref: d.ref, label: `Deleted-items bin: ${d.data().name ?? d.id}` }));

  const level3 = await db.collection("items").doc("level_3").collection("items").get();

  toDelete.forEach((x) => console.log(`  ${apply ? "x" : "-"} ${x.label}`));
  console.log(`\n${toDelete.length} document(s) ${apply ? "to delete" : "would be deleted"}.`);
  console.log(`Left untouched: ${level3.size} old Product item(s) under level_3 (they are now unreachable), all Printers, all steps.`);
  if (kept.length > 0) {
    console.log(`Kept ${kept.length} item(s) under level_2 created on or after ${beforeArg} (or with no creation date), treated as new Products:`);
    kept.forEach(({ doc, created }) => console.log(`    ${doc.data().name ?? doc.id}${created ? ` (created ${created.toISOString().slice(0, 10)})` : " (no creation date)"}`));
  }
  console.log("");

  if (!apply) {
    console.log("Nothing was changed. Run again with --apply to delete.");
    process.exit(0);
  }

  for (let i = 0; i < toDelete.length; i += 400) {
    const batch = db.batch();
    toDelete.slice(i, i + 400).forEach((x) => batch.delete(x.ref));
    await batch.commit();
  }
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
