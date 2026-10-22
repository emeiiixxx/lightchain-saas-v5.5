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
  audio: 'auto' | 'mute';
};

// Figma configuration menus: fast 113:8633, professional 113:8634.
export const videoGenerationConfig = {
  fast: { nodeId: '113:8633', resolutions: ['768p', '2K'], defaultResolution: '2K', audioOptions: ['auto'], maxDuration: 15 },
  professional: { nodeId: '113:8634', resolutions: ['480p', '720p', '1080p'], defaultResolution: '1080p', audioOptions: ['auto', 'mute'], maxDuration: 30 },
} as const;

export function videoWorkflowSize(mode: VideoWorkflow['mode']) {
  const sizes = { frames: { width: 320, height: 523 }, references: { width: 320, height: 523 } };
  return sizes[mode];
}

export function videoDurationLimit(mode: VideoWorkflow['generationMode']) {
  return videoGenerationConfig[mode].maxDuration;
}

export function clampVideoDuration(duration: string, mode: VideoWorkflow['generationMode']) {
  const seconds = Number.parseInt(duration, 10);
  return `${Math.max(5, Math.min(videoDurationLimit(mode), Number.isFinite(seconds) ? seconds : 5))}s`;
}

// Apply mode changes atomically so undo restores the complete configuration.
export function normalizeVideoWorkflowSettings(node: VideoWorkflow): VideoWorkflow {
  const generationMode = node.generationMode === 'professional' ? 'professional' : 'fast';
  const config = videoGenerationConfig[generationMode];
  const resolutions: readonly string[] = config.resolutions;
  const resolution = resolutions.includes(node.resolution) ? node.resolution : config.defaultResolution;
  const audio = generationMode === 'professional' && node.audio === 'mute' ? 'mute' : 'auto';
  const duration = clampVideoDuration(node.duration, generationMode);
  if (generationMode === node.generationMode && resolution === node.resolution && audio === node.audio && duration === node.duration) return node;
  return { ...node, generationMode, resolution, audio, duration };
}

// The bound canvas source stays in one slot when switching modes.
export function videoWorkflowReferences(node: VideoWorkflow): VideoReference[] {
  return [...(node.main ? [{ ...node.main, kind: 'image' as const }] : []), ...node.references];
}
export function createVideoWorkflow(x: number, y: number, source?: CanvasImage): VideoWorkflow {
  return { id: crypto.randomUUID(), x, y, mode: 'frames', generationMode: 'fast',
    main: source ? { id: source.id, sourceImageId: source.id, name: source.name, url: source.url } : undefined,
    references: [], prompt: '', resolution: '2K', duration: '5s', ratio: '9:16', audio: 'auto' };
}

// Canvas navigation and React Flow share the same geometry for images and nodes.
export function videoWorkflowBox(node: VideoWorkflow): CanvasImage {
  return { id: node.id, x: node.x, y: node.y, ...videoWorkflowSize(node.mode),
    name: node.mode === 'frames' ? '服装短视频' : '视频生成', url: node.main?.url ?? node.references.find(reference => reference.kind === 'image')?.url ?? '' };
}
