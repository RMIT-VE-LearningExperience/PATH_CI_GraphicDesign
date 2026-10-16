/** Collect exact object paths from current/legacy fields and rich-text HTML. */
export function collectStoragePaths(
  value: unknown,
  bucket: string,
  prefix: string,
  paths = new Set<string>(),
): Set<string> {
  if (Array.isArray(value)) {
    for (const child of value) collectStoragePaths(child, bucket, prefix, paths);
  } else if (value && typeof value === "object") {
    for (const child of Object.values(value)) collectStoragePaths(child, bucket, prefix, paths);
  } else if (typeof value === "string") {
    for (const match of value.matchAll(/https:\/\/[^\s<>"']+/g)) {
      try {
        const url = new URL(match[0].replace(/&amp;/g, "&"));
        let path: string | undefined;
        if (url.hostname === "firebasestorage.googleapis.com") {
          const parts = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
          if (parts && decodeURIComponent(parts[1]) === bucket) path = decodeURIComponent(parts[2]);
        } else if (url.hostname === "storage.googleapis.com") {
          const parts = url.pathname.match(/^\/([^/]+)\/(.+)$/);
          if (parts && decodeURIComponent(parts[1]) === bucket) path = decodeURIComponent(parts[2]);
        }
        if (path?.startsWith(prefix)) paths.add(path);
      } catch {
        // Ignore malformed/external URLs; they cannot identify a bucket object.
      }
    }
  }
  return paths;
}
