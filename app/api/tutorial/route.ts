import { NextRequest, NextResponse } from "next/server";
import { auth, adminDb } from "../../../lib/firebase-admin";

import {
  addItem,
  updateItem,
  deleteItem,
  linkItem,
  unlinkItem,
  updateRelationship,
  removeInvalidChildren,
  addStep,
  updateStep,
  deleteStep,
  reorderStep,
  setStepOrder,
  restoreDeletedItem,
  permanentlyDeleteItem,
  updateHomepageSettings,
  updateLevelSettings,
  updateAppSettings,
  getTutorialState,
  validatePreviewToken,
  isActiveAdmin,
  type TutorialState,
  type AppSettings,
} from "../../../lib/tutorial-store";

type ActionPayload =
  | { action: "addItem"; levelId: string; name: string; description?: string; thumbnailDataUrl?: string }
  | { action: "updateItem"; levelId: string; itemId: string; name?: string; description?: string; thumbnailDataUrl?: string; published?: boolean }
  | { action: "deleteItem"; levelId: string; itemId: string }
  | { action: "linkItem"; parentLevelId: string; parentItemId: string; childLevelId: string; childItemId: string }
  | { action: "unlinkItem"; parentLevelId: string; parentItemId: string; childItemId: string }
  | { action: "updateRelationship"; parentLevelId: string; parentItemId: string; childItemId: string; published: boolean }
  | { action: "addStep"; parentItemId: string; title: string; contentHtml: string; imageDataUrl: string; videoUrl?: string }
  | { action: "updateStep"; parentItemId: string; stepId: string; title?: string; contentHtml?: string; imageDataUrl?: string; videoUrl?: string }
  | { action: "deleteStep"; parentItemId: string; stepId: string }
  | { action: "reorderStep"; parentItemId: string; stepId: string; direction: "up" | "down" }
  | { action: "setStepOrder"; parentItemId: string; stepId: string; newIndex: number }
  | { action: "restoreDeletedItem"; deletedItemId: string }
  | { action: "permanentlyDeleteItem"; deletedItemId: string }
  | { action: "removeInvalidChildren"; parentLevelId: string; parentItemId: string }
  | { action: "updateHomepageSettings"; title: string; description: string }
  | { action: "updateLevelSettings"; levelId: string; sectionTitle: string; sectionSubtitle: string }
  | { action: "updateAppSettings"; settings: Partial<AppSettings> };

async function executeAction(payload: ActionPayload, modifiedBy: string): Promise<TutorialState> {
  switch (payload.action) {
    case "addItem":
      return addItem(payload.levelId, payload.name, payload.description, payload.thumbnailDataUrl, modifiedBy);

    case "updateItem":
      return updateItem(
        payload.levelId,
        payload.itemId,
        {
          name: payload.name,
          description: payload.description,
          thumbnailDataUrl: payload.thumbnailDataUrl,
          published: payload.published,
        },
        modifiedBy,
      );

    case "deleteItem":
      return deleteItem(payload.levelId, payload.itemId, modifiedBy);

    case "linkItem":
      return linkItem(payload.parentLevelId, payload.parentItemId, payload.childLevelId, payload.childItemId);

    case "unlinkItem":
      return unlinkItem(payload.parentLevelId, payload.parentItemId, payload.childItemId);

    case "updateRelationship":
      return updateRelationship(payload.parentLevelId, payload.parentItemId, payload.childItemId, payload.published);

    case "addStep":
      return addStep(payload.parentItemId, payload.title, payload.contentHtml, payload.imageDataUrl, payload.videoUrl, modifiedBy);

    case "updateStep":
      return updateStep(
        payload.parentItemId,
        payload.stepId,
        {
          title: payload.title,
          contentHtml: payload.contentHtml,
          imageDataUrl: payload.imageDataUrl,
          videoUrl: payload.videoUrl,
        },
        modifiedBy,
      );

    case "deleteStep":
      return deleteStep(payload.parentItemId, payload.stepId, modifiedBy);

    case "reorderStep":
      return reorderStep(payload.parentItemId, payload.stepId, payload.direction);

    case "setStepOrder":
      return setStepOrder(payload.parentItemId, payload.stepId, payload.newIndex);

    case "restoreDeletedItem":
      return restoreDeletedItem(payload.deletedItemId);

    case "permanentlyDeleteItem":
      return permanentlyDeleteItem(payload.deletedItemId);

    case "removeInvalidChildren":
      return removeInvalidChildren(payload.parentLevelId, payload.parentItemId);

    case "updateHomepageSettings":
      await updateHomepageSettings(payload.title, payload.description);
      return getTutorialState();

    case "updateLevelSettings":
      await updateLevelSettings(payload.levelId, payload.sectionTitle, payload.sectionSubtitle);
      return getTutorialState();

    case "updateAppSettings":
      await updateAppSettings(payload.settings);
      return getTutorialState();

    default:
      throw new Error(`Unknown action: ${(payload as { action: string }).action}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let modifiedBy = "system";
    try {
      const decoded = await auth.verifyIdToken(token);
      if ((decoded.role as string | undefined) !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const adminDoc = await adminDb.collection("admins").doc(decoded.uid).get();
      if (!adminDoc.exists || !(adminDoc.data() as { active?: boolean })?.active) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const adminName = (adminDoc.data() as { name?: string } | undefined)?.name;
      modifiedBy = adminName || decoded.email || decoded.uid || "system";
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { action: string; payload: unknown };
    if (!body.action || !body.payload) {
      return NextResponse.json({ error: "Missing action or payload" }, { status: 400 });
    }

    const actionPayload = {
      ...(body.payload as Record<string, unknown>),
      action: body.action,
    } as ActionPayload;

    const state = await executeAction(actionPayload, modifiedBy);
    return NextResponse.json({ state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("API Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const previewToken = searchParams.get("previewToken");

    // Authenticated admins receive all items including unpublished
    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (bearerToken && (await isActiveAdmin(bearerToken))) {
      const state = await getTutorialState(false);
      return NextResponse.json({ state, isPreviewMode: false });
    }

    // Preview token bypasses published filters for unauthenticated visitors
    let isPreviewMode = false;
    if (previewToken) {
      isPreviewMode = await validatePreviewToken(previewToken);
    }

    const state = await getTutorialState(!isPreviewMode);
    return NextResponse.json({ state, isPreviewMode });
  } catch (error) {
    console.error("API Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
