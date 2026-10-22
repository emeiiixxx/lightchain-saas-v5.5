import type { CanvasImage, FusionReference } from './canvas';

export type VideoFrameReference = FusionReference;
export type VideoReference = VideoFrameReference & { kind: 'image' | 'video' };
export type VideoWorkflow = {
  id: string;
  x: number;
  y: number;
  mode: 'frames' | 'references';
  generationMode: 'fast' | 'professional';
  main?: VideoFrameReference;
  endFrame?: VideoReference;
  references: VideoReference[];
  prompt: string;
  resolution: string;
  duration: string;
  ratio: string;
};

export function videoWorkflowSize(mode: VideoWorkflow['mode']) {
  return mode === 'frames' ? { width: 320, height: 523 } : { width: 280, height: 608 };
}
export function createVideoWorkflow(x: number, y: number, source?: CanvasImage): VideoWorkflow {
  return { id: crypto.randomUUID(), x, y, mode: 'frames', generationMode: 'fast',
    main: source ? { id: source.id, sourceImageId: source.id, name: source.name, url: source.url } : undefined,
    references: [], prompt: '', resolution: '1080p', duration: '5s', ratio: '9:16' };
}

// Canvas navigation and React Flow share the same geometry for images and nodes.
export function videoWorkflowBox(node: VideoWorkflow): CanvasImage {
  return { id: node.id, x: node.x, y: node.y, ...videoWorkflowSize(node.mode),
    name: '服装短视频', url: node.main?.url ?? '' };
}
