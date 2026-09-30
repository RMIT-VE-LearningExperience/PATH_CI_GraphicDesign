import { getTutorialState, type Level, type TutorialState } from "./tutorial-store";
import { fetchImageAsDataUrl, getValModel, valChatCompletion, type ValMessage } from "./val-client";

// ============= TYPES =============

export type AltTextProposal = {
  // Globally unique image key: "item:<levelId>:<itemId>" or "step:<parentItemId>:<stepId>"
  // (step ids alone are NOT unique — they repeat across parent items)
  key: string;
  kind: "item-thumbnail" | "step-image";
  levelId?: string;
  itemId?: string;
  parentItemId?: string;
  stepId?: string;
  name: string;
  location: string;
  imageUrl: string;
  proposedAlt: string;
  needsAttention?: string;
};

export type SkippedImage = {
  key: string;
  kind: AltTextProposal["kind"];
  name: string;
  location: string;
  imageUrl: string;
  reason: string;
};

export type AltTextReviewResult = {
  model: string;
  reviewed: number;
  proposals: AltTextProposal[];
  skipped: SkippedImage[];
};

export type AltTextReviewFilters = {
  levelId?: string;
  parentItemId?: string;
  // Restrict to specific images by their unique key (see AltTextProposal.key)
  ids?: string[];
  limit?: number;
};

export type AltTextReviewOptions = {
  // Per-request VAL key supplied by the caller; falls back to VAL_API_KEY env
  apiKey?: string;
};

type ReviewTarget = Omit<AltTextProposal, "proposedAlt" | "needsAttention"> & {
  context: string;
};

// ============= PROMPTS =============

const SYSTEM_PROMPT = `You are an accessibility specialist reviewing images in an educational step-by-step guide used by RMIT University students. For each image, propose alt text that meets WCAG 2.2 guidance:

- Be concise: aim for under 125 characters.
- Never start with "Image of", "Photo of", or "Picture of".
- Use the surrounding content context to describe what matters for a student following the guide, not every visual detail.
- For screenshots of software, name the application, panel, and the settings or values shown.
- If the image contains important text, that text must be conveyed in the alt.
- If the image is purely decorative or fully redundant with adjacent text (e.g. a thumbnail next to the same visible name), propose a minimal alt and note this in needsAttention.
- Use Australian English spelling.

Respond with JSON: {"proposedAlt": string, "needsAttention": string (optional — only for issues an editor should check, such as low image quality, ambiguity, or likely-decorative images)}.`;

const RESPONSE_SCHEMA = {
  name: "alt_text_proposal",
  schema: {
    type: "object",
    properties: {
      proposedAlt: { type: "string" },
      needsAttention: { type: "string" },
    },
    required: ["proposedAlt"],
  },
};

// ============= HELPERS =============

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// ============= TARGET COLLECTION =============

function collectTargets(state: TutorialState, filters: AltTextReviewFilters): ReviewTarget[] {
  const targets: ReviewTarget[] = [];
  const levels = state.hierarchy.levels
    .filter((l) => l.enabled)
    .sort((a, b) => a.order - b.order);
  const levelById = new Map<string, Level>(levels.map((l) => [l.id, l]));
  const lastLevel = levels[levels.length - 1];

  // Item thumbnails (skipped when reviewing a single item's steps)
  if (!filters.parentItemId) {
    for (const level of levels) {
      if (filters.levelId && level.id !== filters.levelId) continue;
      for (const item of state.items[level.id] ?? []) {
        if (!item.thumbnailUrl) continue;
        targets.push({
          key: `item:${level.id}:${item.id}`,
          kind: "item-thumbnail",
          levelId: level.id,
          itemId: item.id,
          name: item.name,
          location: `${level.name} → ${item.name}`,
          imageUrl: item.thumbnailUrl,
          context: [
            `This is the thumbnail for the ${level.singularName.toLowerCase()} "${item.name}", shown in a selection list titled "${level.sectionTitle ?? level.name}". The name "${item.name}" is displayed as visible text next to the thumbnail.`,
            item.description ? `Description: ${truncate(stripHtml(item.description), 300)}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        });
      }
    }
  }

  // Step images belong to items at the last level
  if (!filters.levelId && lastLevel) {
    const lastLevelItems = new Map(
      (state.items[lastLevel.id] ?? []).map((item) => [item.id, item]),
    );
    for (const [parentItemId, steps] of Object.entries(state.steps)) {
      if (filters.parentItemId && parentItemId !== filters.parentItemId) continue;
      const parent = lastLevelItems.get(parentItemId);
      const parentLabel = parent
        ? `${levelById.get(lastLevel.id)?.singularName ?? "Item"} "${parent.name}"`
        : "an unknown item";

      steps.forEach((step, index) => {
        if (!step.imageUrl) return;
        targets.push({
          key: `step:${parentItemId}:${step.id}`,
          kind: "step-image",
          parentItemId,
          stepId: step.id,
          name: step.title,
          location: `${parent?.name ?? parentItemId} → Step ${index + 1}: ${step.title}`,
          imageUrl: step.imageUrl,
          context: [
            `This image illustrates step ${index + 1} of ${steps.length}, titled "${step.title}", in the guide for ${parentLabel}.`,
            `Step text: ${truncate(stripHtml(step.contentHtml), 500)}`,
          ].join("\n"),
        });
      });
    }
  }

  let filtered = targets;
  if (filters.ids?.length) {
    const ids = new Set(filters.ids);
    filtered = filtered.filter((t) => ids.has(t.key));
  }
  return typeof filters.limit === "number" && filters.limit > 0
    ? filtered.slice(0, filters.limit)
    : filtered;
}

// ============= REVIEW =============

async function proposeAltText(
  target: ReviewTarget,
  options: AltTextReviewOptions,
): Promise<AltTextProposal> {
  const imageDataUrl = await fetchImageAsDataUrl(target.imageUrl);

  const messages: ValMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "text", text: `${target.context}\n\nPropose alt text for this image.` },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    },
  ];

  const raw = await valChatCompletion(messages, {
    jsonSchema: RESPONSE_SCHEMA,
    apiKey: options.apiKey,
  });
  const parsed = JSON.parse(raw) as { proposedAlt?: unknown; needsAttention?: unknown };
  // An empty string is a valid proposal: it marks the image as decorative
  if (typeof parsed.proposedAlt !== "string") {
    throw new Error("VAL response missing proposedAlt");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { context, ...rest } = target;
  return {
    ...rest,
    proposedAlt: parsed.proposedAlt,
    ...(typeof parsed.needsAttention === "string" && parsed.needsAttention
      ? { needsAttention: parsed.needsAttention }
      : {}),
  };
}

const CONCURRENCY = 3;

export async function reviewContentImages(
  filters: AltTextReviewFilters = {},
  options: AltTextReviewOptions = {},
): Promise<AltTextReviewResult> {
  const state = await getTutorialState(false);
  const targets = collectTargets(state, filters);

  const proposals: AltTextProposal[] = [];
  const skipped: SkippedImage[] = [];

  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, async () => {
      while (next < targets.length) {
        const target = targets[next++];
        try {
          proposals.push(await proposeAltText(target, options));
        } catch (error) {
          skipped.push({
            key: target.key,
            kind: target.kind,
            name: target.name,
            location: target.location,
            imageUrl: target.imageUrl,
            reason: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }),
  );

  // Restore content order (concurrent completion shuffles results)
  const order = new Map(targets.map((t, i) => [t.key, i]));
  proposals.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));

  return {
    model: getValModel(),
    reviewed: targets.length,
    proposals,
    skipped,
  };
}
