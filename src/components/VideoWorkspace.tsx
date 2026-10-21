import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { arrangeImages, boundsOf, DEFAULT_VIEW, fitImages, readImage, zoomAt, type CanvasImage, type Viewport } from '../canvas';
import type { LibraryImage } from '../asset-library';
import type { SnapGuides } from '../canvas-snapping';
import { messages, type Locale } from '../i18n';
import { usePresence } from '../usePresence';
import { videoAssets } from '../video-assets';
import { downloadImages } from '../download-images';
import { AssetPicker } from './AssetPicker';
import { CanvasBackground } from './CanvasBackground';
import { CanvasProjectPanel } from './CanvasProjectPanel';
import { CanvasChrome } from './CanvasChrome';
import { CutoutEditor } from './CutoutEditor';
import { FullImageViewer } from './FullImageViewer';
import { ProgressiveImage } from './ProgressiveImage';
import { ReactFlowCanvas } from './ReactFlowCanvas';
import { VideoTemplateDialog } from './VideoTemplateDialog';
import { VideoIcon } from './VideoIcon';
import { VideoSelectionToolbar } from './VideoSelectionToolbar';
import { notify } from './Toast';
import { Button, Dialog, Icon } from './ui';
import '../video-workspace.css';

const copy = {
  'zh-CN': { title: '视频工作台', headline: '从一个视频想法开始', intro: '从下方选择一个功能查看示例或点击添加图片，开启您的创作', templates: '热门模版', imageGeneration: '图片生成', videoGeneration: '视频生成', videoExtend: '视频延长', videoEdit: '视频编辑', pending: '此功能暂未接入，现可添加图片或使用热门模版。', help: '拖动图片移动位置；Shift + 点击或拖动空白处多选。按住空格拖动可平移，滚轮平移画布，按住 Ctrl / ⌘ / Alt 滚轮缩放。Delete 删除选中图片，Ctrl / ⌘ + Z 撤销，Ctrl / ⌘ + Shift + Z 重做，0 适应屏幕。', back: '返回融合画布' },
  en: { title: 'Video workspace', headline: 'Start with a video idea', intro: 'Choose a feature to explore an example, or add images to start creating', templates: 'Templates', imageGeneration: 'Image creation', videoGeneration: 'Video creation', videoExtend: 'Extend video', videoEdit: 'Edit video', pending: 'This feature is not connected yet. Add images or explore the templates.', help: 'Drag images to move them. Shift-click or drag the background to select multiple images. Hold Space and drag to pan; scroll to pan, or hold Ctrl / ⌘ / Alt and scroll to zoom. Delete removes selected images. Ctrl / ⌘ + Z undoes, Ctrl / ⌘ + Shift + Z redoes, and 0 fits the canvas.', back: 'Back to outfit canvas' },
  ja: { title: '動画ワークスペース', headline: '動画のアイデアから始めよう', intro: '下の機能でサンプルを見るか、画像を追加して制作を始めましょう', templates: '人気テンプレート', imageGeneration: '画像生成', videoGeneration: '動画生成', videoExtend: '動画延長', videoEdit: '動画編集', pending: 'この機能はまだ接続されていません。画像の追加とテンプレートをお試しいただけます。', help: '画像をドラッグして移動。Shift + クリックまたは背景のドラッグで複数選択。Space を押しながらドラッグして移動、スクロールで移動、Ctrl / ⌘ / Alt + スクロールで拡大・縮小。Delete で削除、Ctrl / ⌘ + Z で取り消し、Ctrl / ⌘ + Shift + Z でやり直し、0 で全体を表示します。', back: 'コーディネート画面に戻る' },
};
const entries = [
  { id: 'templates', nodeId: '64:2062' },
  { id: 'imageGeneration', nodeId: '64:2063' },
  { id: 'videoGeneration', nodeId: '64:2064' },
  { id: 'videoExtend', nodeId: '64:2065' },
  { id: 'videoEdit', nodeId: '64:2204' },
] as const;
type Snapshot = { images: CanvasImage[]; selected: string[] };
type Modal = 'templates' | 'assets' | 'help';
type Props = { locale: Locale; active: boolean; onBack: () => void };

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
  const t = messages[locale], v = copy[locale];
  const canvas = useRef<HTMLElement>(null);
  const activeRef = useRef(active); activeRef.current = active;
  const [projectName, setProjectName] = useState(() => {
    try { return localStorage.getItem('lc-v55-video-project-name') || 'Untitle'; } catch { return 'Untitle'; }
  });
  const [snapshot, setSnapshot] = useState<Snapshot>({ images: [], selected: [] });
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
  const ownedUrls = useRef(new Set<string>());
  const uploadEpoch = useRef(0), uploadLocked = useRef(false);
  const [reading, setReading] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [mode, setMode] = useState<'select' | 'hand'>('select');
  const [spaceDown, setSpaceDown] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(() => {
    try { return localStorage.getItem('lc-v55-video-grid-snap') !== 'off'; } catch { return true; }
  });
  const [guides, setGuides] = useState<SnapGuides | null>(null);
  const [modal, setModal] = useState<Modal | null>(null);
  const [preview, setPreview] = useState<CanvasImage | null>(null);
  const [cutout, setCutout] = useState<CanvasImage | null>(null);
  const shownModal = usePresence(active ? modal : null);
  const shownPreview = usePresence(active ? preview : null);
  const shownCutout = usePresence(active ? cutout : null);
  const shownDrop = usePresence(dropActive && snapshot.images.length ? true : null);
  const shownGuides = usePresence(guides);
  const groupBounds = useMemo(() => snapshot.selected.length > 1 ? boundsOf(snapshot.images.filter(image => snapshot.selected.includes(image.id))) : null, [snapshot.images, snapshot.selected]);
  const shownGroup = usePresence(groupBounds);
  const singleSelection = useMemo(() => snapshot.selected.length === 1 ? snapshot.images.find(image => image.id === snapshot.selected[0]) ?? null : null, [snapshot.images, snapshot.selected]);
  const shownSingle = usePresence(singleSelection);
  const outsideView = snapshot.images.length > 0 && !snapshot.images.some(image => image.x * view.zoom + view.x < canvasSize.width && (image.x + image.width) * view.zoom + view.x > 0 && image.y * view.zoom + view.y < canvasSize.height && (image.y + image.height) * view.zoom + view.y > 0);
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
    if (element) setView(fitVideoImages(current.current.images, element.clientWidth, element.clientHeight));
  }, [setView]);
  const removeSelected = useCallback(() => {
    if (!current.current.selected.length) return;
    commit({ images: current.current.images.filter(image => !current.current.selected.includes(image.id)), selected: [] });
  }, [commit]);
  const closeModal = useCallback(() => { uploadEpoch.current++; uploadLocked.current = false; setReading(false); setModal(null); }, []);

  useEffect(() => {
    try { localStorage.setItem('lc-v55-video-project-name', projectName); } catch { /* The canvas remains usable without storage. */ }
  }, [projectName]);
  useEffect(() => {
    if (active) return;
    stopCamera();
    uploadEpoch.current++; uploadLocked.current = false;
    setReading(false); setModal(null); setPreview(null); setCutout(null); setDropActive(false);
    setSpaceDown(false); setDragging(false); setSelecting(false); setGuides(null);
  }, [active, stopCamera]);
  useEffect(() => {
    activeRef.current = active;
    return () => {
      activeRef.current = false; uploadEpoch.current++;
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
    if (!active || shownModal.value || shownPreview.value || shownCutout.value) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.target instanceof Element && event.target.closest('input,textarea,select,button,[contenteditable="true"],dialog,[role="menu"]')) return;
      const command = event.ctrlKey || event.metaKey;
      if (event.code === 'Space') { event.preventDefault(); setSpaceDown(true); }
      else if (command && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      else if (command && event.key.toLowerCase() === 'a') { event.preventDefault(); replace({ ...current.current, selected: current.current.images.map(image => image.id) }); }
      else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelected(); }
      else if (event.key === 'Escape') { replace({ ...current.current, selected: [] }); setGuides(null); }
      else if (event.key === '0' && !command) { event.preventDefault(); fit(); }
      else if (!command && event.key.toLowerCase() === 'v') setMode('select');
      else if (!command && event.key.toLowerCase() === 'h') setMode('hand');
    };
    const keyup = (event: KeyboardEvent) => { if (event.code === 'Space') setSpaceDown(false); };
    const blur = () => { setSpaceDown(false); setDragging(false); setSelecting(false); setGuides(null); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); };
  }, [active, shownModal.value, shownPreview.value, shownCutout.value, undo, redo, replace, removeSelected, fit]);

  function rememberUpload(image: LibraryImage) {
    if (image.url.startsWith('blob:')) ownedUrls.current.add(image.url);
    setUploads(previous => [...previous.filter(item => item.url !== image.url), image]);
  }
  function addImages(loaded: Omit<CanvasImage, 'x' | 'y'>[]) {
    if (!activeRef.current || !loaded.length) return;
    const previous = current.current.images, bounds = boundsOf(previous);
    let y = bounds ? bounds.y + bounds.height + 40 : 0;
    const additions: CanvasImage[] = [];
    for (let row = 0; row < loaded.length; row += 5) {
      const items = loaded.slice(row, row + 5);
      let x = 0;
      for (const image of items) { additions.push({ ...image, role: undefined, x, y }); x += image.width + 40; }
      y += Math.max(...items.map(image => image.height)) + 40;
    }
    commit({ images: [...previous, ...additions], selected: additions.map(image => image.id) });
    if (canvas.current) setView(fitVideoImages(additions, canvas.current.clientWidth, canvas.current.clientHeight));
    setModal(null); canvas.current?.focus({ preventScroll: true });
  }
  async function loadFiles(files: FileList) {
    if (!activeRef.current || uploadLocked.current || !files.length) return;
    if (files.length > 20) { notify(t.batchImageLimit, 'error'); return; }
    const epoch = ++uploadEpoch.current;
    uploadLocked.current = true; setReading(true);
    const results = await Promise.allSettled(Array.from(files).map(readImage));
    const loaded = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    if (epoch !== uploadEpoch.current || !activeRef.current) { loaded.forEach(image => URL.revokeObjectURL(image.url)); return; }
    loaded.forEach(rememberUpload); addImages(loaded);
    if (results.some(result => result.status === 'rejected')) notify(t.uploadError, 'error');
    uploadLocked.current = false; setReading(false);
  }
  function drop(event: DragEvent) {
    if (!active || modal || preview || cutout) return;
    event.preventDefault(); event.stopPropagation(); setDropActive(false);
    void loadFiles(event.dataTransfer.files);
  }
  function openAssets() { if (active && !reading) setModal('assets'); }
  async function downloadSelected() {
    const images = current.current.images.filter(image => current.current.selected.includes(image.id));
    try {
      await downloadImages(images.map(image => ({ url: image.url, name: /\.[a-z0-9]+$/i.test(image.name) ? image.name : `${image.name}.png` })), 'video-workspace-images.zip');
    } catch { notify(t.downloadError, 'error'); }
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
    <main ref={canvas} hidden={!active} inert={!active} tabIndex={-1} lang={locale} className={`canvas video-workspace${snapshot.images.length ? '' : ' video-workspace--empty'}${spaceDown || mode === 'hand' ? ' is-panning' : ''}${dragging ? ' is-dragging' : ''}`} aria-label={v.title} data-node-id={snapshot.images.length ? '76:5683' : '64:2057'}
      onDragOver={event => { if (active && !modal && !preview && !cutout && event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDropActive(true); } }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropActive(false); }} onDrop={drop}>
      <CanvasBackground view={view} />
      <CanvasProjectPanel title={v.title} icon={<span className="video-workspace-mark"><img src={videoAssets.workspacePlate} alt="" width={20} height={20} /><img src={videoAssets.workspaceIcon} alt="" width={20} height={20} /></span>} projectName={projectName} onProjectNameChange={setProjectName} onBack={onBack} backLabel={v.back} renameLabel={t.rename} nameLabel={t.projectName} nodeId="64:2058" />
      {!snapshot.images.length && <div className="video-empty-scroll">
        <section className="video-empty" data-overlay data-node-id="64:2059">
          <div className="video-empty-headline" data-node-id="64:4159"><h1>{v.headline}</h1><p>{v.intro}</p></div>
          <div className="video-entry-tools" role="group" aria-label={v.title} data-node-id="64:2061">
            {entries.map(entry => <Button key={entry.id} variant="outline" size="l" className="video-entry-tool" disabled={reading} data-node-id={entry.nodeId}
              onClick={() => entry.id === 'templates' ? setModal('templates') : notify(v.pending)}>
              <VideoIcon name={entry.id} /><span>{v[entry.id]}</span>{entry.id === 'templates' && <span className="entry-tool-badge video-entry-badge" data-node-id="64:2066">NEW</span>}
            </Button>)}
          </div>
          <button type="button" className={`asset-upload video-upload${dropActive ? ' is-over' : ''}`} disabled={reading} aria-label={t.addImagesPrompt} onClick={openAssets} data-node-id="64:2068"
            onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.stopPropagation(); setDropActive(true); } }} onDrop={drop}>
            <VideoIcon name="upload" size={32} />
            <span className="asset-upload-title">{reading ? t.reading : dropActive ? t.dropImagesHere : t.addImagesPrompt}</span>
            <span className="asset-upload-hint">{dropActive && !reading ? t.releaseToUpload : t.initialUploadFormats}</span>
          </button>
        </section>
      </div>}
      {active && snapshot.images.length > 0 && <>
        <ReactFlowCanvas view={view} selectedIds={snapshot.selected} hand={spaceDown || mode === 'hand'} referenceMode={false} snap={snapToGrid}
          onView={setView} onSelection={ids => replace({ ...current.current, selected: ids })}
          onPositions={positions => replace({ ...current.current, images: current.current.images.map(image => positions.has(image.id) ? { ...image, ...positions.get(image.id)! } : image) })}
          onDragStart={() => { saveUndo(); setDragging(true); }} onDragEnd={() => { setDragging(false); setGuides(null); }} onGuides={setGuides} onSelecting={setSelecting}>
          {snapshot.images.map(image => <div key={image.id} data-image data-canvas-id={image.id} className={`canvas-image${snapshot.selected.includes(image.id) ? ' selected' : ''}`} style={{ left: image.x, top: image.y, width: image.width, height: image.height }} role="button" tabIndex={0} aria-label={`${t.image}: ${image.name}`} aria-pressed={snapshot.selected.includes(image.id)}
            onKeyDown={event => { if (event.target === event.currentTarget && event.key === 'Enter') { event.preventDefault(); replace({ ...current.current, selected: event.shiftKey ? current.current.selected.includes(image.id) ? current.current.selected.filter(id => id !== image.id) : [...current.current.selected, image.id] : [image.id] }); } }}>
            <Button variant="tonal" className="image-preview-button nodrag nopan" title={t.viewFull} aria-label={`${t.viewFull} · ${image.name}`} onClick={event => { event.stopPropagation(); setPreview(image); }}><Icon name="viewFull" size={20} /></Button>
            <ProgressiveImage src={image.url} alt={image.name} width={image.width} height={image.height} fit="contain" />
          </div>)}
        </ReactFlowCanvas>
        {shownSingle.value && !selecting && <div className="selection-overlay" data-phase={shownSingle.phase} aria-label={t.selectionTools} style={{ left: shownSingle.value.x * view.zoom + view.x, top: shownSingle.value.y * view.zoom + view.y, width: shownSingle.value.width * view.zoom, height: shownSingle.value.height * view.zoom }}>
          <div className="media-toolbar-anchor" data-overlay inert={shownSingle.phase === 'exit'}>
            <VideoSelectionToolbar locale={locale} onDownload={() => void downloadSelected()} onAction={action => {
              if (action === 'cutout') setCutout(singleSelection);
              else notify(locale === 'zh-CN' ? '此功能暂未接入。' : locale === 'ja' ? 'この機能はまだ接続されていません。' : 'This feature is not connected yet.');
            }} />
          </div>
        </div>}
        {shownGroup.value && !selecting && <div className="selection-overlay" data-phase={shownGroup.phase} aria-label={t.groupSelection} style={{ left: shownGroup.value.x * view.zoom + view.x, top: shownGroup.value.y * view.zoom + view.y, width: shownGroup.value.width * view.zoom, height: shownGroup.value.height * view.zoom }}><div className="group-selection-frame" /></div>}
        {shownGuides.value && <div className="canvas-snap-guides" aria-hidden="true" data-phase={shownGuides.phase}>
          {shownGuides.value.x !== undefined && <span className="canvas-snap-guide canvas-snap-guide--vertical" style={{ left: shownGuides.value.x * view.zoom + view.x }} />}
          {shownGuides.value.y !== undefined && <span className="canvas-snap-guide canvas-snap-guide--horizontal" style={{ top: shownGuides.value.y * view.zoom + view.y }} />}
        </div>}
        <CanvasChrome locale={locale} mode={spaceDown ? 'hand' : mode} onMode={setMode} zoom={view.zoom} view={view} canvasSize={canvasSize} images={snapshot.images} showSmartSearch={false}
          sideActions={<>
            <Button className="canvas-icon-button" aria-label={t.platformAssets} onClick={openAssets}><Icon name="platformIcon" size={24} /></Button>
            <Button className="canvas-icon-button" aria-label={v.templates} onClick={() => setModal('templates')}><VideoIcon name="templates" size={24} /></Button>
          </>}
          snapToGrid={snapToGrid} onToggleSnap={() => { setGuides(null); setSnapToGrid(previous => { try { localStorage.setItem('lc-v55-video-grid-snap', previous ? 'off' : 'on'); } catch { /* Session state remains available. */ } return !previous; }); }}
          onNavigateMinimap={(x, y) => setView(previous => ({ ...previous, x: canvasSize.width / 2 - x * previous.zoom, y: canvasSize.height / 2 - y * previous.zoom }))} onMinimapInteraction={setDragging}
          canUndo={history.current.past.length > 0} canRedo={history.current.future.length > 0} onUndo={undo} onRedo={redo} onUpload={openAssets} onZoom={zoom} onFit={fit}
          onArrange={() => { const images = arrangeImages(current.current.images); commit({ ...current.current, images }); if (canvas.current) setView(fitVideoImages(images, canvas.current.clientWidth, canvas.current.clientHeight)); }}
          onHelp={() => setModal('help')} onDemo={() => notify(v.pending)} />
        {shownReturn.value && <div className="canvas-return-hint" data-overlay data-phase={shownReturn.phase} inert={shownReturn.phase === 'exit'}><p>{t.noNodesInView}</p><Button variant="primary" onClick={fit}>{t.returnToNodes}</Button></div>}
      </>}
      {shownDrop.value && <div className="drop-overlay flex items-center justify-center pointer-events-none" data-phase={shownDrop.phase}><span>{t.dropImagesHere}</span></div>}
      {reading && snapshot.images.length > 0 && <div className="canvas-message" role="status">{t.reading}</div>}
      <span className="sr-only" role="status">{snapshot.images.length} {t.image} · {snapshot.selected.length} {t.selected}</span>
    </main>
    {active && shownModal.value === 'templates' && <VideoTemplateDialog locale={locale} onClose={closeModal} phase={shownModal.phase} uploads={uploads} onUpload={rememberUpload} />}
    {active && shownModal.value === 'assets' && <AssetPicker locale={locale} phase={shownModal.phase} uploads={uploads} onUpload={rememberUpload} onConfirm={image => addImages([image])} onConfirmBatch={addImages} onClose={closeModal} />}
    {active && shownModal.value === 'help' && <Dialog title={t.helpIntro} closeLabel={t.close} onClose={closeModal} phase={shownModal.phase}><p className="video-canvas-help">{v.help}</p></Dialog>}
    {active && shownPreview.value && <FullImageViewer image={shownPreview.value} locale={locale} phase={shownPreview.phase} onClose={() => setPreview(null)} />}
    {active && shownCutout.value && <CutoutEditor key={shownCutout.value.id} image={shownCutout.value} phase={shownCutout.phase} onClose={() => setCutout(null)} onApply={url => {
      const source = shownCutout.value!;
      ownedUrls.current.add(url);
      const result: CanvasImage = { ...source, id: crypto.randomUUID(), name: `${source.name}-cutout.png`, url, x: source.x + source.width + 80 };
      commit({ images: [...current.current.images, result], selected: [result.id] });
      setCutout(null);
    }} />}
  </>;
}
