import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Locale } from '../i18n';
import type { VideoWorkflow } from '../video-workflow';
import { usePresence } from '../usePresence';
import { Icon } from './ui';
import '../video-generation-settings.css';

// Reuse v5.4 GenerationSettings ratio order, original SVGs and segmented controls.
const ratios = ['auto', '2:3', '3:4', '9:16', '1:1', '3:2', '4:3', '16:9'];
const resolutions = ['480p', '720p', '1080p'];
const durations = ['5s', '10s', '15s'];
const assetBase = `${import.meta.env.BASE_URL}assets/video-settings/`;
const copy = {
  'zh-CN': { settings: '生成设置', ratio: '视频比例', resolution: '选择清晰度', duration: '视频时长', auto: '智能' },
  en: { settings: 'Generation settings', ratio: 'Aspect ratio', resolution: 'Resolution', duration: 'Duration', auto: 'Auto' },
  ja: { settings: '生成設定', ratio: '動画の比率', resolution: '解像度', duration: '動画の長さ', auto: '自動' },
};
type Settings = Pick<VideoWorkflow, 'ratio' | 'resolution' | 'duration'>;
type Option = { value: string; label: string; icon?: string };

function ParameterSegments({ label, options, value, onChange, vertical = false }: {
  label: string; options: Option[]; value: string; onChange: (value: string) => void; vertical?: boolean;
}) {
  return <div className="video-parameter-segments-scroll nowheel"><div className={`video-parameter-segments${vertical ? ' video-parameter-segments--ratios' : ''}`} role="radiogroup" aria-label={label} style={{ '--segments': options.length } as CSSProperties}>
    {options.map((option, index) => <button type="button" role="radio" aria-checked={value === option.value} tabIndex={value === option.value ? 0 : -1} key={option.value}
      onClick={() => { if (value !== option.value) onChange(option.value); }}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length;
        if (options[next].value !== value) onChange(options[next].value);
        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
      }}>
      {option.icon && <span className="icon" aria-hidden="true" style={{ width: 16, height: 16, '--icon-url': `url("${option.icon}")` } as CSSProperties} />}<span>{option.label}</span>
    </button>)}
  </div></div>;
}

export function VideoGenerationSettings({ locale, value, onChange }: {
  locale: Locale; value: Settings; onChange: (patch: Partial<Settings>) => void;
}) {
  const t = copy[locale];
  const [open, setOpen] = useState(false);
  const shown = usePresence(open ? true : null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const keyboardOpen = useRef(false);
  const id = useId();
  const summary = `${value.ratio === 'auto' ? t.auto : value.ratio} ｜ ${value.resolution} ｜ ${value.duration}`;

  useEffect(() => {
    if (!open) return;
    const outside = (target: EventTarget | null) => target instanceof Node && !trigger.current?.contains(target) && !panel.current?.contains(target);
    const dismiss = (event: PointerEvent) => {
      if (!outside(event.target)) return;
      setOpen(false);
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && (focused === trigger.current || panel.current?.contains(focused))) focused.blur();
    };
    const focus = (event: FocusEvent) => { if (outside(event.target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation();
      setOpen(false); trigger.current?.focus();
    };
    const otherSelect = (event: Event) => { if ((event as CustomEvent<string>).detail !== id) setOpen(false); };
    document.addEventListener('pointerdown', dismiss, true);
    document.addEventListener('focusin', focus, true);
    document.addEventListener('keydown', escape);
    document.addEventListener('lc-select-open', otherSelect);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
      document.removeEventListener('focusin', focus, true);
      document.removeEventListener('keydown', escape);
      document.removeEventListener('lc-select-open', otherSelect);
    };
  }, [open, id]);

  useLayoutEffect(() => {
    if (!shown.value || !panel.current || !trigger.current) return;
    const popup = panel.current;
    if (!popup.matches(':popover-open')) popup.showPopover();
    let frame = 0;
    const position = () => {
      const anchor = trigger.current;
      if (!anchor?.isConnected || !anchor.getClientRects().length || anchor.closest('[hidden], [inert]')) { setOpen(false); return; }
      const rect = anchor.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) { setOpen(false); return; }
      popup.style.left = `${Math.max(16, Math.min(rect.left + rect.width / 2 - popup.offsetWidth / 2, innerWidth - popup.offsetWidth - 16))}px`;
      popup.style.top = `${Math.max(64, Math.min(rect.top - popup.offsetHeight - 8, innerHeight - popup.offsetHeight - 16))}px`;
      if (open) frame = requestAnimationFrame(position);
    };
    position();
    if (open && keyboardOpen.current) {
      popup.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
      keyboardOpen.current = false;
    }
    return () => cancelAnimationFrame(frame);
  }, [shown.value, open]);

  function expand(fromKeyboard = false) {
    if (open && fromKeyboard) { panel.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus(); return; }
    keyboardOpen.current = fromKeyboard;
    document.dispatchEvent(new CustomEvent('lc-select-open', { detail: id }));
    setOpen(true);
  }

  return <div className="fusion-setting">
    <button ref={trigger} type="button" className="lc-setting-select nodrag nopan" aria-label={t.settings} aria-haspopup="dialog" aria-controls={id} aria-expanded={open}
      onClick={event => open ? setOpen(false) : expand(event.detail === 0)}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Tab' && open && !event.shiftKey) { event.preventDefault(); event.stopPropagation(); expand(true); }
      }}>
      <span className="lc-setting-select-value">{summary}</span><Icon name="imgChevron" size={16} className="lc-setting-select-chevron" />
    </button>
    {shown.value && createPortal(<div ref={panel} id={id} className="video-generation-settings nodrag nopan nowheel" popover="manual" role="dialog" aria-label={t.settings}
      data-select-popup data-overlay data-phase={shown.phase} inert={shown.phase === 'exit'} onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const stops = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"][tabindex="0"]'));
        const edge = event.shiftKey ? stops[0] : stops[stops.length - 1];
        if (document.activeElement === edge) { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
      }}>
      <section><h3>{t.ratio}</h3><ParameterSegments label={t.ratio} vertical value={value.ratio} onChange={ratio => onChange({ ratio })}
        options={ratios.map(ratio => ({ value: ratio, label: ratio === 'auto' ? t.auto : ratio, icon: `${assetBase}parameter-${ratio.replace(':', '-')}.svg` }))} /></section>
      <section><h3>{t.resolution}</h3><ParameterSegments label={t.resolution} value={value.resolution} onChange={resolution => onChange({ resolution })}
        options={resolutions.map(resolution => ({ value: resolution, label: resolution }))} /></section>
      <section><h3>{t.duration}</h3><ParameterSegments label={t.duration} value={value.duration} onChange={duration => onChange({ duration })}
        options={durations.map(duration => ({ value: duration, label: duration }))} /></section>
    </div>, document.body)}
  </div>;
}
