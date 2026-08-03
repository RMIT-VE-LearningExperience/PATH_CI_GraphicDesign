import { initializeApp } from "firebase-admin/app";

initializeApp();

export {
  cleanupOrphanedImages as graphicDesignCleanupOrphanedImages,
  auditOrphanedImages as graphicDesignAuditOrphanedImages,
} from "./cleanupOrphanedImages";
