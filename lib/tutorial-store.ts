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
  imageUrl: string;
  videoUrl?: string;
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
  location?: string;   // human-readable origin path, e.g. "Printer → Paper"
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
          .map((doc) => ({
            ...(doc.data() as Omit<Step, "id" | "createdAt" | "lastModified">),
            id: doc.id,
            createdAt: toDate(doc.data().createdAt),
            lastModified: toDate(doc.data().lastModified),
          }))
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

export async function addStep(
  parentItemId: string,
  title: string,
  contentHtml: string,
  imageDataUrl: string,
  videoUrl?: string,
  modifiedBy?: string,
): Promise<TutorialState> {
  const snap = await stepsCol(parentItemId).get();
  const maxOrder = snap.docs.reduce(
    (max, doc) => Math.max(max, (doc.data().order as number) ?? 0),
    -1,
  );

  const ref = stepsCol(parentItemId).doc();
  const imageUrl = await resolveImageUrl(imageDataUrl, `steps/${parentItemId}/${ref.id}/image`);

  await ref.set({
    title,
    contentHtml,
    imageUrl,
    videoUrl: videoUrl ?? "",
    order: maxOrder + 1,
    createdAt: FieldValue.serverTimestamp(),
    lastModified: FieldValue.serverTimestamp(),
    modifiedBy: modifiedBy ?? "system",
  });

  return getTutorialState();
}

export async function updateStep(
  parentItemId: string,
  stepId: string,
  updates: { title?: string; contentHtml?: string; imageDataUrl?: string; videoUrl?: string },
  modifiedBy?: string,
): Promise<TutorialState> {
  const fields: Record<string, unknown> = {
    lastModified: FieldValue.serverTimestamp(),
    modifiedBy: modifiedBy ?? "system",
  };

  if (updates.title !== undefined) fields.title = updates.title;
  if (updates.contentHtml !== undefined) fields.contentHtml = updates.contentHtml;
  if (updates.videoUrl !== undefined) fields.videoUrl = updates.videoUrl;
  if (updates.imageDataUrl !== undefined) {
    fields.imageUrl = await resolveImageUrl(
      updates.imageDataUrl,
      `steps/${parentItemId}/${stepId}/image`,
    );
  }

  await stepsCol(parentItemId).doc(stepId).update(fields);
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

  await db.collection("deletedItems").doc().set({
    originalId: stepId,
    type: "step",
    parentId: parentItemId,
    name: (snap.data() as { title?: string }).title ?? "",
    ...(location ? { location } : {}),
    deletedAt: FieldValue.serverTimestamp(),
    deletedBy: modifiedBy ?? "system",
    data: snap.data() ?? {},
  });

  await stepsCol(parentItemId).doc(stepId).delete();
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

export async function setStepOrder(
  parentItemId: string,
  stepId: string,
  newIndex: number,
): Promise<TutorialState> {
  const snap = await stepsCol(parentItemId).get();
  const steps = snap.docs
    .map((doc) => ({ id: doc.id, order: (doc.data().order as number) ?? 0 }))
    .sort((a, b) => a.order - b.order);

  const currentIdx = steps.findIndex((s) => s.id === stepId);
  if (currentIdx < 0) return getTutorialState();

  const reordered = [...steps];
  const [removed] = reordered.splice(currentIdx, 1);
  reordered.splice(Math.max(0, Math.min(newIndex, reordered.length)), 0, removed);

  const batch = db.batch();
  reordered.forEach((step, i) => {
    batch.update(stepsCol(parentItemId).doc(step.id), { order: i });
  });
  await batch.commit();

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
