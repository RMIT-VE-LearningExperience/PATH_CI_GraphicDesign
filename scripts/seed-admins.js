// Usage: npm run seed-admins
// Edit scripts/admins.json to list the admins to add, then run this script.

const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { readFileSync } = require("fs");
const { join } = require("path");

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

const auth = getAuth(app);
const db = getFirestore(app);

async function seedAdmins() {
  const adminsPath = join(__dirname, "admins.json");
  const admins = JSON.parse(readFileSync(adminsPath, "utf-8"));

  console.log(`\nSeeding ${admins.length} admin(s)...\n`);

  for (const entry of admins) {
    const { email, role = "admin", name = "", staffNumber = "" } = entry;

    try {
      // Get existing Firebase Auth user, or create one
      let uid;
      try {
        const user = await auth.getUserByEmail(email);
        uid = user.uid;
        console.log(`  Found existing user: ${email} (${uid})`);
      } catch (err) {
        if (err.code === "auth/user-not-found") {
          const newUser = await auth.createUser({ email });
          uid = newUser.uid;
          console.log(`  Created new user: ${email} (${uid})`);
        } else {
          throw err;
        }
      }

      // Write to Firestore admins collection (merge so existing fields are kept)
      await db.collection("admins").doc(uid).set(
        {
          name,
          email,
          role,
          staffNumber,
          active: true,
          addedAt: new Date(),
        },
        { merge: true }
      );

      console.log(`  ✓ Saved: ${email}  role=${role}\n`);
    } catch (err) {
      console.error(`  ✗ Failed for ${email}:`, err.message, "\n");
    }
  }

  console.log("Done.");
  process.exit(0);
}

seedAdmins().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
