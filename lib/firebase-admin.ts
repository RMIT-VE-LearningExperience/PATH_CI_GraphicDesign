import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as fs from "fs";

function getPrivateKey() {
  const value = process.env.FIREBASE_PRIVATE_KEY;
  if (!value) {
    return undefined;
  }

  return value.replace(/\\n/g, "\n");
}

function loadServiceAccount() {
  try {
    // Try to load from environment variable path
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credPath && fs.existsSync(credPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(credPath, "utf-8"));
      return serviceAccount;
    }
  } catch (error) {
    console.warn("Could not load service account from GOOGLE_APPLICATION_CREDENTIALS:", error);
  }

  return null;
}

function getStorageBucket(): string | undefined {
  // Try explicit environment variable first
  if (process.env.FIREBASE_STORAGE_BUCKET) {
    return process.env.FIREBASE_STORAGE_BUCKET;
  }

  // Try to get from FIREBASE_CONFIG
  try {
    const firebaseConfig = process.env.FIREBASE_CONFIG;
    if (firebaseConfig) {
      const config = JSON.parse(firebaseConfig);
      return config.storageBucket;
    }
  } catch (error) {
    console.warn("Could not parse FIREBASE_CONFIG:", error);
  }

  return undefined;
}

function initAdminApp() {
  const existing = getApps()[0];
  if (existing) {
    return existing;
  }

  const storageBucket = getStorageBucket();

  // Try to use environment variables first
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (projectId && clientEmail && privateKey) {
    console.log("Initializing Firebase with environment variables");
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket,
    });
  }

  // Try to load from service account file
  const serviceAccount = loadServiceAccount();
  if (serviceAccount) {
    console.log("Initializing Firebase with service account file");
    return initializeApp({
      credential: cert(serviceAccount),
      storageBucket,
    });
  }

  // Fall back to application default credentials
  console.log("Initializing Firebase with application default credentials");
  return initializeApp({
    credential: applicationDefault(),
    storageBucket,
  });
}

const app = initAdminApp();

export const auth = getAuth(app);
export const db = getFirestore(app, process.env.FIREBASE_DATABASE_ID || "(default)");
export const adminDb = getFirestore(app, process.env.FIREBASE_ADMIN_DATABASE_ID || "(default)");
export const bucket = getStorage(app).bucket();
