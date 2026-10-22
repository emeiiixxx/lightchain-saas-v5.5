import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import type { Locale } from '../i18n';
import type { VideoReference, VideoWorkflow } from '../video-workflow';
import { videoNodeAssets } from '../video-node-assets';
import { Button, Divider, Icon } from './ui';
import { GenerateTaskButton } from './GenerateTaskButton';
import { ProgressiveImage } from './ProgressiveImage';
import { PromptTools } from './PromptTools';
import { VideoGenerationSettings } from './VideoGenerationSettings';
import { VideoIcon } from './VideoIcon';
import { notify } from './Toast';
import '../video-workflow-node.css';

const copy = {
  'zh-CN': {
    title: '服装短视频', mode: '视频模式', frames: '首尾帧模式', references: '多参考模式',
    addMainFrame: '添加主图（首帧）', addMain: '添加主图', mainFrame: '主图（首帧）', main: '主图',
    replaceMain: '替换主图', endFrame: '尾帧参考图', media: '参考图 / 视频',
    endTip: '尾帧参考图用于视频结束画面', mediaTip: '支持添加参考图片或视频',
    addEnd: '添加尾帧参考图', addReference: '添加参考图或视频', remove: '移除参考素材', preview: '预览',
    prompt: '视频描述', placeholder: '举例:持久定格模特正面,女模特表情自信冷静,发丝与裙摆同步飘动,同时背景中的直升机起飞,随后模特转身,动作丝滑,画面流畅切换到模特上半身特写',
    expand: '展开编辑', save: '保存指令', library: '提示词库', clear: '清空', close: '关闭', count: '字数',
    expandText: '一键扩写', imageToPrompt: '参考图反推', unavailable: '功能暂未接入',
    settings: '生成设置', generate: '开始 AI 生成', required: '请输入视频描述',
    frameImages: '首尾帧图', framesTip: '按顺序添加首帧和尾帧图片，尾帧可选', addImage: '添加图片',
    generationMode: '生成模式', fast: '快速', professional: '专业', generateCompact: '开始 AI 生成',
  },
  en: {
    title: 'Fashion video', mode: 'Video mode', frames: 'First & last frame', references: 'Multi-reference',
    addMainFrame: 'Add main image (first frame)', addMain: 'Add main image', mainFrame: 'Main image (first frame)', main: 'Main image',
    replaceMain: 'Replace main image', endFrame: 'Last frame reference', media: 'Reference images / videos',
    endTip: 'Use a reference image for the last video frame', mediaTip: 'Add reference images or videos',
    addEnd: 'Add last frame reference', addReference: 'Add reference image or video', remove: 'Remove reference', preview: 'Preview',
    prompt: 'Video description', placeholder: 'Example: Hold a front view of the model with a confident, calm expression. Her hair and skirt move in the breeze as a helicopter takes off behind her. She turns smoothly, then the shot transitions to a close-up of her upper body.',
    expand: 'Expand editor', save: 'Save prompt', library: 'Prompt library', clear: 'Clear', close: 'Close', count: 'Characters',
    expandText: 'Expand prompt', imageToPrompt: 'Image to prompt', unavailable: 'is not connected yet',
    settings: 'Generation settings', generate: 'Start AI generation', required: 'Enter a video description',
    frameImages: 'First & last frame', framesTip: 'Add the first frame, then an optional last frame', addImage: 'Add image',
    generationMode: 'Generation mode', fast: 'Fast', professional: 'Pro', generateCompact: 'Generate',
  },
  ja: {
    title: 'ファッション動画', mode: '動画モード', frames: '開始・終了フレーム', references: '複数参考モード',
    addMainFrame: 'メイン画像（開始）を追加', addMain: 'メイン画像を追加', mainFrame: 'メイン画像（開始）', main: 'メイン画像',
    replaceMain: 'メイン画像を変更', endFrame: '終了フレームの参考画像', media: '参考画像 / 動画',
    endTip: '参考画像を動画の終了フレームに使用', mediaTip: '参考画像や動画を追加できます',
    addEnd: '終了フレームの参考画像を追加', addReference: '参考画像や動画を追加', remove: '参考素材を削除', preview: 'プレビュー',
    prompt: '動画の説明', placeholder: '例：自信に満ちた落ち着いた表情のモデルを正面から捉えます。髪とスカートが風になびき、背景のヘリコプターが離陸します。モデルが滑らかに振り返り、上半身のクローズアップに切り替わります。',
    expand: '拡大編集', save: '指示を保存', library: 'プロンプト集', clear: 'クリア', close: '閉じる', count: '文字数',
    expandText: 'プロンプトを拡張', imageToPrompt: '参考画像から指示を作成', unavailable: 'は未接続です',
    settings: '生成設定', generate: 'AI 生成を開始', required: '動画の説明を入力してください',
    frameImages: '開始・終了フレーム', framesTip: '開始画像、任意の終了画像の順に追加します', addImage: '画像を追加',
    generationMode: '生成モード', fast: '高速', professional: '高品質', generateCompact: 'AI 生成',
  },
};

type Props = {
  node: VideoWorkflow;
  locale: Locale;
  onChange: (patch: Partial<VideoWorkflow>) => void;
  onMain: () => void;
  onReference: () => void;
  onPreview: (reference: VideoReference) => void;
  onGenerate: () => void;
};

function NodeIcon({ name, size = 16 }: { name: keyof typeof videoNodeAssets; size?: number }) {
  return <span className="icon video-node-icon" aria-hidden="true" style={{ width: size, height: size, '--icon-url': `url("${videoNodeAssets[name]}")` } as CSSProperties} />;
}

export function VideoWorkflowNode({ node, locale, onChange, onMain, onReference, onPreview, onGenerate }: Props) {
  const t = copy[locale];
  const frames = node.mode === 'frames';
  const generationMode = node.generationMode ?? 'fast';
  const references = frames ? (node.endFrame ? [node.endFrame] : []) : node.references;
  const root = useRef<HTMLElement>(null);
  const prompt = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState(false);
  const id = useId();
  const promptId = `${id}-prompt`;

  useEffect(() => {
    const blur = (event: PointerEvent) => {
      const active = document.activeElement;
      if (active instanceof HTMLTextAreaElement && root.current?.contains(active) && event.target !== active) active.blur();
    };
    document.addEventListener('pointerdown', blur, true);
    return () => document.removeEventListener('pointerdown', blur, true);
  }, []);

  function updatePrompt(value: string) { onChange({ prompt: value.slice(0, 2000) }); setError(false); }
  function notConnected(label: string) { notify(locale === 'zh-CN' ? `${label}${t.unavailable}` : `${label} ${t.unavailable}`); }
  function generate() {
    if (!node.main) { onMain(); return; }
    if (!node.prompt.trim()) { setError(true); prompt.current?.focus(); return; }
    onGenerate();
  }

  return <section ref={root} className="fusion-node video-workflow-node" data-mode={node.mode} data-overlay data-node-id={frames ? '84:6110' : '91:6434'} aria-label={t.title}>
    <header className="fusion-header video-workflow-header"><h2>{t.title}</h2></header>
    <div className="video-workflow-tabs-wrap">
      <div className="video-workflow-tabs" role="tablist" aria-label={t.mode} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const mode = event.key === 'Home' ? 'frames' : event.key === 'End' ? 'references' : frames ? 'references' : 'frames';
        onChange({ mode });
        event.currentTarget.querySelector<HTMLButtonElement>(`[data-mode="${mode}"]`)?.focus();
      }}>
        {(['frames', 'references'] as const).map(mode => <Button key={mode} role="tab" id={`${id}-${mode}`} data-mode={mode}
          aria-selected={node.mode === mode} aria-controls={`${id}-panel`} tabIndex={node.mode === mode ? 0 : -1}
          onClick={() => onChange({ mode })}>{t[mode]}</Button>)}
      </div>
    </div>
    <div className="fusion-content video-workflow-content" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${node.mode}`}>
      {!frames && <>{node.main ? <div className="fusion-main video-workflow-main">
        <button className="video-main-preview" type="button" aria-label={`${t.preview} ${node.main.name}`} data-tooltip={t.preview} onClick={() => onPreview({ ...node.main!, kind: 'image' })}>
          <ProgressiveImage src={node.main.url} alt={node.main.name} width={40} height={40} />
        </button>
        <button className="video-main-replace" type="button" aria-label={t.replaceMain} data-tooltip={t.replaceMain} onClick={onMain}>{t.main}</button>
      </div> : <button type="button" className="fusion-add-main video-workflow-add-main" onClick={onMain}><Icon name="fusionAddImage" size={20} />{t.addMain}</button>}
      <Divider /></>}
      <div className="fusion-field video-workflow-references-field">
        <div className="fusion-label"><span>{frames ? t.frameImages : t.media}</span><Button className="video-reference-info" aria-label={frames ? t.framesTip : t.mediaTip} title={frames ? t.framesTip : t.mediaTip}><NodeIcon name="info" /></Button></div>
        <div className="video-workflow-references nowheel" data-canvas-scroll="wheel" aria-label={frames ? t.frameImages : t.media} onWheel={event => {
          if (event.ctrlKey || event.metaKey || event.altKey) return;
          event.stopPropagation();
          if (!event.deltaX) event.currentTarget.scrollLeft += event.deltaY;
        }}>
          {frames && (node.main ? <div className="video-reference-tile" aria-label={t.mainFrame}>
            <button type="button" className="video-reference-preview" aria-label={`${t.preview} ${node.main.name}`} onClick={() => onPreview({ ...node.main!, kind: 'image' })}>
              <ProgressiveImage src={node.main.url} alt={node.main.name} width={64} height={64} />
            </button>
            <Button variant="tonal" className="video-reference-replace" title={t.replaceMain} aria-label={t.replaceMain} onClick={onMain}><Icon name="promptCoverReplace" size={12} /></Button>
          </div> : <button type="button" className="fusion-reference video-workflow-reference-add" aria-label={t.addMainFrame} data-tooltip={t.addImage} onClick={onMain}><NodeIcon name="add" size={20} /></button>)}
          {references.map((reference, index) => <div className="video-reference-tile" key={reference.id}>
            <button type="button" className="video-reference-preview" aria-label={`${t.preview} ${reference.name}`} onClick={() => onPreview(reference)}>
              {reference.kind === 'video' ? <><video src={reference.url} muted playsInline preload="metadata" /><span className="video-reference-video-mark"><VideoIcon name="videoGeneration" size={16} /></span></> : <ProgressiveImage src={reference.url} alt={reference.name} width={64} height={64} />}
            </button>
            <Button variant="tonal" className="video-reference-remove" title={t.remove} aria-label={`${t.remove} ${index + 1}`} onClick={() => onChange(frames ? { endFrame: undefined } : { references: node.references.filter(item => item.id !== reference.id) })}><Icon name="close" size={12} /></Button>
          </div>)}
          {(!frames || (node.main && !node.endFrame)) && <button type="button" className="fusion-reference video-workflow-reference-add" aria-label={frames ? t.addEnd : t.addReference} data-tooltip={frames ? t.addImage : t.addReference} onClick={onReference}>{frames ? <NodeIcon name="add" size={20} /> : <Icon name="fusionAddImage" size={20} />}</button>}
        </div>
      </div>
      <div className="fusion-field video-workflow-prompt">
        <label className="fusion-label" htmlFor={promptId}>{t.prompt}<span className="fusion-required">*</span></label>
        <div className={`fusion-textarea${error ? ' has-error' : ''}`}>
          <textarea ref={prompt} id={promptId} value={node.prompt} placeholder={t.placeholder} required maxLength={2000} aria-invalid={error} aria-describedby={error ? `${promptId}-error` : undefined} onChange={event => updatePrompt(event.target.value)} />
          <div className="fusion-textarea-footer">
            <div className="fusion-prompt-actions"><PromptTools value={node.prompt} onChange={updatePrompt} labels={t} /></div>
            <div className="video-prompt-assist">
              <Button className={frames ? 'video-prompt-expand' : 'video-prompt-icon'} aria-label={t.expandText} title={t.expandText} onClick={() => notConnected(t.expandText)}><NodeIcon name="expandText" />{frames && <span>{t.expandText}</span>}</Button>
              {!frames && <Button className="video-prompt-icon" aria-label={t.imageToPrompt} title={t.imageToPrompt} onClick={() => notConnected(t.imageToPrompt)}><NodeIcon name="imageToPrompt" /></Button>}
              <span className="fusion-counter" aria-label={t.count}>{node.prompt.length}/2000</span>
            </div>
          </div>
        </div>
        {error && <p className="sr-only" id={`${promptId}-error`} role="alert">{t.required}</p>}
      </div>
      <div className="fusion-field video-workflow-settings"><span className="fusion-label">{t.settings}</span>
        <div className="fusion-settings">
          <VideoGenerationSettings locale={locale} value={node} onChange={onChange} />
        </div>
      </div>
    </div>
    <footer className="fusion-node-action video-workflow-action">
      {frames && <div className="video-generation-mode" role="radiogroup" aria-label={t.generationMode} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const next = event.key === 'Home' ? 'fast' : event.key === 'End' ? 'professional' : generationMode === 'fast' ? 'professional' : 'fast';
        onChange({ generationMode: next });
        event.currentTarget.querySelector<HTMLButtonElement>(`[data-generation-mode="${next}"]`)?.focus();
      }}>
        {(['fast', 'professional'] as const).map(mode => <Button key={mode} role="radio" data-generation-mode={mode} aria-checked={generationMode === mode} tabIndex={generationMode === mode ? 0 : -1} onClick={() => onChange({ generationMode: mode })}>{t[mode]}</Button>)}
      </div>}
      <GenerateTaskButton label={frames ? t.generateCompact : t.generate} cost="999" className="fusion-generate" onClick={generate} />
    </footer>
  </section>;
}
