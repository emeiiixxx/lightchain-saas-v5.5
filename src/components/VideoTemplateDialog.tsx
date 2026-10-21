import { useEffect, useId, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { readImage } from '../canvas';
import type { Locale } from '../i18n';
import { videoAssets } from '../video-assets';
import { videoTemplateMessages, videoTemplates, type VideoTemplateId } from '../video-templates';
import { GenerateTaskButton } from './GenerateTaskButton';
import { notify } from './Toast';
import { Button, Dialog, Divider, Icon } from './ui';
import '../video-template-dialog.css';

type UploadedImage = { url: string; name: string };
type ImageSlot = 'garment' | 'model';
type TemplateUploads = Partial<Record<VideoTemplateId, Partial<Record<ImageSlot, UploadedImage>>>>;

function TemplateImageField({ locale, slot, value, onChange, active }: {
  locale: Locale;
  slot: ImageSlot;
  value?: UploadedImage;
  onChange: (image?: UploadedImage) => void;
  active: boolean;
}) {
  const t = videoTemplateMessages[locale];
  const label = slot === 'garment' ? t.garment : t.model;
  const placeholder = slot === 'garment' ? t.garmentPlaceholder : t.modelPlaceholder;
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const emptyButton = useRef<HTMLButtonElement>(null);
  const request = useRef(0);
  const dragDepth = useRef(0);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => { request.current++; }, []);
  useEffect(() => {
    if (!active) { request.current++; setBusy(false); setDragging(false); dragDepth.current = 0; }
  }, [active]);

  async function upload(files: File[]) {
    if (!active || files.length === 0) return;
    const version = ++request.current;
    setBusy(false);
    if (files.length !== 1) { notify(t.singleImage, 'error'); return; }
    const file = files[0];
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) {
      notify(t.uploadError, 'error');
      return;
    }
    setBusy(true);
    try {
      const image = await readImage(file);
      if (version !== request.current) { URL.revokeObjectURL(image.url); return; }
      onChange({ url: image.url, name: image.name });
    } catch {
      if (version === request.current) notify(t.decodeError, 'error');
    } finally {
      if (version === request.current) setBusy(false);
    }
  }

  function dragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (active && event.dataTransfer.types.includes('Files')) { dragDepth.current++; setDragging(true); }
  }

  return <section className="video-template-image-field" aria-labelledby={`${id}-label`}>
    <h4 id={`${id}-label`}>{label}</h4>
    <input ref={input} id={`${id}-input`} className="video-template-file-input" type="file" accept="image/jpeg,image/png,image/webp" tabIndex={-1} aria-label={label} disabled={!active}
      onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ''; void upload(files); }} />
    <span id={`${id}-formats`} className="video-template-visually-hidden">{t.formats}</span>
    <div className="video-template-upload" data-filled={!!value} data-dragging={dragging} aria-busy={busy}
      onDragEnter={dragEnter}
      onDragOver={event => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = active ? 'copy' : 'none'; }}
      onDragLeave={event => { event.preventDefault(); event.stopPropagation(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }}
      onDrop={event => { event.preventDefault(); event.stopPropagation(); dragDepth.current = 0; setDragging(false); void upload(Array.from(event.dataTransfer.files)); }}>
      {value ? <>
        <div className="video-template-thumbnail">
          <img src={value.url} alt={value.name} />
          <div className="video-template-image-actions">
            <Button aria-label={`${t.replace} · ${label}`} disabled={!active} onClick={() => input.current?.click()}><Icon name="promptCoverReplace" size={16} /></Button>
            <Button aria-label={`${t.remove} · ${label}`} disabled={!active} onClick={() => { request.current++; setBusy(false); onChange(); requestAnimationFrame(() => emptyButton.current?.focus()); }}><Icon name="promptTrash" size={16} /></Button>
          </div>
        </div>
        <p className="video-template-file-name">{value.name}</p>
      </> : <button ref={emptyButton} type="button" className="video-template-upload-empty" aria-label={`${label} · ${placeholder}`} aria-describedby={`${id}-formats`} disabled={!active} onClick={() => input.current?.click()}>
        <Icon name="promptCoverAddImage" size={24} /><span>{busy ? t.reading : placeholder}</span>
      </button>}
      {busy && value && <span className="video-template-upload-status" role="status">{t.reading}</span>}
    </div>
  </section>;
}

export function VideoTemplateDialog({ locale, onClose, phase }: { locale: Locale; onClose: () => void; phase: 'enter' | 'exit' }) {
  const t = videoTemplateMessages[locale];
  const id = useId();
  const [selected, setSelected] = useState<VideoTemplateId>('commerce');
  const [uploads, setUploads] = useState<TemplateUploads>({});
  const [videoFailed, setVideoFailed] = useState(false);
  const uploadsRef = useRef<TemplateUploads>({});
  const video = useRef<HTMLVideoElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const template = videoTemplates.find(item => item.id === selected)!;
  const media: { portraitVideo?: string; landscapeVideo?: string; portraitPoster: string; landscapePoster: string } = videoAssets;
  const videoSource = template.preview === 'portrait' ? media.portraitVideo : media.landscapeVideo;
  const poster = template.preview === 'portrait' ? media.portraitPoster : media.landscapePoster;

  useEffect(() => () => {
    for (const draft of Object.values(uploadsRef.current)) {
      for (const image of Object.values(draft ?? {})) if (image) URL.revokeObjectURL(image.url);
    }
    uploadsRef.current = {};
  }, []);
  useEffect(() => {
    const player = video.current;
    if (phase === 'exit') player?.pause();
    return () => { player?.pause(); };
  }, [phase, selected]);

  function close() { video.current?.pause(); onClose(); }

  function selectTemplate(next: VideoTemplateId) {
    if (next === selected) return;
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

  function changeImage(slot: ImageSlot, image?: UploadedImage) {
    const previous = uploadsRef.current[selected]?.[slot];
    const next = { ...uploadsRef.current, [selected]: { ...uploadsRef.current[selected], [slot]: image } };
    uploadsRef.current = next;
    setUploads(next);
    if (previous && previous.url !== image?.url) URL.revokeObjectURL(previous.url);
  }

  return <Dialog title={t.title} closeLabel={t.close} onClose={close} phase={phase} className={`video-template-dialog${template.preview ? '' : ' video-template-dialog--empty'}`} header={false} labelledBy={`${id}-title`}>
    <aside className="video-template-sidebar">
      <h2 id={`${id}-title`}>{t.title}</h2>
      {!template.preview && <Divider />}
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
            <header className="video-template-heading"><h3>{template.label[locale]}</h3><p>{template.description?.[locale]}</p></header>
            <ul className="video-template-features"><li>{template.preview === 'portrait' ? t.portraitShots : t.landscapeShots}</li><li>{t.replaceImages}</li><li>{t.adjustNodes}</li></ul>
            <Divider />
            <div className="video-template-uploads" key={selected}>
              <TemplateImageField locale={locale} slot="garment" value={uploads[selected]?.garment} active={phase === 'enter'} onChange={image => changeImage('garment', image)} />
              <TemplateImageField locale={locale} slot="model" value={uploads[selected]?.model} active={phase === 'enter'} onChange={image => changeImage('model', image)} />
            </div>
          </div>
          <footer className="video-template-actions"><Button variant="secondary" size="m" onClick={() => notify(t.editPending)}>{t.edit}</Button><GenerateTaskButton label={t.generate} cost="80" onClick={() => notify(t.generatePending)} /></footer>
        </div>
      </> : <>
        <div className="video-template-close"><Button aria-label={t.close} onClick={close}><Icon name="close" size={20} /></Button></div>
        <div className="video-template-empty"><img src={videoAssets.empty} width={128} height={128} alt="" /><h3>{t.emptyTitle}</h3><p>{t.emptyDescription}</p></div>
      </>}
    </section>
  </Dialog>;
}
