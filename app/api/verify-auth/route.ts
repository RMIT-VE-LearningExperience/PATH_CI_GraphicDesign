import { NextRequest, NextResponse } from "next/server";
import { auth, adminDb } from "../../../lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { idToken?: string };
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    // Verify the ID token
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const userEmail = decodedToken.email;
    if (!userEmail) {
      return NextResponse.json({ error: "Email not found in token" }, { status: 400 });
    }

    // Check if user is in the admins allowlist
    const adminDocRef = adminDb.collection("admins").doc(decodedToken.uid);
    const adminDoc = await adminDocRef.get();

    if (!adminDoc.exists) {
      // User exists in Firebase Auth but not in admins allowlist
      return NextResponse.json(
        { error: "Access not authorized. Please contact your administrator." },
        { status: 403 },
      );
    }

    const adminData = adminDoc.data() as {
      email?: string;
      role?: string;
      active?: boolean;
    } | undefined;

    if (!adminData?.active) {
      return NextResponse.json(
        { error: "Access not authorized. Please contact your administrator." },
        { status: 403 },
      );
    }

    const role = adminData.role || "admin";

    // Set custom claims
    try {
      await auth.setCustomUserClaims(decodedToken.uid, { role });
    } catch (err) {
      console.error("Error setting custom claims:", err);
      // Continue anyway — claims will be set on next sign-in
    }

    // Update lastLogin
    try {
      await adminDocRef.update({
        lastLogin: new Date(),
      });
    } catch (err) {
      console.error("Error updating lastLogin:", err);
      // Continue anyway — this is not critical
    }

    const response = NextResponse.json({ role, email: userEmail }, { status: 200 });
    response.cookies.set("adminSession", "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 28800,
      path: "/",
    });
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Verify auth error:", errorMessage);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
