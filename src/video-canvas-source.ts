import type { VideoCanvasMedia } from './video-canvas-media';
import { materialReferenceLimit, materialWorkflowHasBackView, materialWorkflowSourceIds, type MaterialWorkflow } from './material-workflow';
import { videoReferenceLimits, videoWorkflowReferences, videoWorkflowSourceIds, type VideoWorkflow, type VideoReference } from './video-workflow';
import { videoUpscaleWorkflowSourceIds, type VideoUpscaleWorkflow } from './video-upscale-workflow';

export type VideoWorkflowUpload = { editor?: 'video'; id: string; field: 'main' | 'endFrame' | 'references'; kind: VideoReference['kind'] };
export type MaterialWorkflowUpload = { editor: 'material'; id: string; field: 'references' | 'back'; kind: 'image' };
export type WorkflowUpload = VideoWorkflowUpload | MaterialWorkflowUpload | { editor: 'upscale'; id: string; field: 'video'; kind: 'video' };
type Scene = { images: VideoCanvasMedia[]; workflows: VideoWorkflow[]; materialWorkflows?: MaterialWorkflow[]; upscaleWorkflows?: VideoUpscaleWorkflow[] };

export function canvasSourceInfo(scene: Scene, target: WorkflowUpload): { remaining: number; used: (string | undefined)[] } | null {
  if (target.editor === 'material') {
    const node = scene.materialWorkflows?.find(item => item.id === target.id);
    if (!node || target.field === 'back' && !materialWorkflowHasBackView(node)) return null;
    const references = target.field === 'back' ? [] : node.references;
    return { remaining: target.field === 'back' ? 1 : Math.max(0, materialReferenceLimit(node.kind) - references.length), used: references.map(item => item.sourceImageId) };
  }
  if (target.editor === 'upscale') return scene.upscaleWorkflows?.some(item => item.id === target.id) ? { remaining: 1, used: [] } : null;
  const node = scene.workflows.find(item => item.id === target.id);
  if (!node || (target.field === 'references') !== (node.mode === 'references')) return null;
  const references = target.field === 'references' ? videoWorkflowReferences(node).filter(item => item.kind === target.kind) : [];
  return { remaining: target.field === 'references' ? Math.max(0, videoReferenceLimits[target.kind] - references.length) : 1, used: references.map(item => item.sourceImageId) };
}

// Reject a node's own outputs and all downstream outputs to keep the graph acyclic.
export function canvasSourceEligible(scene: Scene, target: WorkflowUpload, image: VideoCanvasMedia) {
  const info = canvasSourceInfo(scene, target);
  if (!info || image.generation || (image.video ? 'video' : 'image') !== target.kind || info.used.includes(image.id)) return false;
  const downstream = new Set([target.id]);
  const editors = [
    ...scene.workflows.map(node => ({ id: node.id, sources: videoWorkflowSourceIds(node) })),
    ...(scene.materialWorkflows ?? []).map(node => ({ id: node.id, sources: materialWorkflowSourceIds(node) })),
    ...(scene.upscaleWorkflows ?? []).map(node => ({ id: node.id, sources: videoUpscaleWorkflowSourceIds(node) })),
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of scene.images) if (item.generatedByEditorId && downstream.has(item.generatedByEditorId) && !downstream.has(item.id)) { downstream.add(item.id); changed = true; }
    for (const node of editors) if (!downstream.has(node.id) && node.sources.some(id => downstream.has(id))) { downstream.add(node.id); changed = true; }
  }
  return !downstream.has(image.id);
}

export function bindCanvasSources<T extends Scene>(scene: T, target: WorkflowUpload, ids: string[]): T | null {
  const info = canvasSourceInfo(scene, target);
  const images = [...new Set(ids)].map(id => scene.images.find(image => image.id === id));
  if (!info || !images.length || images.length > info.remaining || images.some(image => !image || !canvasSourceEligible(scene, target, image))) return null;
  const references: VideoReference[] = images.map(image => ({ ...(image!.video ?? { name: image!.name, url: image!.url, kind: 'image' as const }), id: crypto.randomUUID(), sourceImageId: image!.id }));
  if (target.editor === 'material') return { ...scene, materialWorkflows: scene.materialWorkflows!.map(node => node.id !== target.id ? node : target.field === 'back' ? { ...node, back: references[0] } : { ...node, references: [...node.references, ...references] }) };
  if (target.editor === 'upscale') return { ...scene, upscaleWorkflows: scene.upscaleWorkflows!.map(node => node.id !== target.id ? node : { ...node, video: { ...images[0]!.video!, sourceImageId: images[0]!.id } }) };
  return { ...scene, workflows: scene.workflows.map(node => node.id !== target.id ? node : target.field === 'main' ? { ...node, main: references[0] } : target.field === 'endFrame' ? { ...node, endFrame: references[0] } : { ...node, references: [...node.references, ...references] }) };
}
