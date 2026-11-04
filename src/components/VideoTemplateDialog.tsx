import { useEffect, useId, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import type { LibraryImage } from '../asset-library';
import { readImage } from '../canvas';
import type { Locale } from '../i18n';
import { usePresence } from '../usePresence';
import { videoAssets } from '../video-assets';
import { videoTemplateMedia, videoTemplateMessages, videoTemplates, type VideoTemplateId, type VideoTemplateReplacements } from '../video-templates';
import { videoWorkflowTitle } from '../video-workflow';
import { AssetPicker } from './AssetPicker';
import { GenerateTaskButton } from './GenerateTaskButton';
import { TagChip } from './TagChip';
import { VideoTemplateReferences } from './VideoTemplateReferences';
import { notify } from './Toast';
import { Button, Dialog, Divider, Icon } from './ui';
import '../video-template-dialog.css';

type UploadedImage = { id: string; url: string; name: string };
type TemplateUploads = Partial<Record<VideoTemplateId, UploadedImage[]>>;
const uploadLimit = 9;

function TemplateImageUploads({ locale, images, active, onAdd, onRemove, onUpload, onChoose, onBusyChange }: {
  locale: Locale;
  images: UploadedImage[];
  active: boolean;
  onAdd: (images: UploadedImage[]) => void;
  onRemove: (id: string) => void;
  onUpload: (image: LibraryImage) => void;
  onChoose: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const t = videoTemplateMessages[locale];
  const id = useId();
  const addButton = useRef<HTMLButtonElement>(null);
  const request = useRef(0);
  const dragDepth = useRef(0);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const busyCallback = useRef(onBusyChange); busyCallback.current = onBusyChange;
  useEffect(() => { busyCallback.current(busy); return () => busyCallback.current(false); }, [busy]);
  useEffect(() => () => { request.current++; }, []);
  useEffect(() => {
    if (!active) { request.current++; locked.current = false; setBusy(false); setDragging(false); dragDepth.current = 0; }
  }, [active]);

  async function upload(files: File[]) {
    if (!active || locked.current || !files.length) return;
    if (files.length + images.length > uploadLimit) { notify(t.imageLimit, 'error'); return; }
    if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024)) {
      notify(t.uploadError, 'error'); return;
    }
    const version = ++request.current;
    locked.current = true; setBusy(true);
    const loaded: Awaited<ReturnType<typeof readImage>>[] = [];
    try {
      for (const file of files) {
        const image = await readImage(file);
        loaded.push(image);
        if (version !== request.current) return;
      }
      loaded.forEach(onUpload);
      onAdd(loaded.map(image => ({ id: crypto.randomUUID(), url: image.url, name: image.name })));
      loaded.length = 0; // Uploaded URLs are now owned by the workspace history.
    } catch {
      if (version === request.current) notify(t.decodeError, 'error');
    } finally {
      loaded.forEach(image => URL.revokeObjectURL(image.url));
      if (version === request.current) { locked.current = false; setBusy(false); }
    }
  }

  return <section className="video-template-uploads" aria-labelledby={`${id}-title`} aria-describedby={`${id}-count`}>
    <header className="video-template-upload-heading">
      <h4 id={`${id}-title`}>{t.uploadTitle}</h4>
      <p id={`${id}-count`} aria-live="polite">{t.uploadCount}<span className="video-template-upload-count">{images.length}</span>/{uploadLimit}</p>
    </header>
    <span id={`${id}-formats`} className="video-template-visually-hidden">{t.formats}</span>
    <div className="video-template-upload-grid" data-dragging={dragging} aria-busy={busy}
      onDragEnter={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); event.stopPropagation(); if (active && !busy && event.dataTransfer.types.includes('Files')) { dragDepth.current++; setDragging(true); } }}
      onDragOver={event => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = active && !busy ? 'copy' : 'none'; }}
      onDragLeave={event => { event.preventDefault(); event.stopPropagation(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }}
      onDrop={event => { event.preventDefault(); event.stopPropagation(); dragDepth.current = 0; setDragging(false); void upload(Array.from(event.dataTransfer.files)); }}>
      {images.map(image => <div key={image.id} className="video-template-upload-tile">
        <div className="video-template-thumbnail"><img src={image.url} alt={image.name} draggable={false} /></div>
        <Button variant="tonal" className="video-template-upload-remove" aria-label={`${t.remove} · ${image.name}`} disabled={!active || busy}
          onClick={() => { onRemove(image.id); requestAnimationFrame(() => addButton.current?.focus()); }}><Icon name="templateUploadClose" size={16} /></Button>
      </div>)}
      {images.length < uploadLimit && <button ref={addButton} type="button" className="video-template-upload-add" aria-label={t.addImages} aria-describedby={`${id}-formats`} aria-haspopup="dialog" disabled={!active || busy} onClick={onChoose}>
        <Icon name="templateUploadAdd" size={20} />
      </button>}
    </div>
    {busy && <p className="video-template-upload-status" role="status">{t.reading}</p>}
  </section>;
}

export function VideoTemplateDialog({ locale, onClose, phase, uploads: libraryUploads, onUpload, onGenerate, onEdit }: {
  locale: Locale;
  onClose: () => void;
  phase: 'enter' | 'exit';
  uploads: LibraryImage[];
  onUpload: (image: LibraryImage) => void;
  onGenerate: (templateId: VideoTemplateId, replacements: VideoTemplateReplacements, signal: AbortSignal) => Promise<boolean>;
  onEdit: (templateId: VideoTemplateId, replacements: VideoTemplateReplacements, signal: AbortSignal) => Promise<boolean>;
}) {
  const t = videoTemplateMessages[locale];
  const id = useId();
  const [selected, setSelected] = useState<VideoTemplateId>('commerce');
  const [uploads, setUploads] = useState<TemplateUploads>({});
  const [imagePicker, setImagePicker] = useState<{ templateId: VideoTemplateId } | null>(null);
  const shownPicker = usePresence(phase === 'enter' ? imagePicker : null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const generationRequest = useRef<AbortController | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const template = videoTemplates.find(item => item.id === selected)!;
  const { video: videoSource, poster } = videoTemplateMedia(template);
  const canEdit = phase === 'enter' && !submitting && !uploadBusy && !shownPicker.value
    && Boolean(template.preview && template.workflow);
  const canGenerate = canEdit && Boolean(uploads[selected]?.length);

  useEffect(() => () => { generationRequest.current?.abort(); generationRequest.current = null; }, []);
  useEffect(() => { if (phase === 'exit') generationRequest.current?.abort(); }, [phase]);

  async function submit(action: 'edit' | 'generate') {
    if (!(action === 'edit' ? canEdit : canGenerate) || generationRequest.current) return;
    const request = new AbortController();
    generationRequest.current = request;
    setSubmitting(true);
    try {
      const created = await (action === 'edit' ? onEdit : onGenerate)(selected, [...(uploads[selected] ?? [])], request.signal);
      if (created && !request.signal.aborted) close();
    } catch {
      if (!request.signal.aborted) notify(t.generateError, 'error');
    } finally {
      if (generationRequest.current === request) {
        generationRequest.current = null;
        setSubmitting(false);
      }
    }
  }

  useEffect(() => {
    const player = video.current;
    if (phase === 'exit') player?.pause();
    return () => { player?.pause(); };
  }, [phase, selected]);

  function close() { generationRequest.current?.abort(); video.current?.pause(); setImagePicker(null); onClose(); }

  function selectTemplate(next: VideoTemplateId) {
    if (next === selected) return;
    generationRequest.current?.abort(); generationRequest.current = null;
    setSubmitting(false); setUploadBusy(false);
    video.current?.pause();
    setVideoFailed(false);
    setSelected(next);
  }

  function selectWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === 'ArrowDown') next = (index + 1) % videoTemplates.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + videoTemplates.length) % videoTemplates.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = videoTemplates.length - 1;
    else return;
    event.preventDefault();
    selectTemplate(videoTemplates[next].id);
    tabs.current[next]?.focus();
  }

  function addImages(templateId: VideoTemplateId, images: UploadedImage[]) {
    setUploads(previous => {
      const existing = previous[templateId] ?? [];
      if (existing.length + images.length > uploadLimit) return previous;
      return { ...previous, [templateId]: [...existing, ...images] };
    });
  }

  function chooseImages() {
    if (phase === 'enter' && !submitting && !uploadBusy && !shownPicker.value && (uploads[selected]?.length ?? 0) < uploadLimit) {
      setImagePicker({ templateId: selected });
    }
  }

  function confirmImages(images: { url: string; name: string }[]) {
    if (phase !== 'enter' || !imagePicker || imagePicker.templateId !== selected) return;
    if (images.length + (uploads[selected]?.length ?? 0) > uploadLimit) { notify(t.imageLimit, 'error'); return; }
    addImages(selected, images.map(image => ({ ...image, id: crypto.randomUUID() })));
    setImagePicker(null);
  }

  return <><Dialog title={t.title} closeLabel={t.close} onClose={close} phase={phase} className="video-template-dialog" header={false} labelledBy={`${id}-title`}>
    <aside className="video-template-sidebar">
      <h2 id={`${id}-title`}>{t.title}</h2>
      <div className="video-template-tabs" role="tablist" aria-orientation="vertical" aria-label={t.categories}>
        {videoTemplates.map((item, index) => <button key={item.id} ref={element => { tabs.current[index] = element; }} type="button" role="tab" id={`${id}-tab-${item.id}`} aria-selected={selected === item.id} aria-controls={`${id}-content`} tabIndex={selected === item.id ? 0 : -1}
          onClick={() => selectTemplate(item.id)} onKeyDown={event => selectWithKeyboard(event, index)}>{item.label[locale]}</button>)}
      </div>
    </aside>
    <Divider vertical />
    <section id={`${id}-content`} role="tabpanel" aria-labelledby={`${id}-tab-${selected}`} className={`video-template-content${template.preview ? '' : ' is-empty'}`}>
      {template.preview ? <>
        <div className="video-template-preview" data-orientation={template.preview}>
          {videoSource && !videoFailed ? <video key={selected} ref={video} src={videoSource} poster={poster} controls playsInline preload="metadata" aria-label={template.label[locale]} onError={() => setVideoFailed(true)} />
            : <><img src={poster} alt={template.label[locale]} /><p className="video-template-preview-notice" role="status">{videoFailed ? t.videoError : t.videoUnavailable}</p></>}
        </div>
        <div className="video-template-details">
          <div className="video-template-close"><Button aria-label={t.close} onClick={close}><Icon name="close" size={20} /></Button></div>
          <div className="video-template-detail-body">
            <header className="video-template-heading" data-node-id="141:24213">
              <div className="video-template-title"><h3>{template.label[locale]}</h3><p>{template.description?.[locale]}</p></div>
              {template.references && <VideoTemplateReferences key={selected} locale={locale} references={template.references} />}
              {template.workflow && <div className="video-template-configuration" data-node-id="141:24226">
                <TagChip>{videoWorkflowTitle(template.workflow.mode, locale)}</TagChip>
                <TagChip>{template.workflow.ratio} ｜ {template.workflow.resolution} ｜ {template.workflow.duration}</TagChip>
              </div>}
            </header>
            <Divider />
            <TemplateImageUploads key={selected} locale={locale} images={uploads[selected] ?? []} active={phase === 'enter' && !submitting && !shownPicker.value}
              onAdd={images => addImages(selected, images)} onRemove={imageId => setUploads(previous => ({ ...previous, [selected]: previous[selected]?.filter(image => image.id !== imageId) }))}
              onUpload={onUpload} onChoose={chooseImages} onBusyChange={setUploadBusy} />
          </div>
          <footer className="video-template-actions"><Button variant="secondary" size="m" disabled={!canEdit} onClick={() => { void submit('edit'); }}>{t.edit}</Button><GenerateTaskButton label={submitting ? t.preparing : t.generate} cost="80" disabled={!canGenerate} aria-busy={submitting} onClick={() => { void submit('generate'); }} /></footer>
        </div>
      </> : <>
        <div className="video-template-close"><Button aria-label={t.close} onClick={close}><Icon name="close" size={20} /></Button></div>
        <div className="video-template-empty"><img src={videoAssets.empty} width={128} height={128} alt="" /><h3>{t.emptyTitle}</h3><p>{t.emptyDescription}</p></div>
      </>}
    </section>
  </Dialog>
    {shownPicker.value && <AssetPicker locale={locale} phase={shownPicker.phase} uploads={libraryUploads} onUpload={onUpload} mediaKind="image" maxCount={uploadLimit - (uploads[shownPicker.value.templateId]?.length ?? 0)} limitMessage={t.imageLimit} onConfirm={image => confirmImages([image])} onConfirmBatch={confirmImages} onClose={() => setImagePicker(null)} />}
  </>;
}
