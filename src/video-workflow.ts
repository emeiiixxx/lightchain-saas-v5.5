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
  const sizes = { frames: { width: 320, height: 523 }, references: { width: 320, height: 523 } };
  return sizes[mode];
}

export function videoDurationLimit(mode: VideoWorkflow['generationMode']) {
  return mode === 'professional' ? 30 : 15;
}

export function clampVideoDuration(duration: string, mode: VideoWorkflow['generationMode']) {
  const seconds = Number.parseInt(duration, 10);
  return `${Math.max(5, Math.min(videoDurationLimit(mode), Number.isFinite(seconds) ? seconds : 5))}s`;
}

// The bound canvas source stays in one slot when switching modes.
export function videoWorkflowReferences(node: VideoWorkflow): VideoReference[] {
  return [...(node.main ? [{ ...node.main, kind: 'image' as const }] : []), ...node.references];
}
export function createVideoWorkflow(x: number, y: number, source?: CanvasImage): VideoWorkflow {
  return { id: crypto.randomUUID(), x, y, mode: 'frames', generationMode: 'fast',
    main: source ? { id: source.id, sourceImageId: source.id, name: source.name, url: source.url } : undefined,
    references: [], prompt: '', resolution: '1080p', duration: '5s', ratio: '9:16' };
}

// Canvas navigation and React Flow share the same geometry for images and nodes.
export function videoWorkflowBox(node: VideoWorkflow): CanvasImage {
  return { id: node.id, x: node.x, y: node.y, ...videoWorkflowSize(node.mode),
    name: node.mode === 'frames' ? '服装短视频' : '视频生成', url: node.main?.url ?? node.references.find(reference => reference.kind === 'image')?.url ?? '' };
}
