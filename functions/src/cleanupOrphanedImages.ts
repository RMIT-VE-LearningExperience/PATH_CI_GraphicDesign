import { onSchedule } from "firebase-functions/v2/scheduler";
import { getApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// Content lives in the app's own named database, not "(default)".
const db = getFirestore(getApp(), "path-ci-graphicdesign");
const storage = getStorage();

/**
 * Daily cleanup: deletes Storage files that have been marked as orphaned for 30+ days.
 * Runs every day at midnight Melbourne time.
 */
export const cleanupOrphanedImages = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "Australia/Melbourne",
    timeoutSeconds: 300,
  },
  async () => {
    const thirtyDaysAgo = Timestamp.fromDate(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    );

    const snapshot = await db
      .collection("orphanedStorageFiles")
      .where("orphanedAt", "<=", thirtyDaysAgo)
      .get();

    if (snapshot.empty) {
      console.log("No orphaned files to clean up.");
      return;
    }

    const bucket = storage.bucket();
    const results = await Promise.allSettled(
      snapshot.docs.map(async (doc) => {
        const { storagePath } = doc.data() as { storagePath: string };
        try {
          await bucket.file(storagePath).delete();
          await doc.ref.delete();
          console.log(`Deleted orphaned file: ${storagePath}`);
        } catch (error) {
          if ((error as { code?: number }).code === 404) {
            // File already gone — still remove the Firestore record
            await doc.ref.delete();
            console.log(`File already gone, removed record: ${storagePath}`);
          } else {
            throw error;
          }
        }
      }),
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      console.error(`${failed.length} file(s) failed to delete.`);
    }
    console.log(
      `Cleanup complete: ${snapshot.size} record(s) processed, ${failed.length} failed.`,
    );
  },
);

/**
 * Weekly safety-net audit: scans all Storage files and cross-checks them against
 * all image URLs in Firestore. Any unreferenced file older than 1 day is added to
 * orphanedStorageFiles so the daily cleanup can pick it up.
 * Runs every Sunday at 2am Melbourne time.
 */
export const auditOrphanedImages = onSchedule(
  {
    schedule: "0 2 * * 0",
    timeZone: "Australia/Melbourne",
    timeoutSeconds: 540,
  },
  async () => {
    const bucket = storage.bucket();
    const [files] = await bucket.getFiles();

    // Collect all image URLs currently referenced in Firestore
    const referencedUrls = new Set<string>();

    const collectUrl = (url: unknown) => {
      if (typeof url === "string" && url.startsWith("https://firebasestorage")) {
        referencedUrls.add(url);
      }
    };

    // Printers (thumbnails)
    const printersSnap = await db.collection("printers").get();
    printersSnap.docs.forEach((d) => collectUrl(d.data().thumbnailDataUrl));

    // Papers (thumbnails) + their colours (thumbnails) + steps (images)
    const papersSnap = await db.collection("papers").get();
    await Promise.all(
      papersSnap.docs.map(async (paperDoc) => {
        collectUrl(paperDoc.data().thumbnailDataUrl);

        const coloursSnap = await paperDoc.ref.collection("colours").get();
        await Promise.all(
          coloursSnap.docs.map(async (colourDoc) => {
            collectUrl(colourDoc.data().thumbnailDataUrl);

            const stepsSnap = await colourDoc.ref.collection("steps").get();
            stepsSnap.docs.forEach((stepDoc) => collectUrl(stepDoc.data().imageDataUrl));
          }),
        );
      }),
    );

    // Mark any Storage file not referenced anywhere as an orphan
    for (const file of files) {
      const isReferenced = [...referencedUrls].some((url) =>
        url.includes(encodeURIComponent(file.name)),
      );

      if (!isReferenced) {
        const [metadata] = await file.getMetadata();
        const createdAt = new Date(metadata.timeCreated as string);
        const ageDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

        // Grace period: skip files younger than 1 day (may be a new upload in progress)
        if (ageDays <= 1) continue;

        // Only add to orphanedStorageFiles if not already tracked
        const existing = await db
          .collection("orphanedStorageFiles")
          .where("storagePath", "==", file.name)
          .get();

        if (existing.empty) {
          await db.collection("orphanedStorageFiles").add({
            storagePath: file.name,
            orphanedAt: Timestamp.now(),
            reason: "audit: not referenced in Firestore",
          });
          console.log(`Audit marked orphan: ${file.name}`);
        }
      }
    }

    console.log(`Audit complete. ${referencedUrls.size} URLs referenced in Firestore.`);
  },
);
