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
  referenceOrder?: string[];
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
  const sizes = { frames: { width: 320, height: 629 }, references: { width: 320, height: 653 } };
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

export const videoReferenceLimits = { image: 9, video: 3 } as const;

// Main-image identity stays separate from its visual position and business link.
export function videoWorkflowReferences(node: VideoWorkflow): VideoReference[] {
  const seen = new Set<string>();
  const references = [...(node.main ? [{ ...node.main, kind: 'image' as const }] : []), ...node.references].filter(reference => {
    if (seen.has(reference.url)) return false;
    seen.add(reference.url); return true;
  });
  const byId = new Map(references.map(reference => [reference.id, reference]));
  const ordered: VideoReference[] = [];
  for (const id of node.referenceOrder ?? []) {
    const reference = byId.get(id);
    if (reference) { ordered.push(reference); byId.delete(id); }
  }
  return [...ordered, ...byId.values()];
}

// Move within one media section; other kinds retain their positions. The caller
// commits this array as referenceOrder in one undoable node update.
export function reorderVideoReferences(node: VideoWorkflow, kind: VideoReference['kind'], sourceId: string, targetId: string): string[] {
  const references = videoWorkflowReferences(node);
  const section = references.filter(reference => reference.kind === kind);
  const source = section.findIndex(reference => reference.id === sourceId);
  const target = section.findIndex(reference => reference.id === targetId);
  if (source < 0 || target < 0 || source === target) return references.map(reference => reference.id);
  section.splice(target, 0, ...section.splice(source, 1));
  let index = 0;
  return references.map(reference => reference.kind === kind ? section[index++].id : reference.id);
}

export function createVideoWorkflow(x: number, y: number, source?: CanvasImage, mode: VideoWorkflow['mode'] = 'frames'): VideoWorkflow {
  const longVideo = mode === 'references';
  return { id: crypto.randomUUID(), x, y, mode, generationMode: longVideo ? 'professional' : 'fast',
    main: source ? { id: source.id, sourceImageId: source.id, name: source.name, url: source.url } : undefined,
    references: [], prompt: '', resolution: longVideo ? '1080p' : '2K', duration: longVideo ? '30s' : '5s', ratio: '9:16', audio: 'auto' };
}

// Canvas navigation and React Flow share the same geometry for images and nodes.
export function videoWorkflowBox(node: VideoWorkflow): CanvasImage {
  return { id: node.id, x: node.x, y: node.y, ...videoWorkflowSize(node.mode),
    name: node.mode === 'frames' ? '服装短视频' : '服装长视频', url: node.main?.url ?? videoWorkflowReferences(node).find(reference => reference.kind === 'image')?.url ?? '' };
}
