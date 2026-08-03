import { NextRequest, NextResponse } from "next/server";
import { auth, adminDb } from "../../../lib/firebase-admin";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    const idToken = authHeader?.replace("Bearer ", "");

    if (!idToken) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const decoded = await auth.verifyIdToken(idToken);
    const adminDoc = await adminDb.collection("admins").doc(decoded.uid).get();
    const adminData = adminDoc.data() as { role?: string; active?: boolean } | undefined;

    if (!adminDoc.exists || !adminData?.active) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const snapshot = await adminDb
      .collection("adminRequests")
      .where("status", "==", "pending")
      .get();

    const requests = snapshot.docs
      .map((doc) => {
        const data = doc.data() as {
          name: string;
          email: string;
          staffNumber: string;
          requestedAt: FirebaseFirestore.Timestamp;
        };
        return {
          id: doc.id,
          name: data.name,
          email: data.email,
          staffNumber: data.staffNumber,
          requestedAt: data.requestedAt?.toDate?.().toISOString() ?? "",
        };
      })
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));

    return NextResponse.json({ requests }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Admin requests error:", errorMessage);
    return NextResponse.json({ error: "Failed to load requests" }, { status: 500 });
  }
}
