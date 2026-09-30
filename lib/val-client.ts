// Client for RMIT VAL (OpenAI-compatible chat completions API).
// Connection details mirror the h5p Creator integration: Bearer key auth
// against https://val-npe.rmit.edu.au/api.

const VAL_BASE_URL = process.env.VAL_BASE_URL || "https://val-npe.rmit.edu.au/api";
const VAL_MODEL = process.env.VAL_MODEL || "gpt-5.6-sol";
const VAL_REASONING_EFFORT = process.env.VAL_REASONING_EFFORT || "low";

const REQUEST_TIMEOUT_MS = 90_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export type ValContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ValMessage = {
  role: "system" | "user" | "assistant";
  content: string | ValContentPart[];
};

export type ValJsonSchema = {
  name: string;
  schema: Record<string, unknown>;
};

export function getValModel(): string {
  return VAL_MODEL;
}

export async function valChatCompletion(
  messages: ValMessage[],
  options?: { jsonSchema?: ValJsonSchema; model?: string; apiKey?: string },
): Promise<string> {
  // A per-request key (entered by the admin in the GUI) takes precedence
  // over the server-configured one; neither is ever persisted server-side.
  const apiKey = options?.apiKey || process.env.VAL_API_KEY;
  if (!apiKey) {
    throw new Error(
      "No VAL API key available — enter your key in the alt-text page or set VAL_API_KEY",
    );
  }

  const model = options?.model || VAL_MODEL;

  const body: Record<string, unknown> = { model, messages };
  // GPT-5.x models on VAL (litellm) expect an explicit reasoning effort
  if (/gpt-5/i.test(model)) {
    body.reasoning_effort = VAL_REASONING_EFFORT;
  }
  if (options?.jsonSchema) {
    body.response_format = { type: "json_schema", json_schema: options.jsonSchema };
  }

  const response = await fetch(`${VAL_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`VAL request failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("VAL returned no text output");
  }
  return content;
}

// Downloads an image and returns it as a base64 data URL suitable for
// VAL's multimodal image_url content parts.
export async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(`Image fetch failed (${response.status})`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Not an image (content-type: ${contentType || "unknown"})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`Image too large (${Math.round(buffer.byteLength / 1024 / 1024)}MB)`);
  }

  return `data:${contentType};base64,${buffer.toString("base64")}`;
}
