import { STEP_SECTIONS, stepLabels } from "./step-groups";
import { getTutorialState, type TutorialState } from "./tutorial-store";
import { fetchImageAsDataUrl, getValModel, valChatCompletion, type ValMessage } from "./val-client";

// ============= TYPES =============

export type AltTextProposal = {
  // Globally unique image key: "item:<levelId>:<itemId>" or
  // "step:<parentItemId>:<stepId>:<imageIndex>" (step ids alone are NOT unique — they
  // repeat across parent items — and a step can hold several images)
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

  // Step images belong to the printer (overview) or the product (everything else)
  if (!filters.levelId) {
    const itemById = new Map<string, { name: string; levelName: string }>();
    for (const level of levels) {
      for (const item of state.items[level.id] ?? []) itemById.set(item.id, { name: item.name, levelName: level.singularName });
    }
    const tabLabels = state.appSettings.stepTabs;

    for (const [parentItemId, allSteps] of Object.entries(state.steps)) {
      if (filters.parentItemId && parentItemId !== filters.parentItemId) continue;
      const parent = itemById.get(parentItemId);
      const parentLabel = parent ? `${parent.levelName} "${parent.name}"` : "an unknown item";

      for (const section of STEP_SECTIONS) {
        const steps = allSteps.filter((step) => step.section === section);
        // Only the Steps tab is numbered; the other tabs list plain titled entries
        const labels = section === "steps" ? stepLabels(steps) : new Map<string, string>();
        const sectionPrefix = section === "steps" ? "" : `${tabLabels[section]} → `;

        steps.forEach((step) => {
          const label = labels.get(step.id);
          const noun = section === "steps" ? (step.stepType === "sub" ? "Sub-step" : "Step") : (step.stepType === "sub" ? "Sub-item" : "Item");
          const heading = label ? `${noun} ${label}: ${step.title}` : `${noun}: ${step.title}`;
          step.imageUrls.forEach((imageUrl, imageIndex) => {
            const imageLabel = step.imageUrls.length > 1 ? ` (image ${imageIndex + 1} of ${step.imageUrls.length})` : "";
            targets.push({
              key: `step:${parentItemId}:${step.id}:${imageIndex}`,
              kind: "step-image",
              parentItemId,
              stepId: step.id,
              name: step.title,
              location: `${parent?.name ?? parentItemId} → ${sectionPrefix}${heading}${imageLabel}`,
              imageUrl,
              context: [
                section === "steps"
                  ? `This image illustrates ${noun.toLowerCase()} ${label}, titled "${step.title}", in the guide for ${parentLabel}.`
                  : `This image is in the "${tabLabels[section]}" section, in an entry titled "${step.title}", for ${parentLabel}.`,
                step.imageUrls.length > 1 ? `The entry has ${step.imageUrls.length} images; this is image ${imageIndex + 1}.` : "",
                `Text: ${truncate(stripHtml(step.contentHtml), 500)}`,
              ].filter(Boolean).join("\n"),
            });
          });
        });
      }
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
