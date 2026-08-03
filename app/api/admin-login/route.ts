import { NextRequest, NextResponse } from "next/server";
import { auth, adminDb } from "../../../lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { staffNumber?: string };
    const { staffNumber } = body;

    if (!staffNumber || !staffNumber.trim()) {
      return NextResponse.json({ error: "E-number is required" }, { status: 400 });
    }

    // Look up admin by staffNumber in Firestore
    const snapshot = await adminDb
      .collection("admins")
      .where("staffNumber", "==", staffNumber.trim())
      .where("active", "==", true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { error: "E-number not recognised. Please contact your administrator." },
        { status: 403 }
      );
    }

    const adminDoc = snapshot.docs[0];
    const adminData = adminDoc.data() as {
      email?: string;
      role?: string;
      name?: string;
    };
    const uid = adminDoc.id;
    const role = adminData.role || "admin";

    // Mint a custom token for this uid
    const customToken = await auth.createCustomToken(uid, { role });

    // Update lastLogin
    try {
      await adminDoc.ref.update({ lastLogin: new Date() });
    } catch {
      // Non-critical
    }

    return NextResponse.json({ customToken, role, email: adminData.email }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Admin login error:", errorMessage);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
