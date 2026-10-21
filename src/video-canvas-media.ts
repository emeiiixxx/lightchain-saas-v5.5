import { readImage, type CanvasImage } from './canvas';
import { copyCanvasSelection } from './canvas-clipboard';
import { readVideoReference, type UploadedVideo } from './video-reference-upload';

export type VideoCanvasMedia = CanvasImage & { video?: UploadedVideo };

// Reuse the image canvas snapshot rules, retaining the original video rather
// than copying only its poster. Canvas IDs and uploaded-file IDs are separate.
export function copyVideoCanvasSelection(items: VideoCanvasMedia[], selected: string[]): VideoCanvasMedia[] {
  const originals = new Map(items.map(item => [item.id, item]));
  return copyCanvasSelection(items, selected).map(item => {
    const video = originals.get(item.id)?.video;
    return { ...item, ...(video ? { video: { ...video } } : {}) };
  });
}
export { pasteCanvasSelection as pasteVideoCanvasSelection } from './canvas-clipboard';

export function prepareVideoCanvasMedia(video: UploadedVideo): Omit<VideoCanvasMedia, 'x' | 'y'> {
  const width = Math.min(360, video.width);
  return { id: crypto.randomUUID(), name: video.name, url: video.posterUrl, width, height: width * video.height / video.width, video };
}

// The caller owns a successful image URL or video.url. Video posters are data
// URLs, so they need no separate URL lifetime management.
export async function readCanvasMedia(file: File, signal: AbortSignal): Promise<Omit<VideoCanvasMedia, 'x' | 'y'>> {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  if (file.type.startsWith('video/')) {
    const video = await readVideoReference(file, signal);
    if (signal.aborted) {
      URL.revokeObjectURL(video.url);
      throw new DOMException('Aborted', 'AbortError');
    }
    return prepareVideoCanvasMedia(video);
  }
  const image = await readImage(file);
  if (signal.aborted) {
    URL.revokeObjectURL(image.url);
    throw new DOMException('Aborted', 'AbortError');
  }
  return image;
}
