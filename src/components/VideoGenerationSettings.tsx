import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Locale } from '../i18n';
import { clampVideoDuration, videoDurationLimit, type VideoWorkflow } from '../video-workflow';
import { usePresence } from '../usePresence';
import { Icon } from './ui';
import '../video-generation-settings.css';

// Reuse v5.4 GenerationSettings ratio order, original SVGs and segmented controls.
const ratios = ['auto', '3:4', '9:16', '1:1', '4:3', '16:9'];
const resolutions = ['480p', '720p', '1080p'];
const assetBase = `${import.meta.env.BASE_URL}assets/video-settings/`;
const ratioIcon = (ratio: string) => `${assetBase}parameter-${ratio.replace(':', '-')}.svg`;
const copy = {
  'zh-CN': { settings: '生成设置', ratio: '视频比例', resolution: '选择清晰度', duration: '视频时长', auto: '智能' },
  en: { settings: 'Generation settings', ratio: 'Aspect ratio', resolution: 'Resolution', duration: 'Duration', auto: 'Auto' },
  ja: { settings: '生成設定', ratio: '動画の比率', resolution: '解像度', duration: '動画の長さ', auto: '自動' },
};
type Settings = Pick<VideoWorkflow, 'ratio' | 'resolution' | 'duration'> & Partial<Pick<VideoWorkflow, 'generationMode'>>;
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
  const sliderId = useId();
  const generationMode = value.generationMode ?? 'fast';
  const durationLimit = videoDurationLimit(generationMode);
  const [durationDraft, setDurationDraft] = useState(() => clampVideoDuration(value.duration, generationMode));
  const [durationDragging, setDurationDragging] = useState(false);
  const durationRef = useRef(durationDraft);
  const durationDirty = useRef(false);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const durationProgress = (Number.parseInt(durationDraft, 10) - 5) / (durationLimit - 5) * 100;
  const summary = `${value.ratio === 'auto' ? t.auto : value.ratio} ｜ ${value.resolution} ｜ ${durationDraft}`;

  useEffect(() => {
    const duration = clampVideoDuration(value.duration, generationMode);
    durationRef.current = duration;
    durationDirty.current = false;
    setDurationDraft(duration);
    setDurationDragging(false);
  }, [value.duration, generationMode]);

  function commitDuration() {
    setDurationDragging(false);
    if (!durationDirty.current) return;
    durationDirty.current = false;
    const current = latest.current;
    const duration = clampVideoDuration(durationRef.current, current.value.generationMode ?? 'fast');
    durationRef.current = duration;
    setDurationDraft(duration);
    if (duration !== current.value.duration) current.onChange({ duration });
  }

  function close() {
    commitDuration();
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const outside = (target: EventTarget | null) => target instanceof Node && !trigger.current?.contains(target) && !panel.current?.contains(target);
    const dismiss = (event: PointerEvent) => {
      if (!outside(event.target)) return;
      close();
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && (focused === trigger.current || panel.current?.contains(focused))) focused.blur();
    };
    const focus = (event: FocusEvent) => { if (outside(event.target)) close(); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation();
      close(); trigger.current?.focus();
    };
    const otherSelect = (event: Event) => { if ((event as CustomEvent<string>).detail !== id) close(); };
    const finishDuration = () => commitDuration();
    document.addEventListener('pointerdown', dismiss, true);
    document.addEventListener('focusin', focus, true);
    document.addEventListener('keydown', escape);
    document.addEventListener('lc-select-open', otherSelect);
    window.addEventListener('pointerup', finishDuration);
    window.addEventListener('pointercancel', finishDuration);
    window.addEventListener('blur', finishDuration);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
      document.removeEventListener('focusin', focus, true);
      document.removeEventListener('keydown', escape);
      document.removeEventListener('lc-select-open', otherSelect);
      window.removeEventListener('pointerup', finishDuration);
      window.removeEventListener('pointercancel', finishDuration);
      window.removeEventListener('blur', finishDuration);
    };
  }, [open, id]);

  useLayoutEffect(() => {
    if (!shown.value || !panel.current || !trigger.current) return;
    const popup = panel.current;
    if (!popup.matches(':popover-open')) popup.showPopover();
    let frame = 0;
    const position = () => {
      const anchor = trigger.current;
      if (!anchor?.isConnected || !anchor.getClientRects().length || anchor.closest('[hidden], [inert]')) { close(); return; }
      const rect = anchor.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) { close(); return; }
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
      onClick={event => open ? close() : expand(event.detail === 0)}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Tab' && open && !event.shiftKey) { event.preventDefault(); event.stopPropagation(); expand(true); }
      }}>
      <span className="icon video-generation-settings-ratio-icon" aria-hidden="true" style={{ '--icon-url': `url("${ratioIcon(value.ratio)}")` } as CSSProperties} />
      <span className="lc-setting-select-value">{summary}</span><Icon name="imgChevron" size={16} className="lc-setting-select-chevron" />
    </button>
    {shown.value && createPortal(<div ref={panel} id={id} className="video-generation-settings nodrag nopan nowheel" popover="manual" role="dialog" aria-label={t.settings}
      data-select-popup data-overlay data-phase={shown.phase} inert={shown.phase === 'exit'} onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const stops = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"][tabindex="0"], input[type="range"]'));
        const edge = event.shiftKey ? stops[0] : stops[stops.length - 1];
        if (document.activeElement === edge) { event.preventDefault(); close(); trigger.current?.focus(); }
      }}>
      <section><h3>{t.ratio}</h3><ParameterSegments label={t.ratio} vertical value={value.ratio} onChange={ratio => onChange({ ratio })}
        options={ratios.map(ratio => ({ value: ratio, label: ratio === 'auto' ? t.auto : ratio, icon: ratioIcon(ratio) }))} /></section>
      <section><h3>{t.resolution}</h3><ParameterSegments label={t.resolution} value={value.resolution} onChange={resolution => onChange({ resolution })}
        options={resolutions.map(resolution => ({ value: resolution, label: resolution }))} /></section>
      <section className="video-duration-setting">
        <div className="video-duration-heading"><h3><label htmlFor={sliderId}>{t.duration}</label></h3><output htmlFor={sliderId} aria-hidden="true">{durationDraft}</output></div>
        <div className="video-duration-control">
          <div className="video-duration-range" data-active={durationDragging} style={{ '--slider-progress': `${durationProgress}%` } as CSSProperties}>
            <input id={sliderId} type="range" className="nodrag nopan" min={5} max={durationLimit} step={1} value={Number.parseInt(durationDraft, 10)} aria-valuetext={durationDraft}
              onChange={event => {
                const duration = clampVideoDuration(`${event.currentTarget.value}s`, generationMode);
                durationRef.current = duration;
                durationDirty.current = true;
                setDurationDraft(duration);
              }}
              onPointerDown={() => setDurationDragging(true)} onPointerUp={commitDuration} onPointerCancel={commitDuration} onLostPointerCapture={commitDuration} onBlur={commitDuration}
              onKeyDown={event => {
                if (event.key === 'Tab') return;
                event.stopPropagation();
                if (event.key === 'Escape') { event.preventDefault(); close(); trigger.current?.focus(); }
              }}
              onKeyUp={event => { event.stopPropagation(); commitDuration(); }} />
          </div>
          <div className="video-duration-bounds" aria-hidden="true"><span>5s</span><span>{durationLimit}s</span></div>
        </div>
      </section>
    </div>, document.body)}
  </div>;
}
