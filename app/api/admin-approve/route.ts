import { NextRequest, NextResponse } from "next/server";
import { auth, adminDb } from "../../../lib/firebase-admin";

export async function POST(req: NextRequest) {
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

    const body = await req.json() as {
      requestId?: string;
      action?: "approve" | "reject";
    };
    const { requestId, action } = body;
    const reviewerUid = decoded.uid;

    if (!requestId || !action) {
      return NextResponse.json({ error: "requestId and action are required" }, { status: 400 });
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
    }

    // Fetch the request document
    const requestRef = adminDb.collection("adminRequests").doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const requestData = requestDoc.data() as {
      name: string;
      email: string;
      staffNumber: string;
      status: string;
    };

    if (requestData.status !== "pending") {
      return NextResponse.json(
        { error: "This request has already been reviewed" },
        { status: 409 }
      );
    }

    if (action === "reject") {
      await requestRef.update({
        status: "rejected",
        reviewedBy: reviewerUid || null,
        reviewedAt: new Date(),
      });
      return NextResponse.json({ message: "Request rejected" }, { status: 200 });
    }

    // Approve: create or find Firebase Auth user, then write to admins collection
    let uid: string;
    try {
      const existingUser = await auth.getUserByEmail(requestData.email);
      uid = existingUser.uid;
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string };
      if (firebaseErr.code === "auth/user-not-found") {
        const newUser = await auth.createUser({ email: requestData.email });
        uid = newUser.uid;
      } else {
        throw err;
      }
    }

    // Write to admins collection
    await adminDb.collection("admins").doc(uid).set(
      {
        name: requestData.name,
        email: requestData.email,
        staffNumber: requestData.staffNumber,
        role: "admin",
        active: true,
        addedAt: new Date(),
      },
      { merge: true }
    );

    // Mark request as approved
    await requestRef.update({
      status: "approved",
      reviewedBy: reviewerUid || null,
      reviewedAt: new Date(),
    });

    return NextResponse.json({ message: "Request approved", uid }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Admin approve error:", errorMessage);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
