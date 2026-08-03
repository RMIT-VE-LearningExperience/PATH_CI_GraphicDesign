import { NextRequest, NextResponse } from "next/server";
import { auth, adminDb } from "../../../lib/firebase-admin";
import { createPreviewToken } from "../../../lib/tutorial-store";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearerToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const decoded = await auth.verifyIdToken(bearerToken);
    if ((decoded.role as string | undefined) !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const adminDoc = await adminDb.collection("admins").doc(decoded.uid).get();
    if (!adminDoc.exists || !(adminDoc.data() as { active?: boolean })?.active) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const previewToken = await createPreviewToken();
    return NextResponse.json({ token: previewToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
