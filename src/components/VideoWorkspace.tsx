import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { arrangeImages, boundsOf, DEFAULT_VIEW, fitImages, zoomAt, type CanvasImage, type Viewport } from '../canvas';
import { prepareMainImage, type LibraryImage } from '../asset-library';
import type { SnapGuides } from '../canvas-snapping';
import { messages, type Locale } from '../i18n';
import { usePresence } from '../usePresence';
import { videoAssets } from '../video-assets';
import { exportImage, ImageExportError, type DownloadFormat } from '../download-image';
import { AssetPicker } from './AssetPicker';
import { CanvasBackground } from './CanvasBackground';
import { CanvasProjectPanel } from './CanvasProjectPanel';
import { CanvasChrome } from './CanvasChrome';
import { CanvasContextMenu } from './CanvasContextMenu';
import { CutoutEditor } from './CutoutEditor';
import { FullImageViewer } from './FullImageViewer';
import { FullVideoViewer } from './FullVideoViewer';
import { ProgressiveImage } from './ProgressiveImage';
import { ReactFlowCanvas } from './ReactFlowCanvas';
import { VideoTemplateDialog } from './VideoTemplateDialog';
import { VideoIcon } from './VideoIcon';
import { VideoSelectionToolbar } from './VideoSelectionToolbar';
import { VideoAssetToolbar } from './VideoAssetToolbar';
import { VideoWorkflowNode } from './VideoWorkflowNode';
import { ImageConnection } from './ImageConnection';
import { createVideoWorkflow, videoWorkflowBox, VIDEO_NODE_WIDTH, VIDEO_NODE_HEIGHT, type VideoWorkflow, type VideoReference } from '../video-workflow';
import { copyVideoCanvasSelection, pasteVideoCanvasSelection, readCanvasMedia, sizeVideoCanvasMedia, type VideoCanvasMedia } from '../video-canvas-media';
import { createCanvasClipboard, getCanvasPasteOffset, matchesCanvasClipboard, writeCanvasClipboardEvent, writeCanvasClipboardSystem, type CanvasClipboard } from '../canvas-clipboard-session';
import { canConnectCanvasNodes, type CanvasConnection, type CanvasConnectionInput, type CanvasConnectionNodes } from '../canvas-connections';
import { videoReferenceUploadMessages, type UploadedVideo } from '../video-reference-upload';
import { notify } from './Toast';
import { Button, Dialog, Icon } from './ui';
import '../video-workspace.css';

const copy = {
  'zh-CN': { title: '视频工作台', headline: '从一个视频想法开始', intro: '从下方选择一个功能查看示例或点击添加图片，开启您的创作', templates: '热门模版', videoTemplates: '视频模版', materialGeneration: '素材生成', videoGeneration: '视频生成', videoRemake: '视频复刻', videoEdit: '视频编辑', pending: '此功能暂未接入，现可添加图片或使用热门模版。', help: '拖动图片移动位置；Shift + 点击或拖动空白处多选。按住空格拖动可平移，滚轮平移画布，按住 Ctrl / ⌘ / Alt 滚轮缩放。Delete 删除选中图片，Ctrl / ⌘ + Z 撤销，Ctrl / ⌘ + Shift + Z 重做，0 适应屏幕。', back: '返回融合画布' },
  en: { title: 'Video workspace', headline: 'Start with a video idea', intro: 'Choose a feature to explore an example, or add images to start creating', templates: 'Templates', videoTemplates: 'Video templates', materialGeneration: 'Asset creation', videoGeneration: 'Video creation', videoRemake: 'Video remake', videoEdit: 'Edit video', pending: 'This feature is not connected yet. Add images or explore the templates.', help: 'Drag images to move them. Shift-click or drag the background to select multiple images. Hold Space and drag to pan; scroll to pan, or hold Ctrl / ⌘ / Alt and scroll to zoom. Delete removes selected images. Ctrl / ⌘ + Z undoes, Ctrl / ⌘ + Shift + Z redoes, and 0 fits the canvas.', back: 'Back to outfit canvas' },
  ja: { title: '動画ワークスペース', headline: '動画のアイデアから始めよう', intro: '下の機能でサンプルを見るか、画像を追加して制作を始めましょう', templates: '人気テンプレート', videoTemplates: '動画テンプレート', materialGeneration: '素材生成', videoGeneration: '動画生成', videoRemake: '動画再現', videoEdit: '動画編集', pending: 'この機能はまだ接続されていません。画像の追加とテンプレートをお試しいただけます。', help: '画像をドラッグして移動。Shift + クリックまたは背景のドラッグで複数選択。Space を押しながらドラッグして移動、スクロールで移動、Ctrl / ⌘ / Alt + スクロールで拡大・縮小。Delete で削除、Ctrl / ⌘ + Z で取り消し、Ctrl / ⌘ + Shift + Z でやり直し、0 で全体を表示します。', back: 'コーディネート画面に戻る' },
};
const entries = [
  { id: 'templates', label: 'videoTemplates', icon: 'entryTemplates', nodeId: '64:2062' },
  { id: 'materialGeneration', label: 'materialGeneration', icon: 'entryMaterialGeneration', nodeId: '64:2063' },
  { id: 'videoGeneration', label: 'videoGeneration', icon: 'entryVideoGeneration', nodeId: '64:2064' },
  { id: 'videoRemake', label: 'videoRemake', icon: 'entryVideoRemake', nodeId: '64:2065' },
  { id: 'videoEdit', label: 'videoEdit', icon: 'entryVideoEdit', nodeId: '64:2204' },
] as const;
const mediaCopy = {
  'zh-CN': { add: '点击或拖拽到此处添加图片或视频', drop: '将图片或视频拖放到这里', upload: '上传素材', video: '视频', play: '播放', materials: '素材', limit: '每次最多添加20个素材。' },
  en: { add: 'Click or drop images or videos here', drop: 'Drop images or videos here', upload: 'Upload assets', video: 'Video', play: 'Play', materials: 'Assets', limit: 'Add up to 20 assets at a time.' },
  ja: { add: 'クリック、または画像・動画をドロップして追加', drop: 'ここに画像・動画をドロップ', upload: '素材をアップロード', video: '動画', play: '再生', materials: '素材', limit: '一度に追加できる素材は20点までです。' },
};
type Snapshot = { images: VideoCanvasMedia[]; workflows: VideoWorkflow[]; selected: string[]; connections: CanvasConnection[]; selectedConnections: string[] };
type VideoClipboard = CanvasClipboard<VideoCanvasMedia> & { connections: CanvasConnection[] };
type CopiedMedia = Pick<VideoClipboard, 'items' | 'connections'>;
type WorkflowUpload = { id: string; field: 'main' | 'endFrame' | 'references' };
type Modal = 'templates' | 'assets' | 'help';
type Props = { locale: Locale; active: boolean; onBack: () => void };
const connectionHelp = {
  'zh-CN': '悬停图片或视频时显示右侧连接点，编辑器支持左右连接点。拖线靠近编辑器时，绿色表示可连接，红色表示不可连接。点击连线选中，按 Delete 删除，拖动端点可重新连接。Shift + 点击可多选，Ctrl / ⌘ + Z 可撤销。',
  en: 'Hover over an image or video to reveal its right connection point. Editors have points on both sides. When dragging near an editor, green means the connection is allowed and red means it is not. Select a line and press Delete to remove it, or drag an endpoint to reconnect. Shift-click to select multiple items; Ctrl / ⌘ + Z undoes.',
  ja: '画像・動画にマウスを重ねると右側の接続点が表示されます。エディターは左右に接続点があります。線を近づけると、接続できる場合は緑、できない場合は赤になります。線を選択してDeleteで削除、端点をドラッグして接続先を変更できます。Shift + クリックで複数選択、Ctrl / ⌘ + Zで取り消します。',
};
const sceneItems = (snapshot: Snapshot) => [...snapshot.images, ...snapshot.workflows.map(videoWorkflowBox)];
function videoConnectionNodes(snapshot: Snapshot): CanvasConnectionNodes {
  const nodes: CanvasConnectionNodes = {};
  for (const image of snapshot.images) nodes[image.id] = { kind: image.video ? 'video' : 'image' };
  for (const node of snapshot.workflows) nodes[node.id] = {
    kind: 'editor', output: 'video', accepts: node.mode === 'references' ? ['image', 'video'] : ['image'],
  };
  return nodes;
}
const isField = (target: EventTarget | null) => target instanceof HTMLElement && !!target.closest('input,textarea,select,[contenteditable="true"]');

function fitVideoImages(images: CanvasImage[], width: number, height: number): Viewport {
  if (images.length !== 1) return fitImages(images, width, height);
  const image = images[0];
  const horizontalInset = width <= 680 ? 16 : 80;
  const verticalInset = width <= 680 ? 132 : 80;
  // The 40px toolbar and 16px gap are in screen space, above the image.
  const zoom = Math.min(1, Math.max(.03, Math.min(
    Math.max(1, width - horizontalInset * 2) / image.width,
    Math.max(1, height - verticalInset * 2 - 56) / image.height,
  )));
  return { zoom, x: width / 2 - (image.x + image.width / 2) * zoom,
    y: (height + 56) / 2 - (image.y + image.height / 2) * zoom };
}

export function VideoWorkspace({ locale, active, onBack }: Props) {
  const t = messages[locale], v = copy[locale], m = mediaCopy[locale];
  const canvas = useRef<HTMLElement>(null);
  const activeRef = useRef(active); activeRef.current = active;
  const [projectName, setProjectName] = useState(() => {
    try { return localStorage.getItem('lc-v55-video-project-name') || 'Untitle'; } catch { return 'Untitle'; }
  });
  const [snapshot, setSnapshot] = useState<Snapshot>({ images: [], workflows: [], selected: [], connections: [], selectedConnections: [] });
  const current = useRef(snapshot); current.current = snapshot;
  const history = useRef<{ past: Snapshot[]; future: Snapshot[] }>({ past: [], future: [] });
  const [view, commitView] = useState<Viewport>(DEFAULT_VIEW);
  const viewRef = useRef(view); viewRef.current = view;
  const cameraFrame = useRef<number | null>(null);
  const stopCamera = useCallback(() => {
    if (cameraFrame.current !== null) cancelAnimationFrame(cameraFrame.current);
    cameraFrame.current = null;
  }, []);
  const setView = useCallback((next: Viewport | ((previous: Viewport) => Viewport)) => {
    stopCamera();
    const target = typeof next === 'function' ? next(viewRef.current) : next;
    viewRef.current = target; commitView(target);
  }, [stopCamera]);
  const animateView = useCallback((target: Viewport) => {
    stopCamera();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setView(target); return; }
    const from = viewRef.current, started = performance.now();
    const duration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--motion-duration')) || 200;
    // Match the image canvas and CSS ease-out: cubic-bezier(0, 0, .58, 1).
    const frame = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      let low = 0, high = 1;
      for (let index = 0; index < 20; index++) {
        const time = (low + high) / 2;
        const x = 1.74 * (1 - time) * time * time + time * time * time;
        if (x < progress) low = time; else high = time;
      }
      const time = (low + high) / 2;
      const eased = 3 * (1 - time) * time * time + time * time * time;
      const next = progress === 1 ? target : { x: from.x + (target.x - from.x) * eased, y: from.y + (target.y - from.y) * eased, zoom: from.zoom + (target.zoom - from.zoom) * eased };
      viewRef.current = next; commitView(next);
      cameraFrame.current = progress < 1 ? requestAnimationFrame(frame) : null;
    };
    cameraFrame.current = requestAnimationFrame(frame);
  }, [setView, stopCamera]);
  useEffect(() => stopCamera, [stopCamera]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const measured = useRef({ width: 0, height: 0 });
  const [uploads, setUploads] = useState<LibraryImage[]>([]);
  const [uploadedVideos, setUploadedVideos] = useState<UploadedVideo[]>([]);
  const ownedUrls = useRef(new Set<string>());
  const pendingMediaRead = useRef<AbortController | null>(null);
  const uploadEpoch = useRef(0), uploadLocked = useRef(false);
  const [reading, setReading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const downloadLocked = useRef(false);
  const [dropActive, setDropActive] = useState(false);
  const [mode, setMode] = useState<'select' | 'hand'>('select');
  const [spaceDown, setSpaceDown] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(() => {
    try { return localStorage.getItem('lc-v55-video-grid-snap') !== 'off'; } catch { return true; }
  });
  const [guides, setGuides] = useState<SnapGuides | null>(null);
  const [canvasMenu, setCanvasMenu] = useState<{ x: number; y: number; worldX: number; worldY: number; kind?: 'image' } | null>(null);
  const canvasClipboard = useRef<VideoClipboard | null>(null);
  const [canPaste, setCanPaste] = useState(false);
  const closeCanvasMenu = useCallback(() => setCanvasMenu(null), []);
  const [modal, setModal] = useState<Modal | null>(null);
  const [preview, setPreview] = useState<CanvasImage | null>(null);
  const [cutout, setCutout] = useState<CanvasImage | null>(null);
  const [workflowUpload, setWorkflowUpload] = useState<WorkflowUpload | null>(null);
  const [videoPreview, setVideoPreview] = useState<VideoReference | null>(null);
  const previewEpoch = useRef(0);
  const shownModal = usePresence(active ? modal : null);
  const shownPreview = usePresence(active ? preview : null);
  const shownCutout = usePresence(active ? cutout : null);
  const shownWorkflowUpload = usePresence(active ? workflowUpload : null);
  const shownVideoPreview = usePresence(active ? videoPreview : null);
  const items = useMemo(() => sceneItems(snapshot), [snapshot.images, snapshot.workflows]);
  const connectionNodes = useMemo(() => videoConnectionNodes(snapshot), [snapshot.images, snapshot.workflows]);
  const shownDrop = usePresence(dropActive && items.length ? true : null);
  const shownGuides = usePresence(guides);
  const groupBounds = useMemo(() => snapshot.selected.length > 1 ? boundsOf(items.filter(image => snapshot.selected.includes(image.id))) : null, [items, snapshot.selected]);
  const shownGroup = usePresence(groupBounds);
  const singleSelection = useMemo(() => snapshot.selected.length === 1 && !snapshot.selectedConnections.length ? snapshot.images.find(image => image.id === snapshot.selected[0]) ?? null : null, [snapshot.images, snapshot.selected, snapshot.selectedConnections]);
  const shownSingle = usePresence(singleSelection);
  const outsideView = items.length > 0 && !items.some(image => image.x * view.zoom + view.x < canvasSize.width && (image.x + image.width) * view.zoom + view.x > 0 && image.y * view.zoom + view.y < canvasSize.height && (image.y + image.height) * view.zoom + view.y > 0);
  const shownReturn = usePresence(outsideView ? true : null);

  const replace = useCallback((next: Snapshot) => { current.current = next; setSnapshot(next); }, []);
  const saveUndo = useCallback(() => {
    history.current.past = [...history.current.past.slice(-99), current.current];
    history.current.future = [];
  }, []);
  const commit = useCallback((next: Snapshot) => { saveUndo(); replace(next); }, [replace, saveUndo]);
  const undo = useCallback(() => {
    const previous = history.current.past.pop();
    if (!previous) return;
    history.current.future.push(current.current); replace(previous);
  }, [replace]);
  const redo = useCallback(() => {
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push(current.current); replace(next);
  }, [replace]);
  const fit = useCallback(() => {
    const element = canvas.current;
    if (element) setView(current.current.workflows.length ? fitImages(sceneItems(current.current), element.clientWidth, element.clientHeight) : fitVideoImages(current.current.images, element.clientWidth, element.clientHeight));
  }, [setView]);
  const removeSelected = useCallback(() => {
    const previous = current.current;
    if (!previous.selected.length && !previous.selectedConnections.length) return;
    const removed = new Set(previous.selected), removedConnections = new Set(previous.selectedConnections);
    commit({ ...previous, images: previous.images.filter(image => !removed.has(image.id)),
      workflows: previous.workflows.filter(node => !removed.has(node.id)).map(node => node.main?.sourceImageId && removed.has(node.main.sourceImageId) ? { ...node, main: undefined } : node),
      connections: previous.connections.filter(edge => !removedConnections.has(edge.id) && !removed.has(edge.source) && !removed.has(edge.target)),
      selected: [], selectedConnections: [] });
  }, [commit]);
  const connectNodes = useCallback((input: CanvasConnectionInput, replacingId?: string) => {
    const previous = current.current;
    if (!canConnectCanvasNodes(input, videoConnectionNodes(previous))) return;
    if (replacingId && !previous.connections.some(edge => edge.id === replacingId)) return;
    if (previous.connections.some(edge => edge.id !== replacingId && edge.source === input.source && edge.target === input.target)
      || previous.workflows.some(node => node.id === input.target && node.main?.sourceImageId === input.source)) return;
    const old = previous.connections.find(edge => edge.id === replacingId);
    if (old && old.source === input.source && old.target === input.target && old.sourceHandle === input.sourceHandle && old.targetHandle === input.targetHandle) return;
    const edge: CanvasConnection = { ...input, id: replacingId ?? `video-connection-${crypto.randomUUID()}` };
    commit({ ...previous, connections: replacingId ? previous.connections.map(item => item.id === replacingId ? edge : item) : [...previous.connections, edge], selected: [], selectedConnections: [edge.id] });
    closeCanvasMenu(); canvas.current?.focus({ preventScroll: true });
  }, [commit, closeCanvasMenu]);
  const closeModal = useCallback(() => { uploadEpoch.current++; pendingMediaRead.current?.abort(); uploadLocked.current = false; setReading(false); setModal(null); }, []);

  const captureSelectedMedia = useCallback((): CopiedMedia => {
    const previous = current.current, items = copyVideoCanvasSelection(previous.images, previous.selected);
    const ids = new Set(items.map(item => item.id));
    return { items, connections: previous.connections.filter(edge => ids.has(edge.source) && ids.has(edge.target)).map(edge => ({ ...edge })) };
  }, []);
  const pasteCopiedItems = useCallback((point?: { x: number; y: number }, copied?: CopiedMedia) => {
    const clipboard = copied ? { ...copied, pastes: 0 } : canvasClipboard.current;
    const element = canvas.current;
    if (!activeRef.current || !clipboard?.items.length || !element) return;
    const bounds = boundsOf(clipboard.items)!;
    const offset = getCanvasPasteOffset(bounds, viewRef.current, { width: element.clientWidth, height: element.clientHeight }, clipboard.pastes, point);
    const created: VideoCanvasMedia[] = pasteVideoCanvasSelection(clipboard.items, offset.x, offset.y);
    const ids = new Map(clipboard.items.map((item, index) => [item.id, created[index].id]));
    const connections = clipboard.connections.filter(edge => ids.has(edge.source) && ids.has(edge.target)).map(edge => ({ ...edge, id: `video-connection-${crypto.randomUUID()}`, source: ids.get(edge.source)!, target: ids.get(edge.target)! }));
    clipboard.pastes++;
    commit({ ...current.current, images: [...current.current.images, ...created], connections: [...current.current.connections, ...connections], selected: created.map(item => item.id), selectedConnections: [] });
    element.focus({ preventScroll: true });
  }, [commit]);
  const duplicateSelected = useCallback(() => {
    const copied = captureSelectedMedia();
    if (copied.items.length) pasteCopiedItems(undefined, copied);
  }, [captureSelectedMedia, pasteCopiedItems]);
  async function copySelectedFromMenu() {
    const copied = captureSelectedMedia();
    if (!copied.items.length) return;
    const clipboard: VideoClipboard = { ...createCanvasClipboard(copied.items), connections: copied.connections };
    canvasClipboard.current = clipboard; setCanPaste(true); closeCanvasMenu();
    try { await writeCanvasClipboardSystem(clipboard, copied.items.map(item => item.name).join('\n')); }
    catch { notify(locale === 'zh-CN' ? '已复制，可右键画布选择「粘贴」' : locale === 'ja' ? 'コピーしました。キャンバスを右クリックして貼り付けできます' : 'Copied. Right-click the canvas to paste.'); }
  }

  useEffect(() => {
    if (!active) return;
    const blocked = (event: ClipboardEvent) => isField(event.target) || isField(document.activeElement)
      || reading || !!(shownModal.value || shownPreview.value || shownCutout.value || shownWorkflowUpload.value || shownVideoPreview.value)
      || !!document.querySelector('dialog[open], [popover]:popover-open:not([data-canvas-context-menu])');
    const copy = (event: ClipboardEvent) => {
      if (canvasMenu || blocked(event) || !event.clipboardData || window.getSelection()?.toString()) return;
      const copied = captureSelectedMedia();
      if (!copied.items.length) return;
      const clipboard: VideoClipboard = { ...createCanvasClipboard(copied.items), connections: copied.connections };
      writeCanvasClipboardEvent(event.clipboardData, clipboard, copied.items.map(item => item.name).join('\n'));
      canvasClipboard.current = clipboard; setCanPaste(true);
      event.preventDefault();
    };
    const paste = (event: ClipboardEvent) => {
      const clipboard = canvasClipboard.current;
      if (blocked(event) || !clipboard || !event.clipboardData || !matchesCanvasClipboard(event.clipboardData, clipboard)) return;
      event.preventDefault();
      pasteCopiedItems(canvasMenu && !canvasMenu.kind ? { x: canvasMenu.worldX, y: canvasMenu.worldY } : undefined);
      closeCanvasMenu();
    };
    window.addEventListener('copy', copy); window.addEventListener('paste', paste);
    return () => { window.removeEventListener('copy', copy); window.removeEventListener('paste', paste); };
  }, [active, reading, shownModal.value, shownPreview.value, shownCutout.value, shownWorkflowUpload.value, shownVideoPreview.value, canvasMenu, captureSelectedMedia, pasteCopiedItems, closeCanvasMenu]);

  useEffect(() => {
    try { localStorage.setItem('lc-v55-video-project-name', projectName); } catch { /* The canvas remains usable without storage. */ }
  }, [projectName]);
  useEffect(() => {
    if (active) return;
    stopCamera();
    uploadEpoch.current++; uploadLocked.current = false;
    pendingMediaRead.current?.abort();
    previewEpoch.current++;
    setReading(false); setModal(null); setPreview(null); setCutout(null); setWorkflowUpload(null); setVideoPreview(null); setDropActive(false);
    setSpaceDown(false); setDragging(false); setSelecting(false); setGuides(null); setCanvasMenu(null);
  }, [active, stopCamera]);
  useEffect(() => {
    activeRef.current = active;
    return () => {
      activeRef.current = false; uploadEpoch.current++;
      pendingMediaRead.current?.abort();
      ownedUrls.current.forEach(url => URL.revokeObjectURL(url)); ownedUrls.current.clear();
    };
  }, []);
  useEffect(() => {
    const element = canvas.current;
    if (!element || !active) return;
    const resize = new ResizeObserver(() => {
      const width = element.clientWidth, height = element.clientHeight;
      if (!width || !height) return;
      const previous = measured.current;
      if (previous.width && previous.height) setView(value => ({ ...value, x: value.x + (width - previous.width) / 2, y: value.y + (height - previous.height) / 2 }));
      measured.current = { width, height }; setCanvasSize({ width, height });
    });
    resize.observe(element); return () => resize.disconnect();
  }, [active, setView]);
  useEffect(() => {
    if (!active || shownModal.value || shownPreview.value || shownCutout.value || shownWorkflowUpload.value || shownVideoPreview.value) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.target instanceof Element && event.target.closest('input,textarea,select,button,[contenteditable="true"],dialog,[role="menu"]')) return;
      if (canvasMenu) { if (event.key === 'Escape') { event.preventDefault(); closeCanvasMenu(); } return; }
      if (document.querySelector('[popover]:popover-open')) return;
      const command = event.ctrlKey || event.metaKey;
      if (event.code === 'Space') { event.preventDefault(); setSpaceDown(true); }
      else if (command && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicateSelected(); }
      else if (command && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      else if (command && event.key.toLowerCase() === 'a') { event.preventDefault(); replace({ ...current.current, selected: sceneItems(current.current).map(image => image.id), selectedConnections: current.current.connections.map(edge => edge.id) }); }
      else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelected(); }
      else if (event.key === 'Escape') { replace({ ...current.current, selected: [], selectedConnections: [] }); setGuides(null); }
      else if (event.key === '0' && !command) { event.preventDefault(); fit(); }
      else if (!command && event.key.toLowerCase() === 'v') setMode('select');
      else if (!command && event.key.toLowerCase() === 'h') setMode('hand');
    };
    const keyup = (event: KeyboardEvent) => { if (event.code === 'Space') setSpaceDown(false); };
    const blur = () => { setSpaceDown(false); setDragging(false); setSelecting(false); setGuides(null); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); };
  }, [active, shownModal.value, shownPreview.value, shownCutout.value, shownWorkflowUpload.value, shownVideoPreview.value, canvasMenu, closeCanvasMenu, duplicateSelected, undo, redo, replace, removeSelected, fit]);

  function rememberUpload(image: LibraryImage) {
    if (image.url.startsWith('blob:')) ownedUrls.current.add(image.url);
    setUploads(previous => [...previous.filter(item => item.url !== image.url), image]);
  }
  function rememberVideo(video: UploadedVideo) {
    if (video.url.startsWith('blob:')) ownedUrls.current.add(video.url);
    setUploadedVideos(previous => [...previous.filter(item => item.url !== video.url), video]);
  }
  function addMedia(media: Omit<VideoCanvasMedia, 'x' | 'y'>[]) {
    if (!activeRef.current || !media.length) return;
    const loaded = media.map(item => sizeVideoCanvasMedia(item));
    const previous = current.current.images, bounds = boundsOf(sceneItems(current.current));
    let y = bounds ? bounds.y + bounds.height + 40 : 0;
    const additions: VideoCanvasMedia[] = [];
    for (let row = 0; row < loaded.length; row += 5) {
      const items = loaded.slice(row, row + 5);
      let x = 0;
      for (const image of items) { additions.push({ ...image, role: undefined, x, y }); x += image.width + 40; }
      y += Math.max(...items.map(image => image.height)) + 40;
    }
    commit({ ...current.current, images: [...previous, ...additions], selected: additions.map(image => image.id), selectedConnections: [] });
    if (canvas.current) setView(fitVideoImages(additions, canvas.current.clientWidth, canvas.current.clientHeight));
    setModal(null); canvas.current?.focus({ preventScroll: true });
  }
  async function loadFiles(files: FileList) {
    if (!activeRef.current || uploadLocked.current || !files.length) return;
    if (files.length > 20) { notify(m.limit, 'error'); return; }
    const epoch = ++uploadEpoch.current;
    const controller = new AbortController();
    pendingMediaRead.current = controller;
    uploadLocked.current = true; setReading(true);
    const results = await Promise.allSettled(Array.from(files).map(file => readCanvasMedia(file, controller.signal)));
    const loaded = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    if (pendingMediaRead.current === controller) pendingMediaRead.current = null;
    if (epoch !== uploadEpoch.current || !activeRef.current) { loaded.forEach(media => URL.revokeObjectURL(media.video?.url ?? media.url)); return; }
    loaded.forEach(media => media.video ? rememberVideo(media.video) : rememberUpload(media)); addMedia(loaded);
    if (results.some(result => result.status === 'rejected')) notify(videoReferenceUploadMessages[locale].error, 'error');
    uploadLocked.current = false; setReading(false);
  }
  function drop(event: DragEvent) {
    if (!active || modal || preview || cutout || workflowUpload || videoPreview) return;
    event.preventDefault(); event.stopPropagation(); setDropActive(false);
    void loadFiles(event.dataTransfer.files);
  }
  function openAssets() { closeCanvasMenu(); if (active && !reading) setModal('assets'); }
  function updateWorkflow(id: string, patch: Partial<VideoWorkflow>) {
    if (!current.current.workflows.some(node => node.id === id)) return;
    commit({ ...current.current, workflows: current.current.workflows.map(node => node.id === id ? { ...node, ...patch } : node) });
  }
  function addWorkflow(source?: CanvasImage) {
    const scene = sceneItems(current.current), viewport = viewRef.current;
    const node = createVideoWorkflow(
      source ? source.x + source.width + 80 : (canvasSize.width / 2 - viewport.x) / viewport.zoom - VIDEO_NODE_WIDTH / 2,
      source ? source.y + (source.height - VIDEO_NODE_HEIGHT) / 2 : (canvasSize.height / 2 - viewport.y) / viewport.zoom - VIDEO_NODE_HEIGHT / 2,
      source,
    );
    while (scene.some(item => node.x < item.x + item.width + 40 && node.x + VIDEO_NODE_WIDTH + 40 > item.x && node.y < item.y + item.height + 40 && node.y + VIDEO_NODE_HEIGHT + 40 > item.y)) node.y += VIDEO_NODE_HEIGHT + 40;
    commit({ ...current.current, workflows: [...current.current.workflows, node], selected: [node.id], selectedConnections: [] });
    if (canvas.current) animateView(fitImages([...(source ? [source] : []), videoWorkflowBox(node)], canvas.current.clientWidth, canvas.current.clientHeight));
    canvas.current?.focus({ preventScroll: true });
  }
  function applyWorkflowImage(uploaded: Omit<CanvasImage, 'x' | 'y'>) {
    const image = sizeVideoCanvasMedia(uploaded);
    const target = workflowUpload;
    const node = target && current.current.workflows.find(item => item.id === target.id);
    if (!target || !node || !activeRef.current) return;
    const reference: VideoReference = { id: crypto.randomUUID(), name: image.name, url: image.url, kind: 'image' };
    if (target.field === 'main') {
      let source = current.current.images.find(item => item.url === image.url);
      const images = [...current.current.images];
      if (!source) {
        source = { ...image, x: node.x - 80 - image.width, y: node.y + (VIDEO_NODE_HEIGHT - image.height) / 2 };
        const scene = sceneItems(current.current);
        while (scene.some(item => source!.x < item.x + item.width + 40 && source!.x + source!.width + 40 > item.x && source!.y < item.y + item.height + 40 && source!.y + source!.height + 40 > item.y)) source.x -= source.width + 40;
        images.push(source);
      }
      const main = { id: source.id, sourceImageId: source.id, name: source.name, url: source.url };
      const connections = current.current.connections.filter(edge => !(edge.source === main.sourceImageId && edge.target === node.id));
      commit({ ...current.current, images, workflows: current.current.workflows.map(item => item.id === node.id ? { ...item, main } : item), connections,
        selectedConnections: current.current.selectedConnections.filter(id => connections.some(edge => edge.id === id)) });
    } else if (target.field === 'endFrame') updateWorkflow(node.id, { endFrame: reference });
    else updateWorkflow(node.id, { references: [...node.references, reference] });
    setWorkflowUpload(null);
  }
  function applyWorkflowVideo(reference: UploadedVideo) {
    const node = workflowUpload?.field === 'references' && current.current.workflows.find(item => item.id === workflowUpload.id);
    if (!node || !activeRef.current) { if (!ownedUrls.current.has(reference.url)) URL.revokeObjectURL(reference.url); return; }
    rememberVideo(reference);
    updateWorkflow(node.id, { references: [...node.references, reference] });
    setWorkflowUpload(null);
  }
  async function previewReference(reference: VideoReference) {
    const request = ++previewEpoch.current;
    if (reference.kind === 'video') { setVideoPreview(reference); return; }
    try {
      const image = await prepareMainImage(reference);
      if (activeRef.current && request === previewEpoch.current) setPreview({ ...image, x: 0, y: 0 });
    } catch { notify(t.uploadError, 'error'); }
  }
  function arrangeScene() {
    const previous = current.current;
    if (!previous.workflows.length) {
      const positions = new Map(arrangeImages(previous.images).map(image => [image.id, { x: image.x, y: image.y }]));
      commit({ ...previous, images: previous.images.map(image => ({ ...image, ...positions.get(image.id)! })) }); fit(); return;
    }
    const positions = new Map<string, { x: number; y: number }>();
    const linked = new Set<string>();
    const groups = previous.images.map(image => {
      const nodes = previous.workflows.filter(node => node.main?.sourceImageId === image.id);
      nodes.forEach(node => linked.add(node.id));
      return { image, nodes, width: image.width + (nodes.length ? 80 + VIDEO_NODE_WIDTH : 0), height: Math.max(image.height, nodes.length * VIDEO_NODE_HEIGHT + Math.max(0, nodes.length - 1) * 40) };
    });
    const blocks = [...groups, ...previous.workflows.filter(node => !linked.has(node.id)).map(node => ({ image: undefined, nodes: [node], width: VIDEO_NODE_WIDTH, height: VIDEO_NODE_HEIGHT }))];
    let y = 0;
    for (let offset = 0; offset < blocks.length; offset += 5) {
      const row = blocks.slice(offset, offset + 5); let x = 0;
      for (const group of row) {
        if (group.image) positions.set(group.image.id, { x, y: y + (group.height - group.image.height) / 2 });
        const nodeHeight = group.nodes.length * VIDEO_NODE_HEIGHT + Math.max(0, group.nodes.length - 1) * 40;
        group.nodes.forEach((node, index) => positions.set(node.id, { x: x + (group.image ? group.image.width + 80 : 0), y: y + (group.height - nodeHeight) / 2 + index * (VIDEO_NODE_HEIGHT + 40) }));
        x += group.width + 240;
      }
      y += Math.max(...row.map(group => group.height)) + 240;
    }
    commit({ ...previous, images: previous.images.map(image => ({ ...image, ...positions.get(image.id)! })), workflows: previous.workflows.map(node => ({ ...node, ...positions.get(node.id)! })) });
    fit();
  }
  async function downloadSelected(format: DownloadFormat) {
    if (downloadLocked.current) return;
    const source = current.current.images.find(image => current.current.selected.includes(image.id));
    if (!source || source.video) return;
    downloadLocked.current = true; setDownloading(true);
    try {
      const image = new Image();
      image.crossOrigin = 'anonymous'; image.src = source.url;
      await image.decode();
      await exportImage(image, source.name, format);
    } catch (error) {
      const unsupported = locale === 'zh-CN' ? '当前浏览器不支持此格式导出，请选择其他格式。' : locale === 'ja' ? 'このブラウザーはこの形式での書き出しに対応していません。別の形式を選んでください。' : 'This browser cannot export this format. Please choose another format.';
      notify(error instanceof ImageExportError && error.reason === 'unsupported' ? unsupported : t.downloadError, 'error');
    } finally { downloadLocked.current = false; setDownloading(false); }
  }
  function downloadSelectedVideo() {
    const source = current.current.images.find(image => current.current.selected.includes(image.id));
    if (!source?.video) return;
    const link = document.createElement('a');
    link.href = source.video.url; link.download = source.video.name;
    document.body.appendChild(link); link.click(); link.remove();
  }
  function zoom(factor: number, animated = false) {
    const element = canvas.current;
    if (!element) return;
    const value = viewRef.current;
    const target = Math.max(.03, Math.min(2, value.zoom * factor));
    const next = zoomAt(value, target / value.zoom, element.clientWidth / 2, element.clientHeight / 2);
    if (animated) animateView(next); else setView(next);
  }

  return <>
    <main ref={canvas} hidden={!active} inert={!active} tabIndex={-1} lang={locale} className={`canvas video-workspace${items.length ? '' : ' video-workspace--empty'}${spaceDown || mode === 'hand' ? ' is-panning' : ''}${dragging ? ' is-dragging' : ''}`} aria-label={v.title} data-node-id={items.length ? '76:5683' : '64:2057'}
      onContextMenu={event => {
        if (!active || reading || shownModal.value || shownPreview.value || shownCutout.value || shownWorkflowUpload.value || shownVideoPreview.value || !(event.target instanceof Element) || event.target.closest('[data-overlay], [data-image], .fusion-position, .selection-overlay, .react-flow__handle, .react-flow__edge')) return;
        event.preventDefault();
        setDragging(false); setSelecting(false); setGuides(null);
        const rect = event.currentTarget.getBoundingClientRect(), viewport = viewRef.current;
        document.dispatchEvent(new CustomEvent('lc-select-open', { detail: 'canvas-context' }));
        setCanvasMenu({ x: event.clientX, y: event.clientY, worldX: (event.clientX - rect.left - viewport.x) / viewport.zoom, worldY: (event.clientY - rect.top - viewport.y) / viewport.zoom });
      }}
      onDragOver={event => { if (active && !modal && !preview && !cutout && !workflowUpload && !videoPreview && event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDropActive(true); } }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropActive(false); }} onDrop={drop}>
      <CanvasBackground view={view} />
      <CanvasProjectPanel title={v.title} icon={<span className="video-workspace-mark"><img src={videoAssets.workspacePlate} alt="" width={20} height={20} /><img src={videoAssets.workspaceIcon} alt="" width={20} height={20} /></span>} projectName={projectName} onProjectNameChange={setProjectName} onBack={onBack} backLabel={v.back} renameLabel={t.rename} nameLabel={t.projectName} nodeId="64:2058" />
      {!items.length && <div className="video-empty-scroll">
        <section className="video-empty" data-overlay data-node-id="64:2059">
          <div className="video-empty-headline" data-node-id="64:4159"><h1>{v.headline}</h1><p>{v.intro}</p></div>
          <div className="video-entry-tools" role="group" aria-label={v.title} data-node-id="64:2061">
            {entries.map(entry => <Button key={entry.id} variant="outline" size="l" className="video-entry-tool" disabled={reading} data-node-id={entry.nodeId}
              onClick={() => entry.id === 'templates' ? setModal('templates') : entry.id === 'videoGeneration' ? addWorkflow() : notify(v.pending)}>
              <VideoIcon name={entry.icon} size={24} /><span>{v[entry.label]}</span>{entry.id === 'templates' && <span className="entry-tool-badge video-entry-badge" data-node-id="64:2066">NEW</span>}
            </Button>)}
          </div>
          <button type="button" className={`asset-upload video-upload${dropActive ? ' is-over' : ''}`} disabled={reading} aria-label={m.add} onClick={openAssets} data-node-id="64:2068"
            onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.stopPropagation(); setDropActive(true); } }} onDrop={drop}>
            <VideoIcon name="upload" size={32} />
            <span className="asset-upload-title">{reading ? t.reading : dropActive ? m.drop : m.add}</span>
            <span className="asset-upload-hint">{dropActive && !reading ? t.releaseToUpload : videoReferenceUploadMessages[locale].hint}</span>
          </button>
        </section>
      </div>}
      {active && items.length > 0 && <>
        <ReactFlowCanvas view={view} selectedIds={snapshot.selected} hand={spaceDown || mode === 'hand'} referenceMode={false} snap={snapToGrid}
          connections={snapshot.connections} connectionNodes={connectionNodes} selectedConnectionIds={snapshot.selectedConnections} onConnect={connectNodes} onReconnect={(id, input) => connectNodes(input, id)}
          onConnectionSelection={ids => replace({ ...current.current, selectedConnections: ids })}
          onView={setView} onSelection={ids => replace({ ...current.current, selected: ids })}
          onPositions={positions => replace({ ...current.current, images: current.current.images.map(image => positions.has(image.id) ? { ...image, ...positions.get(image.id)! } : image), workflows: current.current.workflows.map(node => positions.has(node.id) ? { ...node, ...positions.get(node.id)! } : node) })}
          onDragStart={() => { saveUndo(); setDragging(true); }} onDragEnd={() => { setDragging(false); setGuides(null); }} onGuides={setGuides} onSelecting={setSelecting}>
          {snapshot.images.map(image => <div key={image.id} data-image data-canvas-id={image.id} data-node-id={image.video ? '97:6651' : undefined} className={`canvas-image${image.video ? ' canvas-video' : ''}${snapshot.selected.includes(image.id) ? ' selected' : ''}`} style={{ left: image.x, top: image.y, width: image.width, height: image.height }} role="button" tabIndex={0} aria-label={`${image.video ? m.video : t.image}: ${image.name}`} aria-pressed={snapshot.selected.includes(image.id)}
            onContextMenu={event => {
              event.preventDefault(); event.stopPropagation();
              if (!active || reading || !canvas.current || shownModal.value || shownPreview.value || shownCutout.value || shownWorkflowUpload.value || shownVideoPreview.value) return;
              const selected = current.current.selected.includes(image.id) ? current.current.selected.filter(id => current.current.images.some(item => item.id === id)) : [image.id];
              replace({ ...current.current, selected, selectedConnections: [] });
              setDragging(false); setSelecting(false); setGuides(null);
              const rect = canvas.current.getBoundingClientRect(), viewport = viewRef.current;
              document.dispatchEvent(new CustomEvent('lc-select-open', { detail: 'canvas-context' }));
              setCanvasMenu({ kind: 'image', x: event.clientX, y: event.clientY, worldX: (event.clientX - rect.left - viewport.x) / viewport.zoom, worldY: (event.clientY - rect.top - viewport.y) / viewport.zoom });
            }}
            onKeyDown={event => { if (event.target === event.currentTarget && event.key === 'Enter') { event.preventDefault(); replace({ ...current.current, selected: event.shiftKey ? current.current.selected.includes(image.id) ? current.current.selected.filter(id => id !== image.id) : [...current.current.selected, image.id] : [image.id], selectedConnections: event.shiftKey ? current.current.selectedConnections : [] }); } }}>
            {image.video ? <Button variant="tonal" className="image-preview-button video-canvas-play nodrag nopan" title={m.play} aria-label={`${m.play} · ${image.name}`} data-node-id="97:6653" onClick={event => { event.stopPropagation(); setVideoPreview(image.video!); }}><VideoIcon name="playVideo" size={20} /></Button>
              : <Button variant="tonal" className="image-preview-button nodrag nopan" title={t.viewFull} aria-label={`${t.viewFull} · ${image.name}`} onClick={event => { event.stopPropagation(); setPreview(image); }}><Icon name="viewFull" size={20} /></Button>}
            <ProgressiveImage src={image.url} alt={image.name} width={image.width} height={image.height} fit="contain" />
          </div>)}
          {snapshot.workflows.map(node => {
            const source = snapshot.images.find(image => image.id === node.main?.sourceImageId);
            return source ? <ImageConnection key={`${source.id}-${node.id}`} image={source} target={videoWorkflowBox(node)} active={snapshot.selected.includes(source.id) || snapshot.selected.includes(node.id)} zoom={view.zoom} /> : null;
          })}
          {snapshot.workflows.map(node => <div key={node.id} data-canvas-id={node.id} className="fusion-position video-workflow-position" data-selected={snapshot.selected.includes(node.id)} style={{ left: node.x, top: node.y, width: VIDEO_NODE_WIDTH, height: VIDEO_NODE_HEIGHT }} role="group" tabIndex={0} aria-label={locale === 'zh-CN' ? '服装短视频' : locale === 'ja' ? 'ファッション動画' : 'Fashion video'}
            onKeyDown={event => { if (event.target === event.currentTarget && event.key === 'Enter') { event.preventDefault(); replace({ ...current.current, selected: [node.id], selectedConnections: [] }); } }}>
            <VideoWorkflowNode node={node} locale={locale} onChange={patch => updateWorkflow(node.id, patch)} onMain={() => setWorkflowUpload({ id: node.id, field: 'main' })}
              onReference={() => setWorkflowUpload({ id: node.id, field: node.mode === 'frames' ? 'endFrame' : 'references' })} onPreview={reference => void previewReference(reference)}
              onGenerate={() => notify(locale === 'zh-CN' ? '视频生成服务暂未接入，当前配置已保留。' : locale === 'ja' ? '動画生成は未接続です。現在の設定は保持されます。' : 'Video generation is not connected yet. Your settings are retained.')} />
          </div>)}
        </ReactFlowCanvas>
        {shownSingle.value && !selecting && <div className="selection-overlay" data-phase={shownSingle.phase} aria-label={t.selectionTools} style={{ left: shownSingle.value.x * view.zoom + view.x, top: shownSingle.value.y * view.zoom + view.y, width: shownSingle.value.width * view.zoom, height: shownSingle.value.height * view.zoom }}>
          <div className="media-toolbar-anchor" data-overlay inert={shownSingle.phase === 'exit'}>
            {shownSingle.value.video ? <VideoAssetToolbar key={shownSingle.value.id} locale={locale} onDownload={downloadSelectedVideo}
              onModify={() => notify(locale === 'zh-CN' ? '视频修改功能暂未接入。' : locale === 'ja' ? '動画編集はまだ接続されていません。' : 'Video editing is not connected yet.')}
              onSave={() => notify(locale === 'zh-CN' ? '保存到资产功能暂未接入。' : locale === 'ja' ? '素材への保存はまだ接続されていません。' : 'Saving to assets is not connected yet.')} />
              : <VideoSelectionToolbar key={shownSingle.value.id} locale={locale} downloading={downloading} onDownload={format => void downloadSelected(format)} onAction={action => {
              if (action === 'cutout') setCutout(singleSelection);
              else if (action === 'fashionVideo' && singleSelection) addWorkflow(singleSelection);
              else notify(locale === 'zh-CN' ? '此功能暂未接入。' : locale === 'ja' ? 'この機能はまだ接続されていません。' : 'This feature is not connected yet.');
            }} />}
          </div>
        </div>}
        {shownGroup.value && !selecting && <div className="selection-overlay" data-phase={shownGroup.phase} aria-label={t.groupSelection} style={{ left: shownGroup.value.x * view.zoom + view.x, top: shownGroup.value.y * view.zoom + view.y, width: shownGroup.value.width * view.zoom, height: shownGroup.value.height * view.zoom }}><div className="group-selection-frame" /></div>}
        {shownGuides.value && <div className="canvas-snap-guides" aria-hidden="true" data-phase={shownGuides.phase}>
          {shownGuides.value.x !== undefined && <span className="canvas-snap-guide canvas-snap-guide--vertical" style={{ left: shownGuides.value.x * view.zoom + view.x }} />}
          {shownGuides.value.y !== undefined && <span className="canvas-snap-guide canvas-snap-guide--horizontal" style={{ top: shownGuides.value.y * view.zoom + view.y }} />}
        </div>}
        <CanvasChrome locale={locale} mode={spaceDown ? 'hand' : mode} onMode={setMode} zoom={view.zoom} view={view} canvasSize={canvasSize} images={items} showSmartSearch={false}
          sideActions={<>
            <Button className="canvas-icon-button" aria-label={t.platformAssets} onClick={openAssets}><Icon name="platformIcon" size={24} /></Button>
            <Button className="canvas-icon-button" aria-label={v.templates} onClick={() => setModal('templates')}><VideoIcon name="templates" size={24} /></Button>
          </>}
          snapToGrid={snapToGrid} onToggleSnap={() => { setGuides(null); setSnapToGrid(previous => { try { localStorage.setItem('lc-v55-video-grid-snap', previous ? 'off' : 'on'); } catch { /* Session state remains available. */ } return !previous; }); }}
          onNavigateMinimap={(x, y) => setView(previous => ({ ...previous, x: canvasSize.width / 2 - x * previous.zoom, y: canvasSize.height / 2 - y * previous.zoom }))} onMinimapInteraction={setDragging}
          canUndo={history.current.past.length > 0} canRedo={history.current.future.length > 0} onUndo={undo} onRedo={redo} onUpload={openAssets} onZoom={zoom} onFit={fit}
          onArrange={arrangeScene}
          onHelp={() => setModal('help')} onDemo={() => notify(v.pending)} />
        {shownReturn.value && <div className="canvas-return-hint" data-overlay data-phase={shownReturn.phase} inert={shownReturn.phase === 'exit'}><p>{t.noNodesInView}</p><Button variant="primary" onClick={fit}>{t.returnToNodes}</Button></div>}
      </>}
      {shownDrop.value && <div className="drop-overlay flex items-center justify-center pointer-events-none" data-phase={shownDrop.phase}><span>{m.drop}</span></div>}
      {reading && items.length > 0 && <div className="canvas-message" role="status">{t.reading}</div>}
      <span className="sr-only" role="status">{snapshot.images.length} {m.materials} · {snapshot.selected.length} {t.selected}</span>
    </main>
    <CanvasContextMenu point={active ? canvasMenu : null} canPaste={canPaste} locale={locale} uploadLabel={m.upload} itemMenuLabel={locale === 'zh-CN' ? '素材菜单' : locale === 'ja' ? '素材メニュー' : 'Asset menu'} onClose={closeCanvasMenu} onUpload={openAssets}
      onCopy={() => { void copySelectedFromMenu(); }}
      onDuplicate={() => { duplicateSelected(); closeCanvasMenu(); }}
      onDelete={() => { removeSelected(); closeCanvasMenu(); }}
      onPaste={() => { if (canvasMenu) pasteCopiedItems({ x: canvasMenu.worldX, y: canvasMenu.worldY }); closeCanvasMenu(); }} />
    {active && shownModal.value === 'templates' && <VideoTemplateDialog locale={locale} onClose={closeModal} phase={shownModal.phase} uploads={uploads} onUpload={rememberUpload} />}
    {active && shownModal.value === 'assets' && <AssetPicker locale={locale} phase={shownModal.phase} uploads={uploads} videoUploads={uploadedVideos} onUpload={rememberUpload} onVideoUpload={rememberVideo} onConfirm={image => addMedia([image])} onConfirmMediaBatch={addMedia} limitMessage={m.limit} onClose={closeModal} />}
    {active && shownWorkflowUpload.value && <AssetPicker key={`${shownWorkflowUpload.value.id}-${shownWorkflowUpload.value.field}`} locale={locale} phase={shownWorkflowUpload.phase} uploads={uploads} onUpload={rememberUpload} onConfirm={applyWorkflowImage}
      excludedUrls={shownWorkflowUpload.value.field === 'references' ? snapshot.workflows.find(node => node.id === shownWorkflowUpload.value!.id)?.references.map(reference => reference.url) : undefined}
      videoUploads={uploadedVideos} onConfirmVideo={shownWorkflowUpload.value.field === 'references' ? applyWorkflowVideo : undefined} onClose={() => setWorkflowUpload(null)} />}
    {active && shownModal.value === 'help' && <Dialog title={t.helpIntro} closeLabel={t.close} onClose={closeModal} phase={shownModal.phase}><p className="video-canvas-help">{v.help}</p><p className="video-canvas-help">{connectionHelp[locale]}</p></Dialog>}
    {active && shownPreview.value && <FullImageViewer image={shownPreview.value} locale={locale} phase={shownPreview.phase} onClose={() => setPreview(null)} />}
    {active && shownVideoPreview.value && <FullVideoViewer key={shownVideoPreview.value.url} video={shownVideoPreview.value} locale={locale} phase={shownVideoPreview.phase} onClose={() => setVideoPreview(null)} />}
    {active && shownCutout.value && <CutoutEditor key={shownCutout.value.id} image={shownCutout.value} phase={shownCutout.phase} onClose={() => setCutout(null)} onApply={url => {
      const source = shownCutout.value!;
      ownedUrls.current.add(url);
      const result: CanvasImage = { ...source, id: crypto.randomUUID(), name: `${source.name}-cutout.png`, url, x: source.x + source.width + 80 };
      commit({ ...current.current, images: [...current.current.images, result], selected: [result.id], selectedConnections: [] });
      setCutout(null);
    }} />}
  </>;
}
