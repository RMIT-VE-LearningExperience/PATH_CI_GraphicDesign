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
    const callerDoc = await adminDb.collection("admins").doc(decoded.uid).get();
    const callerData = callerDoc.data() as { role?: string; active?: boolean } | undefined;
    if (!callerDoc.exists || !callerData?.active) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const snapshot = await adminDb.collection("admins").get();

    const admins = snapshot.docs
      .map((doc) => {
        const d = doc.data() as {
          name?: string;
          email?: string;
          staffNumber?: string;
          role?: string;
          active?: boolean;
          addedAt?: FirebaseFirestore.Timestamp;
          lastLogin?: FirebaseFirestore.Timestamp;
        };
        return {
          uid:         doc.id,
          name:        d.name        ?? "",
          email:       d.email       ?? "",
          staffNumber: d.staffNumber ?? "",
          role:        d.role        ?? "admin",
          active:      d.active      ?? true,
          addedAt:     d.addedAt?.toDate?.().toISOString()  ?? "",
          lastLogin:   d.lastLogin?.toDate?.().toISOString() ?? "",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ admins }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Admin list error:", message);
    return NextResponse.json({ error: "Failed to load admin list" }, { status: 500 });
  }
}
