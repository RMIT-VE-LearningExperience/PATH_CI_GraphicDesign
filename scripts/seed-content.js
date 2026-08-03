// Usage: npm run seed-content
// Seeds settings/hierarchy, settings/appSettings, and settings/homepage to Firestore.
// Run once after initial deploy, or to reset settings to defaults.

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { readFileSync } = require("fs");

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
      const sa = JSON.parse(readFileSync(credPath, "utf-8"));
      return cert(sa);
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
const db = getFirestore(app, databaseId);

const hierarchy = {
  levels: [
    { id: "level_1", name: "Printers", singularName: "Printer", type: null,    enabled: true, order: 1 },
    { id: "level_2", name: "Papers",   singularName: "Paper",   type: "type1", enabled: true, order: 2 },
    { id: "level_3", name: "Products", singularName: "Product", type: "type2", enabled: true, order: 3 },
  ],
};

const appSettings = {
  features: {
    copyLink: true,
    qrCode: true,
    canvasEmbed: true,
    fullItemListView: true,
  },
};

const homepage = {
  title: "Welcome",
  description: "Select an option below to get started.",
};

async function seedContent() {
  console.log(`\nSeeding content settings to "${databaseId}" database...\n`);

  await db.collection("settings").doc("hierarchy").set(hierarchy);
  console.log("  ✓ settings/hierarchy");

  await db.collection("settings").doc("appSettings").set(appSettings);
  console.log("  ✓ settings/appSettings");

  await db.collection("settings").doc("homepage").set(homepage, { merge: true });
  console.log("  ✓ settings/homepage\n");

  console.log("Done.");
  process.exit(0);
}

seedContent().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
