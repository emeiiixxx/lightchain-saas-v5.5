import type { VideoCanvasMedia } from './video-canvas-media';
import { videoWorkflowSize, videoWorkflowSourceIds, type VideoWorkflow } from './video-workflow';
import { materialWorkflowSize, materialWorkflowSourceIds, type MaterialWorkflow } from './material-workflow';
import { videoUpscaleWorkflowSize, videoUpscaleWorkflowSourceIds, type VideoUpscaleWorkflow } from './video-upscale-workflow';

type Position = { x: number; y: number };
type LayoutEditor = { id: string; width: number; height: number; sourceIds: string[] };
type LayoutItem = { id: string; width: number; height: number; kind: 'media' | 'workflow' };
type LayoutGroup = { positions: Map<string, Position>; width: number; height: number };

const STACK_GAP = 40;
const EDITOR_GAP = 80;
const GROUP_GAP = 240;
const GROUPS_PER_ROW = 5;

function layoutColumns(columns: LayoutItem[][]): LayoutGroup {
  const sizes = columns.map(column => ({
    width: Math.max(0, ...column.map(item => item.width)),
    height: column.reduce((height, item) => height + item.height, 0) + Math.max(0, column.length - 1) * STACK_GAP,
  }));
  const height = Math.max(0, ...sizes.map(size => size.height));
  const positions = new Map<string, Position>();
  let x = 0;
  columns.forEach((column, index) => {
    const size = sizes[index];
    let y = (height - size.height) / 2;
    for (const item of column) {
      // Input media retain their right alignment; editors begin at the column edge.
      positions.set(item.id, { x: x + (item.kind === 'media' ? size.width - item.width : 0), y });
      y += item.height + STACK_GAP;
    }
    x += size.width + EDITOR_GAP;
  });
  return { positions, width: Math.max(0, x - EDITOR_GAP), height };
}

function layoutGeneratedGroup(media: VideoCanvasMedia[], workflows: LayoutEditor[], generatorsByMedia: Map<string, string>): LayoutGroup {
  // Stable scene order is also the tie-breaker for branches in the same layer.
  const items: LayoutItem[] = [
    ...media.map(item => ({ id: item.id, width: item.width, height: item.height, kind: 'media' as const })),
    ...workflows.map(item => ({ id: item.id, width: item.width, height: item.height, kind: 'workflow' as const })),
  ];
  const outgoing = new Map(items.map(item => [item.id, new Set<string>()]));
  const indegrees = new Map(items.map(item => [item.id, 0]));
  const ranks = new Map(items.map(item => [item.id, 0]));
  const addEdge = (source: string, target: string) => {
    const targets = outgoing.get(source);
    if (!targets || !outgoing.has(target) || targets.has(target)) return;
    targets.add(target);
    indegrees.set(target, indegrees.get(target)! + 1);
  };

  // Generation edges take priority so every result stays to its editor's right.
  for (const item of media) {
    const generator = generatorsByMedia.get(item.id);
    if (generator) addEdge(generator, item.id);
  }
  const hasPath = (start: string, target: string) => {
    const pending = [start];
    const visited = new Set<string>();
    while (pending.length) {
      const id = pending.pop()!;
      if (id === target) return true;
      if (visited.has(id)) continue;
      visited.add(id);
      pending.push(...(outgoing.get(id) ?? []));
    }
    return false;
  };
  for (const node of workflows) {
    for (const sourceId of node.sourceIds) {
      if (!outgoing.has(sourceId) || hasPath(node.id, sourceId)) continue;
      // A circular reference is drawn as a feedback connection, not a layout
      // dependency. Its actual source binding remains unchanged in the scene.
      addEdge(sourceId, node.id);
    }
  }

  const pending = items.filter(item => indegrees.get(item.id) === 0).map(item => item.id);
  for (let index = 0; index < pending.length; index++) {
    const id = pending[index];
    for (const target of outgoing.get(id)!) {
      ranks.set(target, Math.max(ranks.get(target)!, ranks.get(id)! + 1));
      const remaining = indegrees.get(target)! - 1;
      indegrees.set(target, remaining);
      if (remaining === 0) pending.push(target);
    }
  }
  const columns: LayoutItem[][] = [];
  for (const item of items) {
    const rank = ranks.get(item.id)!;
    (columns[rank] ??= []).push(item);
  }
  return layoutColumns(columns);
}

// Connected components keep a shared editor in one group even when several
// inputs feed it, one material is reused, or a result feeds a later editor.
export function arrangeVideoWorkflowMedia(images: VideoCanvasMedia[], videoWorkflows: VideoWorkflow[], materialWorkflows: MaterialWorkflow[] = [], upscaleWorkflows: VideoUpscaleWorkflow[] = []): Map<string, Position> {
  const workflows: LayoutEditor[] = [
    ...videoWorkflows.map(node => ({ id: node.id, ...videoWorkflowSize(node.mode), sourceIds: videoWorkflowSourceIds(node) })),
    ...materialWorkflows.map(node => ({ id: node.id, ...materialWorkflowSize(node), sourceIds: materialWorkflowSourceIds(node) })),
    ...upscaleWorkflows.map(node => ({ id: node.id, ...videoUpscaleWorkflowSize(), sourceIds: videoUpscaleWorkflowSourceIds(node) })),
  ];
  const mediaById = new Map(images.map(image => [image.id, image]));
  const workflowById = new Map(workflows.map(node => [node.id, node]));
  const sourcesByWorkflow = new Map(workflows.map(node => [node.id, node.sourceIds.filter(id => mediaById.has(id))]));
  const workflowsByMedia = new Map<string, string[]>();
  const generatorsByMedia = new Map<string, string>();
  const resultsByWorkflow = new Map<string, string[]>();
  for (const image of images) {
    const generatorId = image.generatedByEditorId;
    if (!generatorId || !workflowById.has(generatorId)) continue;
    generatorsByMedia.set(image.id, generatorId);
    const results = resultsByWorkflow.get(generatorId) ?? [];
    results.push(image.id);
    resultsByWorkflow.set(generatorId, results);
  }
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
        const generatorId = generatorsByMedia.get(item.id);
        if (generatorId) queue.push({ kind: 'workflow', id: generatorId });
      } else {
        if (visitedWorkflows.has(item.id) || !workflowById.has(item.id)) continue;
        visitedWorkflows.add(item.id);
        workflowIds.add(item.id);
        queue.push(...(sourcesByWorkflow.get(item.id) ?? []).map(id => ({ kind: 'media' as const, id })));
        queue.push(...(resultsByWorkflow.get(item.id) ?? []).map(id => ({ kind: 'media' as const, id })));
      }
    }
    // Preserve scene order rather than the order in which the graph was walked.
    const media = images.filter(image => mediaIds.has(image.id));
    const nodes = workflows.filter(node => workflowIds.has(node.id));
    if (media.some(image => generatorsByMedia.has(image.id))) {
      groups.push(layoutGeneratedGroup(media, nodes, generatorsByMedia));
    } else {
      // Keep the existing two-column layout exactly for scenes without results,
      // including orphaned results whose generator has since been removed.
      const columns: LayoutItem[][] = [];
      if (media.length) columns.push(media.map(image => ({ ...image, kind: 'media' as const })));
      if (nodes.length) columns.push(nodes.map(node => ({ ...node, kind: 'workflow' as const })));
      groups.push(layoutColumns(columns));
    }
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
      for (const [id, position] of group.positions) {
        positions.set(id, { x: x + position.x, y: y + position.y });
      }
      x += group.width + GROUP_GAP;
    }
    y += Math.max(...row.map(group => group.height)) + GROUP_GAP;
  }
  return positions;
}
