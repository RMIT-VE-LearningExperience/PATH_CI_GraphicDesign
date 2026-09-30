import { NextRequest, NextResponse } from "next/server";

import { auth, adminDb } from "../../../lib/firebase-admin";
import { reviewContentImages, type AltTextReviewFilters } from "../../../lib/alt-text-review";

export const dynamic = "force-dynamic";
// A full review sends every content image to VAL sequentially in small batches
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const decoded = await auth.verifyIdToken(token);
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

    let filters: AltTextReviewFilters = {};
    try {
      const body = (await req.json()) as {
        levelId?: unknown;
        parentItemId?: unknown;
        ids?: unknown;
        limit?: unknown;
      };
      filters = {
        ...(typeof body.levelId === "string" ? { levelId: body.levelId } : {}),
        ...(typeof body.parentItemId === "string" ? { parentItemId: body.parentItemId } : {}),
        ...(Array.isArray(body.ids) && body.ids.every((id) => typeof id === "string")
          ? { ids: body.ids as string[] }
          : {}),
        ...(typeof body.limit === "number" ? { limit: body.limit } : {}),
      };
    } catch {
      // Empty body: review all content images
    }

    // Optional per-request VAL key from the GUI; never logged or stored
    const apiKey = req.headers.get("x-val-api-key")?.trim() || undefined;
    if (!apiKey && !process.env.VAL_API_KEY) {
      return NextResponse.json(
        { error: "No VAL API key — enter your key in the field above and try again" },
        { status: 400 },
      );
    }

    const result = await reviewContentImages(filters, { apiKey });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Alt text review error:", error);
    const status = message.includes("VAL_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
