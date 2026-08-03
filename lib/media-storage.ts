import { randomUUID } from "crypto";

import { bucket } from "./firebase-admin";

const DATA_URL_REGEX = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;
const STORAGE_PREFIX = process.env.STORAGE_PATH_PREFIX;

function prefixedPath(path: string): string {
  return STORAGE_PREFIX ? `${STORAGE_PREFIX}/${path}` : path;
}

function toDownloadUrl(path: string, token: string): string {
  const encodedPath = encodeURIComponent(prefixedPath(path));
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
}

export async function resolveImageUrl(value: string | undefined, path: string): Promise<string> {
  const input = (value ?? "").trim();

  if (!input) {
    return ""; // Return empty string for optional images
  }

  if (input.startsWith("http://") || input.startsWith("https://")) {
    return input;
  }

  const matched = input.match(DATA_URL_REGEX);
  if (!matched) {
    throw new Error("Image must be a valid URL or data URL.");
  }

  const contentType = matched[1];
  const base64Payload = matched[2];
  const buffer = Buffer.from(base64Payload, "base64");
  const token = randomUUID();
  const file = bucket.file(prefixedPath(path));

  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: {
      cacheControl: "public,max-age=31536000,immutable",
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  return toDownloadUrl(path, token);
}
