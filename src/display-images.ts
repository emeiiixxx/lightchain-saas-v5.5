import manifest from './display-images.json';

const images: Record<string, { src: string; width: number }[]> = manifest;

export function displayImageSources(src: string): string | undefined {
  const url = new URL(src, window.location.href);
  if (url.origin !== window.location.origin) return undefined;
  const base = new URL(import.meta.env.BASE_URL, window.location.origin).pathname;
  const key = url.pathname.startsWith(base) ? '/' + url.pathname.slice(base.length) : url.pathname;
  const variants = images[url.pathname] ?? images[key];
  return variants?.map(image => `${image.src} ${image.width}w`).join(', ');
}
