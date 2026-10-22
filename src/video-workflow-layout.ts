import type { VideoCanvasMedia } from './video-canvas-media';
import { videoWorkflowSize, videoWorkflowSourceIds, type VideoWorkflow } from './video-workflow';

type Position = { x: number; y: number };
type LayoutGroup = { media: VideoCanvasMedia[]; workflows: VideoWorkflow[]; mediaWidth: number; mediaHeight: number; workflowHeight: number; width: number; height: number };

const STACK_GAP = 40;
const EDITOR_GAP = 80;
const GROUP_GAP = 240;
const GROUPS_PER_ROW = 5;

// Connected components keep a shared editor in one group even when several
// media inputs feed it, or one material is reused by more than one editor.
export function arrangeVideoWorkflowMedia(images: VideoCanvasMedia[], workflows: VideoWorkflow[]): Map<string, Position> {
  const mediaById = new Map(images.map(image => [image.id, image]));
  const workflowById = new Map(workflows.map(node => [node.id, node]));
  const sourcesByWorkflow = new Map(workflows.map(node => [node.id, videoWorkflowSourceIds(node).filter(id => mediaById.has(id))]));
  const workflowsByMedia = new Map<string, string[]>();
  for (const node of workflows) {
    for (const sourceId of sourcesByWorkflow.get(node.id)!) {
      const linked = workflowsByMedia.get(sourceId) ?? [];
      linked.push(node.id);
      workflowsByMedia.set(sourceId, linked);
    }
  }

  const visitedMedia = new Set<string>();
  const visitedWorkflows = new Set<string>();
  const groups: LayoutGroup[] = [];
  function collectGroup(start: { kind: 'media' | 'workflow'; id: string }) {
    const mediaIds = new Set<string>();
    const workflowIds = new Set<string>();
    const queue = [start];
    for (let index = 0; index < queue.length; index++) {
      const item = queue[index];
      if (item.kind === 'media') {
        if (visitedMedia.has(item.id) || !mediaById.has(item.id)) continue;
        visitedMedia.add(item.id);
        mediaIds.add(item.id);
        queue.push(...(workflowsByMedia.get(item.id) ?? []).map(id => ({ kind: 'workflow' as const, id })));
      } else {
        if (visitedWorkflows.has(item.id) || !workflowById.has(item.id)) continue;
        visitedWorkflows.add(item.id);
        workflowIds.add(item.id);
        queue.push(...(sourcesByWorkflow.get(item.id) ?? []).map(id => ({ kind: 'media' as const, id })));
      }
    }
    // Preserve scene order rather than the order in which the graph was walked.
    const media = images.filter(image => mediaIds.has(image.id));
    const nodes = workflows.filter(node => workflowIds.has(node.id));
    const mediaWidth = Math.max(0, ...media.map(image => image.width));
    const mediaHeight = media.reduce((height, image) => height + image.height, 0) + Math.max(0, media.length - 1) * STACK_GAP;
    const nodeSizes = nodes.map(node => videoWorkflowSize(node.mode));
    const workflowWidth = Math.max(0, ...nodeSizes.map(size => size.width));
    const workflowHeight = nodeSizes.reduce((height, size) => height + size.height, 0) + Math.max(0, nodes.length - 1) * STACK_GAP;
    groups.push({ media, workflows: nodes, mediaWidth, mediaHeight, workflowHeight,
      width: mediaWidth + workflowWidth + (media.length && nodes.length ? EDITOR_GAP : 0), height: Math.max(mediaHeight, workflowHeight) });
  }
  for (const image of images) {
    if (!visitedMedia.has(image.id)) collectGroup({ kind: 'media', id: image.id });
  }
  for (const node of workflows) {
    if (!visitedWorkflows.has(node.id)) collectGroup({ kind: 'workflow', id: node.id });
  }

  const positions = new Map<string, Position>();
  let y = 0;
  for (let offset = 0; offset < groups.length; offset += GROUPS_PER_ROW) {
    const row = groups.slice(offset, offset + GROUPS_PER_ROW);
    let x = 0;
    for (const group of row) {
      let mediaY = y + (group.height - group.mediaHeight) / 2;
      for (const image of group.media) {
        positions.set(image.id, { x: x + group.mediaWidth - image.width, y: mediaY });
        mediaY += image.height + STACK_GAP;
      }
      let workflowY = y + (group.height - group.workflowHeight) / 2;
      for (const node of group.workflows) {
        positions.set(node.id, { x: x + (group.media.length ? group.mediaWidth + EDITOR_GAP : 0), y: workflowY });
        workflowY += videoWorkflowSize(node.mode).height + STACK_GAP;
      }
      x += group.width + GROUP_GAP;
    }
    y += Math.max(...row.map(group => group.height)) + GROUP_GAP;
  }
  return positions;
}
