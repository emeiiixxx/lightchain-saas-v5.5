import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Locale } from '../i18n';
import { useHoverDismiss } from '../useHoverDismiss';
import { usePresence } from '../usePresence';
import { videoTemplateReferenceAssets as assets, type VideoTemplateReferenceSet } from '../video-template-reference-assets';
import { ProgressiveImage } from './ProgressiveImage';
import { Button } from './ui';
import './video-template-references.css';

type Kind = 'subject' | 'model';
type Target = { kind: Kind; anchor: HTMLButtonElement; container: HTMLElement };
type Props = { locale: Locale; references: VideoTemplateReferenceSet; active?: boolean };
const previewHeight = 256;
const previewFrameInset = 10; // Two 4px padding edges and two 1px borders.
const copy = {
  'zh-CN': {
    references: '模版参考素材', subject: (count: number) => `商品-${count}张`, model: '模特',
    subjectPreview: '预览商品', modelPreview: '预览模特',
    subjectImage: (index: number) => `商品图片 ${index}`, previous: '上一张', next: '下一张',
    description: '28–35 岁轻熟女性，深棕色短款蓬松自然卷发配碎刘海，长瘦脸型、五官立体轮廓清晰；暖调小麦色皮肤，清透淡妆搭配裸棕唇色，身材纤细高挑、肩颈四肢线条利落。',
  },
  en: {
    references: 'Template references', subject: (count: number) => `Product · ${count}`, model: 'Model',
    subjectPreview: 'Preview product', modelPreview: 'Preview model',
    subjectImage: (index: number) => `Product image ${index}`, previous: 'Previous image', next: 'Next image',
    description: 'A woman aged 28–35 with short, voluminous dark brown curls and wispy bangs; a long, slim face with defined features, warm tan skin, sheer makeup and nude brown lips. Tall and slender, with clean shoulder and limb lines.',
  },
  ja: {
    references: 'テンプレートの参考素材', subject: (count: number) => `商品・${count}枚`, model: 'モデル',
    subjectPreview: '商品をプレビュー', modelPreview: 'モデルをプレビュー',
    subjectImage: (index: number) => `商品の画像 ${index}`, previous: '前の画像', next: '次の画像',
    description: '28〜35歳の大人の女性。ダークブラウンのふんわりした短い天然パーマに薄い前髪、細長い顔と立体的な目鼻立ち。暖かみのある小麦色の肌に薄化粧とヌードブラウンのリップ。すらりとした高身長で、肩や首、手足のラインが美しい。',
  },
};

export function VideoTemplateReferences({ locale, references, active = true }: Props) {
  const t = copy[locale];
  const subjectImages = references.subjects;
  const [target, setTarget] = useState<Target | null>(null);
  const [subjectIndex, setSubjectIndex] = useState(0);
  const shown = usePresence(active ? target : null);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const restoringFocus = useRef(false);
  const id = useId();
  const close = useCallback(() => setTarget(null), []);
  const dismissIfIdle = useCallback(() => {
    const focused = document.activeElement;
    const keyboardFocusInside = focused instanceof HTMLElement && focused.matches(':focus-visible')
      && (root.current?.contains(focused) || panel.current?.contains(focused));
    // A slide change can move the hit target or blur an arrow. Recheck the
    // complete interactive surface before honoring a queued hover dismissal.
    if (root.current?.matches(':hover') || panel.current?.matches(':hover') || keyboardFocusInside) return;
    setTarget(null);
  }, []);
  const hover = useHoverDismiss(active && target !== null, dismissIfIdle);
  const contains = (node: EventTarget | null) => node instanceof Node && (root.current?.contains(node) || panel.current?.contains(node));

  function expand(kind: Kind, anchor: HTMLButtonElement) {
    if (!active) return;
    hover.cancel();
    if (kind === 'subject' && target?.kind !== 'subject') setSubjectIndex(0);
    setTarget(current => current?.kind === kind && current.anchor === anchor ? current : {
      kind, anchor, container: anchor.closest('dialog') ?? document.body,
    });
  }

  function selectSubject(index: number) {
    hover.cancel();
    setSubjectIndex(Math.max(0, Math.min(index, subjectImages.length - 1)));
  }

  useEffect(() => {
    if (active) return;
    hover.cancel();
    setTarget(null);
  }, [active, hover.cancel]);

  useEffect(() => {
    if (!active || !target) return;
    const outside = (event: PointerEvent | FocusEvent) => {
      const node = event.target as Node | null;
      if (!root.current?.contains(node) && !panel.current?.contains(node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      close();
      restoringFocus.current = true;
      target.anchor.focus({ preventScroll: true });
      restoringFocus.current = false;
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('focusin', outside, true);
    document.addEventListener('keydown', escape, true);
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('focusin', outside, true);
      document.removeEventListener('keydown', escape, true);
      window.removeEventListener('blur', close);
    };
  }, [active, target, close]);

  useLayoutEffect(() => {
    if (!shown.value || !panel.current) return;
    const popup = panel.current;
    const { anchor } = shown.value;
    // A dialog-owned top-layer popover stays visible above the native modal,
    // while escaping the dialog's scrolling and rounded content clipping.
    if (!popup.matches(':popover-open')) popup.showPopover();
    let frame = 0;
    const pictureSizes = new WeakMap<HTMLElement, { width: number; height: number }>();
    const position = () => {
      const dialog = anchor.closest('dialog');
      if (!anchor.isConnected || anchor.closest('[inert]') || (dialog && !dialog.open)) { close(); return; }
      const rect = anchor.getBoundingClientRect();
      const width = window.innerWidth, height = window.innerHeight;
      if (rect.bottom <= 0 || rect.top >= height || rect.right <= 0 || rect.left >= width) { close(); return; }
      const pictures = Array.from(popup.querySelectorAll<HTMLElement>('.video-template-reference-preview-picture'));
      const sizes = pictures.map(picture => {
        const image = picture.querySelector<HTMLImageElement>('.progressive-image-full');
        // Keep the current frame while the next image loads, so the carousel
        // controls do not jump out from under the pointer between slides.
        if (!image?.naturalWidth || !image.naturalHeight) return pictureSizes.get(picture) ?? { width: (previewHeight - previewFrameInset) * .75, height: previewHeight - previewFrameInset };
        const { naturalWidth, naturalHeight } = image;
        const scale = (previewHeight - previewFrameInset) / naturalHeight;
        const size = { width: naturalWidth * scale, height: naturalHeight * scale };
        pictureSizes.set(picture, size);
        return size;
      });
      const frameWidth = previewFrameInset + (pictures.length - 1) * 4;
      // Keep a fixed-height preview below the card. Only constrain its width
      // at the viewport edge; contain keeps the full image visible on narrow screens.
      const left = Math.max(8, rect.left);
      const top = rect.bottom + 8;
      const availableWidth = width - left - 8;
      if (availableWidth <= frameWidth) { close(); return; }
      const imagesWidth = sizes.reduce((total, size) => total + size.width, 0);
      const fitScale = Math.max(0, Math.min(1, (availableWidth - frameWidth) / imagesWidth));
      const popupWidth = imagesWidth * fitScale + frameWidth;
      pictures.forEach((picture, index) => {
        picture.style.width = `${sizes[index].width * fitScale}px`;
        picture.style.height = `${previewHeight - previewFrameInset}px`;
      });
      popup.style.width = `${popupWidth}px`;
      popup.style.height = `${previewHeight}px`;
      popup.style.left = `${left}px`;
      popup.style.top = `${top}px`;
      popup.style.visibility = 'visible';
      frame = requestAnimationFrame(position);
    };
    position();
    return () => {
      cancelAnimationFrame(frame);
      if (popup.matches(':popover-open')) popup.hidePopover();
    };
  }, [shown.value, close]);

  return <div ref={root} className="video-template-references" role="group" aria-label={t.references}
    onPointerEnter={hover.cancel}
    onPointerDownCapture={hover.cancel}
    onFocusCapture={hover.cancel}
    onPointerLeave={event => { if (!contains(event.relatedTarget)) hover.schedule(); }}
    onBlur={event => { if (!contains(event.relatedTarget)) hover.schedule(); }}>
    {(['subject', 'model'] as const).map(kind => <button type="button" key={kind}
      className="video-template-reference-card" aria-label={kind === 'subject' ? t.subjectPreview : t.modelPreview}
      aria-expanded={active && target?.kind === kind} aria-controls={target?.kind === kind ? id : undefined}
      onPointerEnter={event => { if (event.pointerType !== 'touch') expand(kind, event.currentTarget); }}
      onFocus={event => { if (!restoringFocus.current && event.currentTarget.matches(':focus-visible')) expand(kind, event.currentTarget); }}
      onClick={event => expand(kind, event.currentTarget)}>
      <ProgressiveImage src={kind === 'subject' ? references.subjectThumbnail : references.modelThumbnail} alt="" eager />
      <span className="video-template-reference-badge">{kind === 'subject' ? t.subject(subjectImages.length) : t.model}</span>
    </button>)}
    {shown.value && createPortal(<div ref={panel} id={id} popover="manual" role="region"
      className="video-template-reference-preview" data-kind={shown.value.kind} data-phase={shown.phase}
      data-node-id={shown.value.kind === 'subject' ? '141:24346' : '141:24242'}
      aria-label={shown.value.kind === 'subject' ? t.subjectPreview : t.modelPreview}
      inert={shown.phase === 'exit'} style={{ visibility: 'hidden' }}
      onPointerEnter={hover.cancel}
      onPointerLeave={event => { if (!contains(event.relatedTarget)) hover.schedule(); }}
      onKeyDown={event => {
        if (shown.value?.kind !== 'subject' || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        selectSubject(event.key === 'Home' ? 0 : event.key === 'End' ? subjectImages.length - 1 : subjectIndex + (event.key === 'ArrowRight' ? 1 : -1));
      }}>
      {shown.value.kind === 'subject' ? <>
        <div className="video-template-reference-preview-picture">
          <ProgressiveImage key={subjectImages[subjectIndex]} src={subjectImages[subjectIndex]} alt={t.subjectImage(subjectIndex + 1)} className="video-template-subject-slide" fit="contain" eager />
        </div>
        {subjectImages.length > 1 && <div className="video-template-subject-switcher" data-node-id="141:25137">
          <Button className="video-template-subject-arrow" aria-label={t.previous} aria-disabled={subjectIndex === 0} tabIndex={subjectIndex === 0 ? -1 : 0} onClick={() => selectSubject(subjectIndex - 1)}>
            <span aria-hidden="true" className="icon" style={{ width: 16, height: 16, '--icon-url': `url("${assets.subjectPrevious}")` } as CSSProperties} />
          </Button>
          <span aria-live="polite" aria-atomic="true">{subjectIndex + 1}/{subjectImages.length}</span>
          <Button className="video-template-subject-arrow" aria-label={t.next} aria-disabled={subjectIndex === subjectImages.length - 1} tabIndex={subjectIndex === subjectImages.length - 1 ? -1 : 0} onClick={() => selectSubject(subjectIndex + 1)}>
            <span aria-hidden="true" className="icon" style={{ width: 16, height: 16, '--icon-url': `url("${assets.subjectNext}")` } as CSSProperties} />
          </Button>
        </div>}
      </> : <div className="video-template-reference-preview-picture video-template-reference-model">
        <div className="video-template-reference-model-art"><ProgressiveImage src={references.modelPreview} alt={t.model} fit="contain" eager /></div>
        {references.hasModelDescription && <p className="video-template-reference-model-description">{t.description}</p>}
      </div>}
    </div>, shown.value.container)}
  </div>;
}
