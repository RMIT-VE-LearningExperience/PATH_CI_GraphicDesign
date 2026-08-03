import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      name?: string;
      email?: string;
      staffNumber?: string;
    };
    const { name, email, staffNumber } = body;

    if (!name?.trim() || !email?.trim() || !staffNumber?.trim()) {
      return NextResponse.json({ error: "Name, email, and e-number are all required" }, { status: 400 });
    }

    const cleanStaffNumber = staffNumber.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    // Check if staffNumber already exists in active admins
    const existingAdmin = await adminDb
      .collection("admins")
      .where("staffNumber", "==", cleanStaffNumber)
      .limit(1)
      .get();

    if (!existingAdmin.empty) {
      return NextResponse.json(
        { error: "This e-number is already registered." },
        { status: 409 }
      );
    }

    // Check if a pending request already exists for this staffNumber
    const existingRequest = await adminDb
      .collection("adminRequests")
      .where("staffNumber", "==", cleanStaffNumber)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (!existingRequest.empty) {
      return NextResponse.json(
        { error: "A request for this e-number is already pending approval." },
        { status: 409 }
      );
    }

    // Write to adminRequests collection
    await adminDb.collection("adminRequests").add({
      name: cleanName,
      email: cleanEmail,
      staffNumber: cleanStaffNumber,
      status: "pending",
      requestedAt: new Date(),
    });

    return NextResponse.json({ message: "Registration request submitted successfully" }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Admin register error:", errorMessage);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
