import type { CanvasImage, FusionReference } from './canvas';

export type VideoReference = FusionReference & { kind: 'image' | 'video' };
export type VideoWorkflow = {
  id: string;
  x: number;
  y: number;
  mode: 'frames' | 'references';
  main?: FusionReference;
  endFrame?: VideoReference;
  references: VideoReference[];
  prompt: string;
  resolution: string;
  duration: string;
  ratio: string;
};

export const VIDEO_NODE_WIDTH = 280;
export const VIDEO_NODE_HEIGHT = 608;
export function createVideoWorkflow(x: number, y: number, source?: CanvasImage): VideoWorkflow {
  return { id: crypto.randomUUID(), x, y, mode: 'frames',
    main: source ? { id: source.id, sourceImageId: source.id, name: source.name, url: source.url } : undefined,
    references: [], prompt: '', resolution: '1080p', duration: '5s', ratio: '9:16' };
}

// Canvas navigation and React Flow share the same geometry for images and nodes.
export function videoWorkflowBox(node: VideoWorkflow): CanvasImage {
  return { id: node.id, x: node.x, y: node.y, width: VIDEO_NODE_WIDTH, height: VIDEO_NODE_HEIGHT,
    name: '服装短视频', url: node.main?.url ?? '' };
}
