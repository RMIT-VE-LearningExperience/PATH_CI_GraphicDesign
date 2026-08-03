export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif"];
export const MAX_IMAGE_SIZE_BYTES = 700 * 1024;

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Invalid format. Please upload a JPEG, PNG, or GIF image.";
  }
  if (file.type === "image/gif" && file.size > MAX_IMAGE_SIZE_BYTES) {
    return `GIF too large (${(file.size / 1024).toFixed(0)} KB). Maximum is 700 KB.`;
  }
  return null;
}

export function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      for (let q = 0.85; q >= 0.1; q = Math.round((q - 0.1) * 10) / 10) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        const out = canvas.toDataURL("image/jpeg", q);
        if (out.length <= MAX_IMAGE_SIZE_BYTES) { resolve(out); return; }
      }
      for (let scale = 0.75; scale >= 0.25; scale -= 0.25) {
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const out = canvas.toDataURL("image/jpeg", 0.7);
        if (out.length <= MAX_IMAGE_SIZE_BYTES) { resolve(out); return; }
      }
      canvas.width = Math.round(img.naturalWidth * 0.25);
      canvas.height = Math.round(img.naturalHeight * 0.25);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.5));
    };
    img.src = dataUrl;
  });
}

export async function processUpload(file: File): Promise<{ dataUrl: string; compressed: boolean }> {
  const raw = await toDataUrl(file);
  if (file.type !== "image/gif" && file.size > MAX_IMAGE_SIZE_BYTES) {
    return { dataUrl: await compressImage(raw), compressed: true };
  }
  return { dataUrl: raw, compressed: false };
}
