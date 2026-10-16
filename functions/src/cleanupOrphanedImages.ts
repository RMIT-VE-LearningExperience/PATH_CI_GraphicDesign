import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, CollectionReference } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { collectStoragePaths } from "./storageReferences";

// This project shares its bucket with other PATH apps. Never use the default
// database or scan/delete objects outside this app's namespace.
const DATABASE_ID = "path-ci-graphicdesign";
const STORAGE_PREFIX = "path-ci-graphicdesign/";
const BUCKET = "printer-app-531a8.firebasestorage.app";

/**
 * Compatibility export for existing schedules. Automatic deletion is disabled:
 * legacy orphan records may come from incomplete or incorrectly scoped audits.
 * Do not trust those records, even after the audit below has been corrected.
 */
export const cleanupOrphanedImages = onSchedule(
  { schedule: "0 0 * * *", timeZone: "Australia/Melbourne", timeoutSeconds: 60 },
  async () => {
    console.warn("Automatic image deletion is disabled. Review scoped audit results manually.");
  },
);

/** Read-only audit. Includes drafts, disabled levels, trash and embedded images. */
export const auditOrphanedImages = onSchedule(
  { schedule: "0 2 * * 0", timeZone: "Australia/Melbourne", timeoutSeconds: 540 },
  async () => {
    const db = getFirestore(DATABASE_ID);
    const referenced = new Set<string>();

    const visit = async (collection: CollectionReference): Promise<void> => {
      // Parent documents such as steps/{itemId} may not exist even though their
      // subcollections do. listDocuments includes these missing parent docs.
      const refs = await collection.listDocuments();
      for (const ref of refs) {
        const doc = await ref.get();
        collectStoragePaths(doc.data(), BUCKET, STORAGE_PREFIX, referenced);
        for (const child of await ref.listCollections()) await visit(child);
      }
    };

    // Finish every database read before reporting any candidate. A failed read
    // must fail the audit instead of producing an incomplete reference set.
    // Traverse every collection in this app database, including legacy content.
    for (const root of await db.listCollections()) await visit(root);

    const [files] = await getStorage().bucket(BUCKET).getFiles({ prefix: STORAGE_PREFIX });
    let candidates = 0;
    for (const file of files) {
      if (!referenced.has(file.name)) {
        candidates++;
        console.log("Unreferenced image candidate (report only):", file.name);
      }
    }
    console.log(`Graphic Design audit: ${referenced.size} referenced paths, ${candidates} candidates. No files deleted or queued.`);
  },
);
