import { randomUUID } from "crypto";

import { FieldValue } from "firebase-admin/firestore";

import { db, adminDb } from "./firebase-admin";
import { resolveImageUrl } from "./media-storage";

// ============= TYPES =============

export type Level = {
  id: string;
  name: string;
  singularName: string;
  type: "type1" | "type2" | null;
  enabled: boolean;
  order: number;
  sectionTitle?: string;
  sectionSubtitle?: string;
};

export type HierarchyConfig = {
  levels: Level[];
};

export type AppSettings = {
  features: {
    copyLink: boolean;
    qrCode: boolean;
    canvasEmbed: boolean;
    fullItemListView: boolean;
  };
};

export type Item = {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl: string;
  // Empty string means "decorative image"; undefined means never reviewed
  thumbnailAlt?: string;
  slug: string;
  published: boolean;
  createdAt: Date;
  lastModified: Date;
  modifiedBy: string;
};

export type RelationshipEntry = {
  childItemId: string;
  childLevelId: string;
  published: boolean;
  order: number;
};

export type Step = {
  id: string;
  title: string;
  contentHtml: string;
  // Any number of images, in display order. imageAlts runs parallel to imageUrls:
  // "" means "decorative image"; null means never reviewed.
  imageUrls: string[];
  imageAlts: (string | null)[];
  videoUrl?: string;
  // A sub-step belongs to a main step and is shown nested under it. Only one
  // level of nesting is allowed, and a main step's sub-steps follow it in `order`.
  stepType: "main" | "sub";
  parentStepId: string | null;
  order: number;
  createdAt: Date;
  lastModified: Date;
  modifiedBy: string;
};

export type DeletedItem = {
  id: string;
  originalId: string;
  type: string;        // levelId or "step"
  parentId?: string;   // for steps: the parent item ID
  name: string;
  location?: string;   // human-readable origin path, e.g. "Printer → Product"
  deletedAt: Date;
  deletedBy: string;
  data: Record<string, unknown>;
};

export type TutorialState = {
  hierarchyConfigured: boolean;
  hierarchy: HierarchyConfig;
  appSettings: AppSettings;
  homepageTitle: string;
  homepageDescription: string;
  // levelId → items
  items: Record<string, Item[]>;
  // parentLevelId → parentItemId → children
  relationships: Record<string, Record<string, RelationshipEntry[]>>;
  // parentItemId → steps
  steps: Record<string, Step[]>;
  deletedItems: DeletedItem[];
};

// ============= HELPERS =============

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function defaultAppSettings(): AppSettings {
  return {
    features: {
      copyLink: true,
      qrCode: true,
      canvasEmbed: true,
      fullItemListView: true,
    },
  };
}

function emptyTutorialState(): TutorialState {
  return {
    hierarchyConfigured: false,
    hierarchy: { levels: [] },
    appSettings: defaultAppSettings(),
    homepageTitle: "",
    homepageDescription: "",
    items: {},
    relationships: {},
    steps: {},
    deletedItems: [],
  };
}

function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date();
}

// Reads a step document, upgrading the older single-image shape (imageUrl /
// imageAlt) to imageUrls / imageAlts so callers only deal with one shape.
function toStep(id: string, data: Record<string, unknown>): Step {
  const legacyUrl = typeof data.imageUrl === "string" ? data.imageUrl : "";
  const urls = Array.isArray(data.imageUrls)
    ? (data.imageUrls as string[])
    : legacyUrl
      ? [legacyUrl]
      : [];
  const storedAlts = Array.isArray(data.imageAlts)
    ? (data.imageAlts as (string | null)[])
    : typeof data.imageAlt === "string"
      ? [data.imageAlt]
      : [];
  const { imageUrl: _legacyUrl, imageAlt: _legacyAlt, ...rest } = data;
  void _legacyUrl;
  void _legacyAlt;
  return {
    ...(rest as Omit<Step, "id" | "imageUrls" | "imageAlts" | "stepType" | "parentStepId" | "createdAt" | "lastModified">),
    id,
    imageUrls: urls,
    imageAlts: urls.map((_, i) => storedAlts[i] ?? null),
    // Steps saved before sub-steps existed are all main steps
    stepType: data.stepType === "sub" ? "sub" : "main",
    parentStepId: typeof data.parentStepId === "string" ? data.parentStepId : null,
    createdAt: toDate(data.createdAt),
    lastModified: toDate(data.lastModified),
  };
}

// Resolves a human-readable location path for a deleted item by walking down
// from level 0 and building composite ancestor paths (e.g. "parentId:childId").
// Works at any hierarchy depth. For a step, pass the last-level item name as `selfName`.
async function resolveDeleteLocation(
  levelId: string,
  itemId: string,
  selfName?: string,
): Promise<string | undefined> {
  try {
    const hierSnap = await db.collection("settings").doc("hierarchy").get();
    if (!hierSnap.exists) return selfName;
    const allLevels = ((hierSnap.data() as { levels: Level[] }).levels ?? [])
      .filter((l) => l.enabled)
      .sort((a, b) => a.order - b.order);

    const levelIndex = allLevels.findIndex((l) => l.id === levelId);
    if (levelIndex <= 0) return selfName;

    type AncPath = { compositeKey: string; names: string[] };

    // Seed paths from all level-0 items
    const level0Snap = await itemsCol(allLevels[0].id).get();
    let paths: AncPath[] = level0Snap.docs.map((doc) => ({
      compositeKey: doc.id,
      names: [(doc.data() as { name?: string }).name ?? doc.id],
    }));

    // Expand each path one level at a time down to levelIndex-1
    for (let i = 0; i < levelIndex - 1; i++) {
      const childLevelSnap = await itemsCol(allLevels[i + 1].id).get();
      const childNames = new Map(
        childLevelSnap.docs.map((d) => [d.id, (d.data() as { name?: string }).name ?? d.id]),
      );
      const nextPaths: AncPath[] = [];
      await Promise.all(
        paths.map(async (path) => {
          const snap = await childrenCol(path.compositeKey).get();
          for (const doc of snap.docs) {
            nextPaths.push({
              compositeKey: `${path.compositeKey}:${doc.id}`,
              names: [...path.names, childNames.get(doc.id) ?? doc.id],
            });
          }
        }),
      );
      paths = nextPaths;
    }

    // Find which paths directly contain our item
    const foundNames: string[][] = [];
    await Promise.all(
      paths.map(async (path) => {
        const snap = await childrenCol(path.compositeKey).doc(itemId).get();
        if (snap.exists) foundNames.push(path.names);
      }),
    );

    if (foundNames.length === 0) return selfName;
    const locationStr = foundNames.map((names) => names.join(" → ")).join(", ");
    if (selfName) return `${locationStr} → ${selfName}`;
    return locationStr;
  } catch {
    return selfName;
  }
}

// Firestore path helpers
// items/{levelId}/items/{itemId}
const itemsCol = (levelId: string) =>
  db.collection("items").doc(levelId).collection("items");

// links/{parentItemId}/children/{childItemId}
const childrenCol = (parentItemId: string) =>
  db.collection("links").doc(parentItemId).collection("children");

// steps/{parentItemId}/items/{stepId}
const stepsCol = (parentItemId: string) =>
  db.collection("steps").doc(parentItemId).collection("items");

// ============= READ =============

export async function getTutorialState(publishedOnly = false): Promise<TutorialState> {
  const [hierarchySnap, appSettingsSnap, homepageSnap, deletedSnap] = await Promise.all([
    db.collection("settings").doc("hierarchy").get(),
    db.collection("settings").doc("appSettings").get(),
    db.collection("settings").doc("homepage").get(),
    db.collection("deletedItems").get(),
  ]);

  if (!hierarchySnap.exists) {
    return emptyTutorialState();
  }

  const hierarchyData = hierarchySnap.data() as { levels: Level[] };
  const hierarchy: HierarchyConfig = { levels: hierarchyData.levels ?? [] };

  const appSettings: AppSettings = appSettingsSnap.exists
    ? (appSettingsSnap.data() as AppSettings)
    : defaultAppSettings();

  const homepageData = homepageSnap.data();
  const homepageTitle = (homepageData?.title as string) ?? "";
  const homepageDescription = (homepageData?.description as string) ?? "";

  const deletedItems: DeletedItem[] = deletedSnap.docs.map((doc) => ({
    ...(doc.data() as Omit<DeletedItem, "id" | "deletedAt">),
    id: doc.id,
    deletedAt: toDate(doc.data().deletedAt),
  }));

  const activeLevels = hierarchy.levels
    .filter((l) => l.enabled)
    .sort((a, b) => a.order - b.order);

  // Load all items for all active levels in parallel
  const itemsEntries = await Promise.all(
    activeLevels.map(async (level) => {
      const snap = await itemsCol(level.id).get();
      let items: Item[] = snap.docs.map((doc) => ({
        ...(doc.data() as Omit<Item, "id" | "createdAt" | "lastModified">),
        id: doc.id,
        createdAt: toDate(doc.data().createdAt),
        lastModified: toDate(doc.data().lastModified),
      }));
      // Only filter top-level items by item.published.
      // Deeper items are controlled by relationship.published,
      // since the CMS toggle only sets relationship.published for non-top items.
      if (publishedOnly && level.id === activeLevels[0]?.id) {
        items = items.filter((i) => i.published);
      }
      items.sort((a, b) => a.name.localeCompare(b.name));
      return [level.id, items] as [string, Item[]];
    }),
  );

  const items: Record<string, Item[]> = Object.fromEntries(itemsEntries);

  // Load relationships for all non-last levels (levels that have children).
  // Uses composite keys (e.g. "parentId:childId") at depth > 0 so each
  // ancestor path has its own independent set of children.
  const relationships: Record<string, Record<string, RelationshipEntry[]>> = {};

  if (activeLevels.length > 1) {
    // Sequential by level so each level can build on the parent's composite keys
    for (let li = 0; li < activeLevels.length - 1; li++) {
      const level = activeLevels[li];
      const relsByKey: Record<string, RelationshipEntry[]> = {};

      if (li === 0) {
        // Top level: key = item.id (no composite needed)
        await Promise.all(
          (items[level.id] ?? []).map(async (item) => {
            const snap = await childrenCol(item.id).get();
            let children: RelationshipEntry[] = snap.docs.map((doc) => ({
              childItemId: doc.id,
              ...(doc.data() as Omit<RelationshipEntry, "childItemId">),
            }));
            if (publishedOnly) children = children.filter((c) => c.published);
            children.sort((a, b) => a.order - b.order);
            relsByKey[item.id] = children;
          }),
        );
      } else {
        // Deeper levels: composite key = ancestorKey:childItemId
        const parentLevelRels = relationships[activeLevels[li - 1].id] ?? {};
        await Promise.all(
          Object.entries(parentLevelRels).flatMap(([ancestorKey, children]) =>
            children.map(async (rel) => {
              const compositeKey = `${ancestorKey}:${rel.childItemId}`;
              const snap = await childrenCol(compositeKey).get();
              let kids: RelationshipEntry[] = snap.docs.map((doc) => ({
                childItemId: doc.id,
                ...(doc.data() as Omit<RelationshipEntry, "childItemId">),
              }));
              if (publishedOnly) kids = kids.filter((c) => c.published);
              kids.sort((a, b) => a.order - b.order);
              relsByKey[compositeKey] = kids;
            }),
          ),
        );
      }

      relationships[level.id] = relsByKey;
    }
  }

  // Load steps for items at the last active level
  const steps: Record<string, Step[]> = {};

  if (activeLevels.length > 0) {
    const lastLevel = activeLevels[activeLevels.length - 1];

    await Promise.all(
      (items[lastLevel.id] ?? []).map(async (item) => {
        const snap = await stepsCol(item.id).get();
        steps[item.id] = snap.docs
          .map((doc) => toStep(doc.id, doc.data()))
          .sort((a, b) => a.order - b.order);
      }),
    );
  }

  return {
    hierarchyConfigured: true,
    hierarchy,
    appSettings,
    homepageTitle,
    homepageDescription,
    items,
    relationships,
    steps,
    deletedItems,
  };
}

export async function getHierarchyConfig(): Promise<HierarchyConfig> {
  const snap = await db.collection("settings").doc("hierarchy").get();
  if (!snap.exists) return { levels: [] };
  return (snap.data() as { levels: Level[] }) ?? { levels: [] };
}

// ============= PREVIEW TOKENS =============

export async function validatePreviewToken(token: string): Promise<boolean> {
  const snap = await db.collection("previewTokens").doc(token).get();
  if (!snap.exists) return false;
  const data = snap.data() as { expiresAt?: { toMillis?: () => number } | Date };
  if (!data?.expiresAt) return false;
  const expiresMs =
    typeof (data.expiresAt as { toMillis?: () => number }).toMillis === "function"
      ? (data.expiresAt as { toMillis: () => number }).toMillis()
      : (data.expiresAt as Date).getTime?.() ?? 0;
  return Date.now() < expiresMs;
}

export async function createPreviewToken(): Promise<string> {
  const existing = await db.collection("previewTokens").get();
  const batch = db.batch();
  existing.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  const ref = db.collection("previewTokens").doc();
  await ref.set({
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
  });
  return ref.id;
}

// ============= ITEMS =============

export async function addItem(
  levelId: string,
  name: string,
  description?: string,
  thumbnailDataUrl?: string,
  modifiedBy?: string,
): Promise<TutorialState> {
  const ref = itemsCol(levelId).doc();
  const thumbnailUrl = await resolveImageUrl(thumbnailDataUrl, `${levelId}/${ref.id}/thumbnail`);

  await ref.set({
    name,
    description: description ?? "",
    thumbnailUrl,
    slug: generateSlug(name),
    published: false,
    createdAt: FieldValue.serverTimestamp(),
    lastModified: FieldValue.serverTimestamp(),
    modifiedBy: modifiedBy ?? "system",
  });

  return getTutorialState();
}

export async function updateItem(
  levelId: string,
  itemId: string,
  updates: { name?: string; description?: string; thumbnailDataUrl?: string; published?: boolean },
  modifiedBy?: string,
): Promise<TutorialState> {
  const fields: Record<string, unknown> = {
    lastModified: FieldValue.serverTimestamp(),
    modifiedBy: modifiedBy ?? "system",
  };

  if (updates.name !== undefined) {
    fields.name = updates.name;
    fields.slug = generateSlug(updates.name);
  }
  if (updates.description !== undefined) fields.description = updates.description;
  if (updates.published !== undefined) fields.published = updates.published;
  if (updates.thumbnailDataUrl !== undefined) {
    fields.thumbnailUrl = await resolveImageUrl(
      updates.thumbnailDataUrl,
      `${levelId}/${itemId}/thumbnail`,
    );
    // A newly uploaded image invalidates the old description
    if (updates.thumbnailDataUrl.startsWith("data:")) fields.thumbnailAlt = FieldValue.delete();
  }

  await itemsCol(levelId).doc(itemId).update(fields);
  return getTutorialState();
}

export async function deleteItem(
  levelId: string,
  itemId: string,
  modifiedBy?: string,
): Promise<TutorialState> {
  const snap = await itemsCol(levelId).doc(itemId).get();
  if (!snap.exists) return getTutorialState();

  const location = await resolveDeleteLocation(levelId, itemId);

  await db.collection("deletedItems").doc().set({
    originalId: itemId,
    type: levelId,
    name: (snap.data() as { name?: string }).name ?? "",
    ...(location ? { location } : {}),
    deletedAt: FieldValue.serverTimestamp(),
    deletedBy: modifiedBy ?? "system",
    data: snap.data() ?? {},
  });

  await itemsCol(levelId).doc(itemId).delete();
  return getTutorialState();
}

// ============= RELATIONSHIPS =============

export async function linkItem(
  _parentLevelId: string,
  parentItemId: string,
  childLevelId: string,
  childItemId: string,
): Promise<TutorialState> {
  const snap = await childrenCol(parentItemId).get();
  const maxOrder = snap.docs.reduce(
    (max, doc) => Math.max(max, (doc.data().order as number) ?? 0),
    -1,
  );

  await childrenCol(parentItemId).doc(childItemId).set({
    childLevelId,
    published: false,
    order: maxOrder + 1,
  });

  return getTutorialState();
}

export async function unlinkItem(
  _parentLevelId: string,
  parentItemId: string,
  childItemId: string,
): Promise<TutorialState> {
  await childrenCol(parentItemId).doc(childItemId).delete();
  return getTutorialState();
}

export async function updateRelationship(
  _parentLevelId: string,
  parentItemId: string,
  childItemId: string,
  published: boolean,
): Promise<TutorialState> {
  await childrenCol(parentItemId).doc(childItemId).update({ published });
  return getTutorialState();
}

export async function removeInvalidChildren(
  _parentLevelId: string,
  parentItemId: string,
): Promise<TutorialState> {
  const snap = await childrenCol(parentItemId).get();
  const batch = db.batch();

  await Promise.all(
    snap.docs.map(async (doc) => {
      const { childLevelId } = doc.data() as { childLevelId: string };
      const childSnap = await itemsCol(childLevelId).doc(doc.id).get();
      if (!childSnap.exists) batch.delete(doc.ref);
    }),
  );

  await batch.commit();
  return getTutorialState();
}

// ============= STEPS =============

// Uploads any new (data URL) images and keeps existing URLs as they are. Each
// upload gets its own unique file name so reordering or removing images can
// never overwrite a file another image still points at.
async function resolveStepImages(
  parentItemId: string,
  stepId: string,
  imageDataUrls: string[],
): Promise<string[]> {
  const urls = await Promise.all(
    imageDataUrls.map((value) =>
      resolveImageUrl(value, `steps/${parentItemId}/${stepId}/image-${randomUUID().slice(0, 8)}`),
    ),
  );
  return urls.filter(Boolean);
}

type StepMeta = { id: string; order: number; stepType: "main" | "sub"; parentStepId: string | null };

async function fetchStepMetas(parentItemId: string): Promise<StepMeta[]> {
  const snap = await stepsCol(parentItemId).get();
  return snap.docs
    .map((doc) => ({
      id: doc.id,
      order: (doc.data().order as number) ?? 0,
      stepType: (doc.data().stepType === "sub" ? "sub" : "main") as "main" | "sub",
      parentStepId: (doc.data().parentStepId as string | null) ?? null,
    }))
    .sort((a, b) => a.order - b.order);
}

// Index right after `parentId`'s contiguous run of sub-steps in an
// order-sorted list (or the parent's own position + 1 if it has none yet).
function blockEndIndex(list: StepMeta[], parentId: string): number {
  const parentIdx = list.findIndex((s) => s.id === parentId);
  if (parentIdx < 0) return list.length;
  let end = parentIdx + 1;
  while (end < list.length && list[end].stepType === "sub" && list[end].parentStepId === parentId) end++;
  return end;
}

export async function addStep(
  parentItemId: string,
  title: string,
  contentHtml: string,
  imageDataUrls: string[],
  videoUrl: string | undefined,
  stepType: "main" | "sub",
  parentStepId: string | null,
  modifiedBy?: string,
): Promise<TutorialState> {
  const existing = await fetchStepMetas(parentItemId);
  const parent = parentStepId ? existing.find((s) => s.id === parentStepId) : undefined;
  if (stepType === "sub" && (!parent || parent.stepType !== "main")) {
    throw new Error("Sub-step parent must be an existing main step.");
  }
  const isSub = stepType === "sub";
  // A sub-step goes at the end of its parent's block; a main step goes at the very end
  const insertAt = isSub ? blockEndIndex(existing, parentStepId!) : existing.length;

  const ref = stepsCol(parentItemId).doc();
  const imageUrls = await resolveStepImages(parentItemId, ref.id, imageDataUrls);

  const batch = db.batch();
  existing.slice(insertAt).forEach((step, i) => {
    batch.update(stepsCol(parentItemId).doc(step.id), { order: insertAt + i + 1 });
  });
  batch.set(ref, {
    title,
    contentHtml,
    imageUrls,
    imageAlts: imageUrls.map(() => null),
    videoUrl: videoUrl ?? "",
    stepType: isSub ? "sub" : "main",
    parentStepId: isSub ? parentStepId : null,
    order: insertAt,
    createdAt: FieldValue.serverTimestamp(),
    lastModified: FieldValue.serverTimestamp(),
    modifiedBy: modifiedBy ?? "system",
  });
  await batch.commit();

  return getTutorialState();
}

export async function updateStep(
  parentItemId: string,
  stepId: string,
  updates: {
    title?: string;
    contentHtml?: string;
    imageDataUrls?: string[];
    videoUrl?: string;
    stepType?: "main" | "sub";
    parentStepId?: string | null;
  },
  modifiedBy?: string,
): Promise<TutorialState> {
  const fields: Record<string, unknown> = {
    lastModified: FieldValue.serverTimestamp(),
    modifiedBy: modifiedBy ?? "system",
  };

  if (updates.title !== undefined) fields.title = updates.title;
  if (updates.contentHtml !== undefined) fields.contentHtml = updates.contentHtml;
  if (updates.videoUrl !== undefined) fields.videoUrl = updates.videoUrl;
  if (updates.imageDataUrls !== undefined) {
    const current = await stepsCol(parentItemId).doc(stepId).get();
    const before = current.exists ? toStep(stepId, current.data() ?? {}) : null;
    // An image that is kept (same URL) keeps its alt text, wherever it moves to.
    // A newly uploaded image gets a new URL, so its alt text starts out unreviewed.
    const altByUrl = new Map((before?.imageUrls ?? []).map((url, i) => [url, before!.imageAlts[i]]));
    const imageUrls = await resolveStepImages(parentItemId, stepId, updates.imageDataUrls);
    fields.imageUrls = imageUrls;
    fields.imageAlts = imageUrls.map((url) => altByUrl.get(url) ?? null);
    fields.imageUrl = FieldValue.delete();
    fields.imageAlt = FieldValue.delete();
  }

  const existing = await fetchStepMetas(parentItemId);
  const currentIdx = existing.findIndex((s) => s.id === stepId);
  if (currentIdx < 0) return getTutorialState();
  const current = existing[currentIdx];

  const nextStepType = updates.stepType ?? current.stepType;
  const nextParentStepId = nextStepType === "sub" ? (updates.parentStepId ?? current.parentStepId) : null;

  // The dialog always sends stepType/parentStepId, even when they are unchanged.
  // Only reposition when they actually differ from the stored values, or every
  // plain content edit would bump the step to the end of its block.
  const changingStructure = nextStepType !== current.stepType || nextParentStepId !== current.parentStepId;
  if (!changingStructure) {
    await stepsCol(parentItemId).doc(stepId).update(fields);
    return getTutorialState();
  }

  if (nextStepType === "sub") {
    if (!nextParentStepId || nextParentStepId === stepId) {
      throw new Error("A sub-step requires a different step as its parent.");
    }
    const parent = existing.find((s) => s.id === nextParentStepId);
    if (!parent || parent.stepType !== "main") {
      throw new Error("Sub-step parent must be an existing main step.");
    }
    const hasOwnSubSteps = existing.some((s) => s.stepType === "sub" && s.parentStepId === stepId);
    if (hasOwnSubSteps) {
      throw new Error("A step with its own sub-steps cannot become a sub-step.");
    }
  }

  fields.stepType = nextStepType;
  fields.parentStepId = nextParentStepId;

  const withoutMoved = existing.filter((s) => s.id !== stepId);
  const insertAt = nextStepType === "sub"
    ? blockEndIndex(withoutMoved, nextParentStepId!)
    : Math.min(currentIdx, withoutMoved.length);

  const batch = db.batch();
  withoutMoved.forEach((step, i) => {
    const order = i < insertAt ? i : i + 1;
    if (order !== step.order) batch.update(stepsCol(parentItemId).doc(step.id), { order });
  });
  batch.update(stepsCol(parentItemId).doc(stepId), { ...fields, order: insertAt });
  await batch.commit();

  return getTutorialState();
}

export async function deleteStep(
  parentItemId: string,
  stepId: string,
  modifiedBy?: string,
): Promise<TutorialState> {
  const snap = await stepsCol(parentItemId).doc(stepId).get();
  if (!snap.exists) return getTutorialState();

  // Resolve the parent item (last-level) name then walk up the hierarchy
  const hierSnap = await db.collection("settings").doc("hierarchy").get();
  const allLevels = hierSnap.exists
    ? ((hierSnap.data() as { levels: Level[] }).levels ?? []).filter((l) => l.enabled).sort((a, b) => a.order - b.order)
    : [];
  const lastLevel = allLevels.length > 0 ? allLevels[allLevels.length - 1] : null;
  const parentDoc = lastLevel ? await itemsCol(lastLevel.id).doc(parentItemId).get() : null;
  const parentName = (parentDoc?.data() as { name?: string } | undefined)?.name ?? parentItemId;
  const location = lastLevel
    ? await resolveDeleteLocation(lastLevel.id, parentItemId, parentName)
    : parentName;

  // Deleting a main step also removes its sub-steps, since they have no
  // meaning without their parent. Each is soft-deleted independently, so
  // they can be restored individually from the deleted-items bin.
  const allSteps = await fetchStepMetas(parentItemId);
  const subStepIds = allSteps.filter((s) => s.stepType === "sub" && s.parentStepId === stepId).map((s) => s.id);
  const subSnaps = await Promise.all(subStepIds.map((id) => stepsCol(parentItemId).doc(id).get()));

  const batch = db.batch();
  for (const targetSnap of [snap, ...subSnaps]) {
    if (!targetSnap.exists) continue;
    batch.set(db.collection("deletedItems").doc(), {
      originalId: targetSnap.id,
      type: "step",
      parentId: parentItemId,
      name: (targetSnap.data() as { title?: string }).title ?? "",
      ...(location ? { location } : {}),
      deletedAt: FieldValue.serverTimestamp(),
      deletedBy: modifiedBy ?? "system",
      data: targetSnap.data() ?? {},
    });
    batch.delete(stepsCol(parentItemId).doc(targetSnap.id));
  }
  await batch.commit();

  return getTutorialState();
}

export async function reorderStep(
  parentItemId: string,
  stepId: string,
  direction: "up" | "down",
): Promise<TutorialState> {
  const snap = await stepsCol(parentItemId).get();
  const steps = snap.docs
    .map((doc) => ({ id: doc.id, order: (doc.data().order as number) ?? 0 }))
    .sort((a, b) => a.order - b.order);

  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx < 0) return getTutorialState();

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= steps.length) return getTutorialState();

  const batch = db.batch();
  batch.update(stepsCol(parentItemId).doc(steps[idx].id), { order: steps[swapIdx].order });
  batch.update(stepsCol(parentItemId).doc(steps[swapIdx].id), { order: steps[idx].order });
  await batch.commit();

  return getTutorialState();
}

// Reorders whole main-step blocks (a main step plus its contiguous
// sub-steps) relative to other main-step blocks. `newBlockIndex` counts
// main-step blocks only, not individual steps.
export async function reorderMainStep(
  parentItemId: string,
  stepId: string,
  newBlockIndex: number,
): Promise<TutorialState> {
  const steps = await fetchStepMetas(parentItemId);

  const blocks: StepMeta[][] = [];
  const blockIndexByMainId = new Map<string, number>();
  for (const step of steps) {
    if (step.stepType === "sub" && step.parentStepId && blockIndexByMainId.has(step.parentStepId)) {
      blocks[blockIndexByMainId.get(step.parentStepId)!].push(step);
    } else {
      blockIndexByMainId.set(step.id, blocks.length);
      blocks.push([step]);
    }
  }

  const currentBlockIdx = blocks.findIndex((b) => b[0].id === stepId);
  if (currentBlockIdx < 0) return getTutorialState();

  const reorderedBlocks = [...blocks];
  const [movedBlock] = reorderedBlocks.splice(currentBlockIdx, 1);
  reorderedBlocks.splice(Math.max(0, Math.min(newBlockIndex, reorderedBlocks.length)), 0, movedBlock);

  const batch = db.batch();
  let order = 0;
  for (const block of reorderedBlocks) {
    for (const step of block) {
      if (step.order !== order) batch.update(stepsCol(parentItemId).doc(step.id), { order });
      order += 1;
    }
  }
  await batch.commit();

  return getTutorialState();
}

// Moves a sub-step to a specific position within a main step's sub-step
// list, possibly re-parenting it to a different main step in the process.
export async function reorderSubStep(
  parentItemId: string,
  stepId: string,
  newParentStepId: string,
  newIndexWithinParent: number,
): Promise<TutorialState> {
  const steps = await fetchStepMetas(parentItemId);

  const moved = steps.find((s) => s.id === stepId);
  const newParent = steps.find((s) => s.id === newParentStepId);
  if (!moved || !newParent || newParent.stepType !== "main") return getTutorialState();

  const withoutMoved = steps.filter((s) => s.id !== stepId);
  const parentIdx = withoutMoved.findIndex((s) => s.id === newParentStepId);
  const blockEnd = blockEndIndex(withoutMoved, newParentStepId);
  const insertAt = Math.max(parentIdx + 1, Math.min(parentIdx + 1 + newIndexWithinParent, blockEnd));

  const batch = db.batch();
  withoutMoved.forEach((step, i) => {
    const order = i < insertAt ? i : i + 1;
    if (order !== step.order) batch.update(stepsCol(parentItemId).doc(step.id), { order });
  });
  batch.update(stepsCol(parentItemId).doc(stepId), {
    order: insertAt,
    stepType: "sub",
    parentStepId: newParentStepId,
    lastModified: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  return getTutorialState();
}

// ============= ALT TEXT =============

export type AltTextEntry =
  | { kind: "item-thumbnail"; levelId: string; itemId: string; alt: string }
  // A step can hold several images, so the image is identified by its URL
  | { kind: "step-image"; parentItemId: string; stepId: string; imageUrl: string; alt: string };

const BATCH_LIMIT = 400; // Firestore caps batches at 500 writes

export async function applyAltText(
  entries: AltTextEntry[],
  modifiedBy?: string,
): Promise<TutorialState> {
  const fields = () => ({
    lastModified: FieldValue.serverTimestamp(),
    modifiedBy: modifiedBy ?? "system",
  });

  const thumbnails = entries.filter((e) => e.kind === "item-thumbnail");
  for (let i = 0; i < thumbnails.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const entry of thumbnails.slice(i, i + BATCH_LIMIT)) {
      if (entry.kind !== "item-thumbnail") continue;
      batch.update(itemsCol(entry.levelId).doc(entry.itemId), { ...fields(), thumbnailAlt: entry.alt });
    }
    await batch.commit();
  }

  // Group image entries by step so each step is read and written once
  const byStep = new Map<string, { parentItemId: string; stepId: string; alts: Map<string, string> }>();
  for (const entry of entries) {
    if (entry.kind !== "step-image") continue;
    const key = `${entry.parentItemId}:${entry.stepId}`;
    const group = byStep.get(key) ?? { parentItemId: entry.parentItemId, stepId: entry.stepId, alts: new Map() };
    group.alts.set(entry.imageUrl, entry.alt);
    byStep.set(key, group);
  }

  const groups = Array.from(byStep.values());
  for (let i = 0; i < groups.length; i += BATCH_LIMIT) {
    const chunk = groups.slice(i, i + BATCH_LIMIT);
    const snaps = await Promise.all(chunk.map((g) => stepsCol(g.parentItemId).doc(g.stepId).get()));
    const batch = db.batch();
    chunk.forEach((group, j) => {
      const snap = snaps[j];
      if (!snap.exists) return;
      const step = toStep(group.stepId, snap.data() ?? {});
      // Match by URL, so an image that was replaced or moved since the review is never mislabelled
      const imageAlts = step.imageUrls.map((url, k) => group.alts.get(url) ?? step.imageAlts[k]);
      batch.update(snap.ref, { ...fields(), imageUrls: step.imageUrls, imageAlts, imageUrl: FieldValue.delete(), imageAlt: FieldValue.delete() });
    });
    await batch.commit();
  }

  return getTutorialState();
}

// ============= SOFT-DELETE BIN =============

export async function restoreDeletedItem(deletedItemId: string): Promise<TutorialState> {
  const snap = await db.collection("deletedItems").doc(deletedItemId).get();
  if (!snap.exists) return getTutorialState();

  const deleted = snap.data() as DeletedItem;

  if (deleted.type === "step") {
    if (!deleted.parentId) return getTutorialState();
    await stepsCol(deleted.parentId).doc(deleted.originalId).set(deleted.data);
  } else {
    await itemsCol(deleted.type).doc(deleted.originalId).set(deleted.data);
  }

  await db.collection("deletedItems").doc(deletedItemId).delete();
  return getTutorialState();
}

export async function permanentlyDeleteItem(deletedItemId: string): Promise<TutorialState> {
  await db.collection("deletedItems").doc(deletedItemId).delete();
  return getTutorialState();
}

// ============= SETTINGS =============

export async function updateHomepageSettings(title: string, description: string): Promise<void> {
  await db.collection("settings").doc("homepage").set({ title, description }, { merge: true });
}

export async function updateLevelSettings(
  levelId: string,
  sectionTitle: string,
  sectionSubtitle: string,
): Promise<void> {
  const snap = await db.collection("settings").doc("hierarchy").get();
  if (!snap.exists) return;

  const data = snap.data() as { levels: Level[] };
  const updatedLevels = data.levels.map((level) =>
    level.id === levelId ? { ...level, sectionTitle, sectionSubtitle } : level,
  );

  await db.collection("settings").doc("hierarchy").update({ levels: updatedLevels });
}

export async function updateAppSettings(settings: Partial<AppSettings>): Promise<void> {
  await db.collection("settings").doc("appSettings").set(settings, { merge: true });
}

// Used by GET /api/tutorial to allow admins to see unpublished content
export async function isActiveAdmin(idToken: string): Promise<boolean> {
  try {
    const { auth } = await import("./firebase-admin");
    const decoded = await auth.verifyIdToken(idToken);
    if ((decoded.role as string | undefined) !== "admin") return false;
    const adminDoc = await adminDb.collection("admins").doc(decoded.uid).get();
    return (adminDoc.data() as { active?: boolean } | undefined)?.active === true;
  } catch {
    return false;
  }
}
