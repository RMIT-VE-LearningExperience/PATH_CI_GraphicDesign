import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

let auth: ReturnType<typeof getAuth> | null = null;

export function initializeFirebaseClient() {
  if (typeof window === "undefined") {
    throw new Error("Firebase client should only be initialized in the browser");
  }

  if (auth) return auth;

  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  return auth;
}

export function getAuthInstance() {
  if (!auth) {
    throw new Error("Firebase not initialized. Call initializeFirebaseClient() first.");
  }
  return auth;
}
