import type { Locale } from './i18n';
import { createMaterialWorkflow, materialWorkflowTitle, type MaterialWorkflow } from './material-workflow';
import { createVideoWorkflow, videoWorkflowSize } from './video-workflow';
import type { CanvasTask } from './components/CanvasTaskList';
import { videoAssets } from './video-assets';
import { sizeVideoCanvasMedia, type VideoCanvasMedia } from './video-canvas-media';

type DemoResult = Omit<VideoCanvasMedia, 'x' | 'y'>;

// Preserve navigation for an already-open demo created before task IDs were
// stored on output media. Legacy batches used a fixed delay and append order.
export function bindCompletedTaskResults(tasks: CanvasTask[], images: VideoCanvasMedia[]): CanvasTask[] {
  const bindings = new Map<string, string[]>();
  const claimed = new Set(tasks.flatMap(task => task.resultIds ?? []));
  for (const task of tasks) {
    if (task.status !== 'completed' || task.resultIds?.length) continue;
    const linked = images.filter(image => !image.generation && image.generatedTaskId === task.id);
    if (linked.length) {
      bindings.set(task.id, linked.map(image => image.id));
      linked.forEach(image => claimed.add(image.id));
    }
  }
  const legacy = tasks.filter(task => task.status === 'completed' && !task.resultIds?.length && !bindings.has(task.id) && task.thumbnailUrl);
  for (const thumbnail of new Set(legacy.map(task => task.thumbnailUrl!))) {
    const records = legacy.filter(task => task.thumbnailUrl === thumbnail)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const results = images.filter(image => !image.generation && image.generatedByEditorId && !image.generatedTaskId && !claimed.has(image.id) && image.url === thumbnail).reverse();
    // Do not assign a different remaining result after deletion, or infer
    // unknown batch sizes. Only migrate a complete one-result-per-task group.
    if (records.length !== results.length) continue;
    records.forEach((task, index) => {
      bindings.set(task.id, [results[index].id]);
      claimed.add(results[index].id);
    });
  }
  return bindings.size ? tasks.map(task => bindings.has(task.id) ? { ...task, resultIds: bindings.get(task.id)! } : task) : tasks;
}

// Reserve the requested output ratio when the task is submitted. Auto follows
// the first input's original dimensions, or a square for text-only generation.
export function demoPlaceholderSize(ratio: string, source?: VideoCanvasMedia) {
  const [requestedWidth, requestedHeight] = ratio.split(':').map(Number);
  const sourceWidth = source?.video?.width ?? source?.naturalWidth ?? source?.width ?? 1;
  const sourceHeight = source?.video?.height ?? source?.naturalHeight ?? source?.height ?? 1;
  const aspect = requestedWidth > 0 && requestedHeight > 0 && Number.isFinite(requestedWidth / requestedHeight)
    ? requestedWidth / requestedHeight
    : sourceWidth > 0 && sourceHeight > 0 ? sourceWidth / sourceHeight : 1;
  return aspect > 1 ? { width: 320 * aspect, height: 320 } : { width: 320, height: 320 / aspect };
}

const portraitImage = { url: `${import.meta.env.BASE_URL}assets/workflow-examples/fusion-loungewear-result.png`, width: 1792, height: 2400 };
const squareImage = { url: `${import.meta.env.BASE_URL}assets/try-on/history/regular-5.png`, width: 2048, height: 2048 };
const copy = {
  'zh-CN': { image: '演示结果', video: '视频演示结果' },
  en: { image: 'Demo result', video: 'Video demo result' },
  ja: { image: 'デモ結果', video: '動画デモ結果' },
};

// Fixed local examples: the configured count affects the canvas batch only.
// No image generation, cropping, remote request, or temporary URL is involved.
export function createMaterialDemoResults(node: MaterialWorkflow, locale: Locale): DemoResult[] {
  const count = node.kind === 'storyboard' ? 1 : node.kind === 'gridSplit' ? node.grid
    : Math.max(1, Math.min(4, Number.isFinite(node.count) ? Math.trunc(node.count) : 1));
  // Text-only Auto reserves a square frame; use a genuinely square source so
  // the canvas, task thumbnail, preview and download all share the same ratio.
  const image = node.kind === 'quick' && node.references.length === 0 && node.ratio === 'auto'
    ? squareImage : portraitImage;
  return Array.from({ length: count }, (_, index) => sizeVideoCanvasMedia({
    id: crypto.randomUUID(),
    name: `${materialWorkflowTitle(node.kind, locale)} · ${copy[locale].image}${count > 1 ? ` ${index + 1}` : ''}.png`,
    ...image,
    naturalWidth: image.width,
    naturalHeight: image.height,
    generatedByEditorId: node.id,
  }));
}

export function createVideoDemoResult(editorId: string, locale: Locale): DemoResult {
  const name = `${copy[locale].video}.mp4`;
  return sizeVideoCanvasMedia({
    id: crypto.randomUUID(),
    name,
    url: videoAssets.portraitPoster,
    width: 1176,
    height: 1756,
    naturalWidth: 1176,
    naturalHeight: 1756,
    generatedByEditorId: editorId,
    video: {
      id: crypto.randomUUID(),
      kind: 'video',
      name,
      url: videoAssets.portraitVideo,
      posterUrl: videoAssets.portraitPoster,
      width: 1176,
      height: 1756,
      duration: 10.04,
    },
  });
}

// Completed local examples have actual canvas result IDs, so the task list can
// navigate to the same objects after they are moved, arranged, or restored.
export function createCompletedTaskExamples(locale: Locale) {
  const prompts = {
    'zh-CN': { image: '生成服装展示图片，清晰呈现款式、面料与穿着效果。', video: '展示模特身上的服装细节，镜头缓慢推进，动作自然流畅。' },
    en: { image: 'Create fashion images that clearly show the design, fabric and fit.', video: 'Show the clothing details with a slow camera move and natural model motion.' },
    ja: { image: 'デザイン、素材、着用感が伝わるファッション画像を生成。', video: 'ゆっくりカメラを動かし、自然な動きで服のディテールを見せる。' },
  };
  const imageEditor = { ...createMaterialWorkflow(0, 0, 'quick'), prompt: prompts[locale].image };
  const first = { ...createMaterialDemoResults(imageEditor, locale)[0], x: 400, y: 0 };
  const second: VideoCanvasMedia = {
    ...sizeVideoCanvasMedia({ id: crypto.randomUUID(), name: `${copy[locale].image} 2.png`,
      url: videoAssets.portraitPoster, width: 1176, height: 1756, naturalWidth: 1176, naturalHeight: 1756,
      generatedByEditorId: imageEditor.id }),
    x: 400, y: first.height + 120,
  };
  const videoEditor = {
    ...createVideoWorkflow(840, second.y + (second.height - videoWorkflowSize('frames').height) / 2, second, 'frames'),
    prompt: prompts[locale].video,
  };
  const video = { ...createVideoDemoResult(videoEditor.id, locale), x: 1240, y: second.y };
  const now = Date.now();
  const tasks = [first, second, video].map<CanvasTask>((result, index) => ({
    id: `video-task-example-${crypto.randomUUID()}`, status: 'completed',
    createdAt: new Date(now - (3 - index) * 60000).toISOString(),
    thumbnailUrl: result.url, resultIds: [result.id],
  })).reverse();
  const images = [first, second, video].map(result => ({ ...result, generatedTaskId: tasks.find(task => task.resultIds?.includes(result.id))!.id }));
  return { images, workflows: [videoEditor], materialWorkflows: [imageEditor], tasks };
}
