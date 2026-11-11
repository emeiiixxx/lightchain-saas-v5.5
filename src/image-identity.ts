// Blob URLs change on every upload. Keep a content identity for the session so
// uploading the same file again cannot bypass per-node reference deduplication.
const uploadedImageKeys = new Map<string, string>();

export async function rememberUploadedImageIdentity(url: string, file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  uploadedImageKeys.set(url, Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''));
}

export function imageIdentity(url: string): string {
  return uploadedImageKeys.get(url) ?? url;
}

export function uniqueReferenceImages<T extends { url: string }>(images: T[], existingUrls: string[] = []): T[] {
  const seen = new Set(existingUrls.map(imageIdentity));
  return images.filter(image => {
    const key = imageIdentity(image.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
