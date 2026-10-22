import { useEffect, useId, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import type { Locale } from '../i18n';
import { reorderVideoReferences, videoReferenceLimits, videoWorkflowReferences, type VideoReference, type VideoWorkflow } from '../video-workflow';
import { videoNodeAssetSets } from '../video-node-assets';
import { Button, Icon } from './ui';
import { GenerateTaskButton } from './GenerateTaskButton';
import { ProgressiveImage } from './ProgressiveImage';
import { PromptTools } from './PromptTools';
import { VideoGenerationSettings } from './VideoGenerationSettings';
import { SettingSelect } from './SettingSelect';
import { VideoIcon } from './VideoIcon';
import { notify } from './Toast';
import '../video-workflow-node.css';

const promptLimit = 5000;
const copy = {
  'zh-CN': {
    title: '视频生成-服装短视频', referenceTitle: '视频生成-服装长视频',
    framesTip: '上传首尾帧图片，智能生成短视频', longTip: '支持上传图片/视频作为参考，生成最多30s视频',
    main: '主图', mainFrame: '主图（首帧）', addMain: '添加首帧图', endFrame: '尾帧图', addEnd: '添加尾帧图',
    endTip: '建议上传同一模特/背景/服装的连贯动作图', media: '参考素材', mediaTip: '支持拖拽素材调整顺序',
    image: '图片', video: '视频', imageCount: '最多9张，已上传', videoCount: '最多3个，已上传',
    addImage: '添加图片', addVideo: '添加视频', remove: '删除', preview: '预览', reorder: '按住 Alt 和左右方向键调整顺序',
    prompt: '视频描述', placeholder: '举例:持久定格模特正面,女模特表情自信冷静,发丝与裙摆同步飘动,同时背景中的直升机起飞,随后模特转身,动作丝滑,画面流畅切换到模特上半身特写',
    expand: '展开编辑', save: '保存指令', library: '提示词库', clear: '清空', close: '关闭', count: '字数',
    promptGenerate: '提示词生成', promptExpand: '提示词扩写', unavailable: '功能暂未接入',
    settings: '生成设置', generate: '开始 AI 生成', required: '请输入视频描述',
    generationMode: '生成模式', fast: '快速', professional: '专业',
  },
  en: {
    title: 'Video generation · Fashion short video', referenceTitle: 'Video generation · Fashion long video',
    framesTip: 'Upload first and last frames to generate a short video', longTip: 'Use images or videos to generate up to 30 seconds',
    main: 'Main image', mainFrame: 'Main image (first frame)', addMain: 'Add first frame', endFrame: 'Last frame', addEnd: 'Add last frame',
    endTip: 'Use continuous poses with the same model, background and clothing', media: 'Reference media', mediaTip: 'Drag media to reorder',
    image: 'Images', video: 'Videos', imageCount: 'Up to 9, uploaded ', videoCount: 'Up to 3, uploaded ',
    addImage: 'Add image', addVideo: 'Add video', remove: 'Delete', preview: 'Preview', reorder: 'Hold Alt and use left or right arrow to reorder',
    prompt: 'Video description', placeholder: 'Example: Hold a front view of the model with a confident, calm expression. Her hair and skirt move in the breeze as a helicopter takes off behind her. She turns smoothly, then the shot transitions to a close-up of her upper body.',
    expand: 'Expand editor', save: 'Save prompt', library: 'Prompt library', clear: 'Clear', close: 'Close', count: 'Characters',
    promptGenerate: 'Generate prompt', promptExpand: 'Expand prompt', unavailable: 'is not connected yet',
    settings: 'Generation settings', generate: 'Start AI generation', required: 'Enter a video description',
    generationMode: 'Generation mode', fast: 'Fast', professional: 'Pro',
  },
  ja: {
    title: '動画生成・ファッション短編動画', referenceTitle: '動画生成・ファッション長編動画',
    framesTip: '開始・終了画像から短編動画を生成', longTip: '画像や動画を参考に最大30秒の動画を生成',
    main: 'メイン画像', mainFrame: 'メイン画像（開始）', addMain: '開始画像を追加', endFrame: '終了画像', addEnd: '終了画像を追加',
    endTip: '同じモデル・背景・服装で連続した動作の画像を推奨', media: '参考素材', mediaTip: 'ドラッグで素材の順序を変更できます',
    image: '画像', video: '動画', imageCount: '最大9枚、追加済み ', videoCount: '最大3本、追加済み ',
    addImage: '画像を追加', addVideo: '動画を追加', remove: '削除', preview: 'プレビュー', reorder: 'Alt と左右矢印キーで順序を変更',
    prompt: '動画の説明', placeholder: '例：自信に満ちた落ち着いた表情のモデルを正面から捉えます。髪とスカートが風になびき、背景のヘリコプターが離陸します。モデルが滑らかに振り返り、上半身のクローズアップに切り替わります。',
    expand: '拡大編集', save: '指示を保存', library: 'プロンプト集', clear: 'クリア', close: '閉じる', count: '文字数',
    promptGenerate: 'プロンプト生成', promptExpand: 'プロンプト拡張', unavailable: 'は未接続です',
    settings: '生成設定', generate: 'AI 生成を開始', required: '動画の説明を入力してください',
    generationMode: '生成モード', fast: '高速', professional: '高品質',
  },
};

type Props = {
  node: VideoWorkflow;
  locale: Locale;
  onChange: (patch: Partial<VideoWorkflow>) => void;
  onMain: () => void;
  onReference: (kind: VideoReference['kind']) => void;
  onPreview: (reference: VideoReference) => void;
  onGenerate: () => void;
};

function NodeIcon({ src, size = 16, className = '' }: { src: string; size?: number; className?: string }) {
  return <span className={'icon video-node-icon ' + className} aria-hidden="true" style={{ width: size, height: size, '--icon-url': 'url("' + src + '")' } as CSSProperties} />;
}

export function VideoWorkflowNode({ node, locale, onChange, onMain, onReference, onPreview, onGenerate }: Props) {
  const t = copy[locale];
  const frames = node.mode === 'frames';
  const title = frames ? t.title : t.referenceTitle;
  const generationMode = node.generationMode ?? 'fast';
  const references = videoWorkflowReferences(node);
  const frameAssets = node.main ? videoNodeAssetSets.framesFilled : videoNodeAssetSets.framesEmpty;
  const referenceAssets = references.length ? videoNodeAssetSets.referencesFilled : videoNodeAssetSets.referencesEmpty;
  const assets = frames ? frameAssets : referenceAssets;
  const promptActionLabel = node.prompt.trim() ? t.promptExpand : t.promptGenerate;
  const promptAction = <Button className="video-prompt-expand" onClick={() => notify(locale === 'zh-CN' ? promptActionLabel + t.unavailable : promptActionLabel + ' ' + t.unavailable)}><NodeIcon src={assets.promptGenerate} /><span>{promptActionLabel}</span></Button>;
  const designId = frames ? (node.main ? '119:11242' : '84:6110') : (references.length ? '121:18150' : '121:17924');
  const root = useRef<HTMLElement>(null);
  const prompt = useRef<HTMLTextAreaElement>(null);
  const dragging = useRef<VideoReference | null>(null);
  const suppressPreviewUntil = useRef(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const id = useId();
  const promptId = id + '-prompt';

  useEffect(() => {
    const blur = (event: PointerEvent) => {
      const active = document.activeElement;
      if (active instanceof HTMLTextAreaElement && root.current?.contains(active) && event.target !== active) active.blur();
    };
    document.addEventListener('pointerdown', blur, true);
    return () => document.removeEventListener('pointerdown', blur, true);
  }, []);

  function updatePrompt(value: string) { onChange({ prompt: value.slice(0, promptLimit) }); setError(false); }
  function generate() {
    if (frames && !node.main) { onMain(); return; }
    if (!frames && !references.length) { onReference('image'); return; }
    if (!node.prompt.trim()) { setError(true); prompt.current?.focus(); return; }
    onGenerate();
  }
  function removeReference(reference: VideoReference) {
    onChange({ ...(reference.id === node.main?.id ? { main: undefined } : { references: node.references.filter(item => item.id !== reference.id) }),
      referenceOrder: references.filter(item => item.id !== reference.id).map(item => item.id) });
  }
  function finishDrag() { dragging.current = null; setDragId(null); setDropId(null); suppressPreviewUntil.current = Date.now() + 200; }
  function moveReference(kind: VideoReference['kind'], sourceId: string, targetId: string) {
    if (sourceId !== targetId) onChange({ referenceOrder: reorderVideoReferences(node, kind, sourceId, targetId) });
  }
  function acceptDrag(event: DragEvent<HTMLElement>, kind: VideoReference['kind'], targetId?: string) {
    if (!dragging.current) return false;
    event.stopPropagation();
    if (dragging.current.kind !== kind) { event.dataTransfer.dropEffect = 'none'; return false; }
    event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropId(targetId ?? null); return true;
  }
  function dropReference(event: DragEvent<HTMLElement>, kind: VideoReference['kind'], targetId?: string) {
    if (!acceptDrag(event, kind, targetId)) return;
    if (dragging.current && targetId) moveReference(kind, dragging.current.id, targetId);
    finishDrag();
  }
  function thumbnail(reference: VideoReference, onRemove: () => void, index?: number) {
    const reorder = index !== undefined;
    return <div className="video-reference-tile nodrag nopan" key={reference.id} draggable={reorder}
      data-dragging={dragId === reference.id} data-drop-target={dropId === reference.id && dragId !== reference.id}
      onDragStart={event => {
        if (!reorder) { event.preventDefault(); return; }
        event.stopPropagation(); dragging.current = reference; setDragId(reference.id);
        event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-lightchain-video-reference', JSON.stringify({ nodeId: node.id, id: reference.id }));
      }}
      onDragOver={event => { if (reorder) acceptDrag(event, reference.kind, reference.id); }}
      onDrop={event => { if (reorder) dropReference(event, reference.kind, reference.id); }}
      onDragEnd={finishDrag}>
      <button type="button" className="video-reference-preview" aria-label={t.preview + ' ' + reference.name} aria-describedby={reorder ? id + '-reorder' : undefined}
        onClick={() => { if (Date.now() >= suppressPreviewUntil.current) onPreview(reference); }}
        onKeyDown={event => {
          if (!reorder || !event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation();
          const items = references.filter(item => item.kind === reference.kind);
          const target = items[items.findIndex(item => item.id === reference.id) + (event.key === 'ArrowLeft' ? -1 : 1)];
          if (target) moveReference(reference.kind, reference.id, target.id);
        }}>
        {reference.kind === 'video' ? <><video src={reference.url} muted playsInline preload="metadata" draggable={false} /><span className="video-reference-video-mark"><VideoIcon name="videoGeneration" size={16} /></span></> : <ProgressiveImage src={reference.url} alt={reference.name} width={reorder ? 64 : 48} height={reorder ? 64 : 48} />}
      </button>
      {reorder && <span className="video-reference-number" aria-hidden="true">{index + 1}</span>}
      <Button variant="tonal" className="video-reference-remove" title={t.remove} aria-label={t.remove + ' ' + reference.name} onClick={onRemove}><Icon name="close" size={12} /></Button>
    </div>;
  }
  function referenceSection(kind: VideoReference['kind']) {
    const items = references.filter(reference => reference.kind === kind);
    const addLabel = kind === 'image' ? t.addImage : t.addVideo;
    return <div className="video-reference-section" key={kind}>
      <div className="video-reference-section-label" id={id + '-' + kind}><span>{t[kind]}</span><span className="video-reference-label-divider" aria-hidden="true" /><span>{kind === 'image' ? t.imageCount : t.videoCount}<span className="video-reference-count">{items.length}</span>/{videoReferenceLimits[kind]}</span></div>
      <div className="video-workflow-references nowheel" data-canvas-scroll="wheel" aria-labelledby={id + '-' + kind}
        onDragOver={event => {
          if (!acceptDrag(event, kind, items.at(-1)?.id)) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left + 28) event.currentTarget.scrollLeft -= 16;
          if (event.clientX > bounds.right - 28) event.currentTarget.scrollLeft += 16;
        }} onDrop={event => dropReference(event, kind, items.at(-1)?.id)}
        onWheel={event => {
          if (event.ctrlKey || event.metaKey || event.altKey) return;
          event.stopPropagation(); if (!event.deltaX) event.currentTarget.scrollLeft += event.deltaY;
        }}>
        {items.map((reference, index) => thumbnail(reference, () => removeReference(reference), index))}
        {items.length < videoReferenceLimits[kind] && <button type="button" className="fusion-reference video-workflow-reference-add" aria-label={addLabel} data-tooltip={addLabel} onClick={() => onReference(kind)}><NodeIcon src={referenceAssets.addReference} size={20} /></button>}
      </div>
    </div>;
  }

  return <section ref={root} className="fusion-node video-workflow-node" data-mode={node.mode} data-overlay data-node-id={designId} aria-label={title}>
    <header className="fusion-header video-workflow-header"><h2>{title}</h2><div className="fusion-tip"><img src={assets.tip} alt="" draggable={false} /><span>{frames ? t.framesTip : t.longTip}</span></div></header>
    <div className="fusion-content video-workflow-content">
      {frames ? <>
        <div className="fusion-field video-workflow-frame-field">
          <div className="fusion-label">{t.main}<span className="fusion-required">*</span></div>
          {node.main ? <div className="video-frame-upload">{thumbnail({ ...node.main, kind: 'image' }, () => onChange({ main: undefined }))}<span>{t.mainFrame}</span></div>
            : <button type="button" className="video-frame-upload video-frame-upload-empty" onClick={onMain}><NodeIcon src={frameAssets.addImage} size={20} /><span>{t.addMain}</span></button>}
        </div>
        <div className="fusion-field video-workflow-frame-field">
          <div className="fusion-label">{t.endFrame}<Button className="video-reference-info" aria-label={t.endTip} title={t.endTip} data-tooltip-side="right"><NodeIcon src={assets.info} /></Button></div>
          {node.endFrame ? <div className="video-frame-upload">{thumbnail(node.endFrame, () => onChange({ endFrame: undefined }))}<span>{t.endFrame}</span></div>
            : <button type="button" className="video-frame-upload video-frame-upload-empty" onClick={() => onReference('image')}><NodeIcon src={frameAssets.addImage} size={20} /><span>{t.addEnd}</span></button>}
        </div>
      </> : <div className="fusion-field video-workflow-materials">
        <div className="fusion-label">{t.media}<span className="fusion-required">*</span><Button className="video-reference-info" aria-label={t.mediaTip} title={t.mediaTip} data-tooltip-side="right"><NodeIcon src={assets.info} /></Button></div>
        {referenceSection('image')}{referenceSection('video')}
        <span className="sr-only" id={id + '-reorder'}>{t.reorder}</span>
      </div>}
      <div className="fusion-field video-workflow-prompt">
        <label className="fusion-label" htmlFor={promptId}>{t.prompt}<span className="fusion-required">*</span></label>
        <div className={'fusion-textarea' + (error ? ' has-error' : '')}>
          <textarea ref={prompt} id={promptId} value={node.prompt} placeholder={t.placeholder} required maxLength={promptLimit} aria-invalid={error} aria-describedby={error ? promptId + '-error' : undefined} onChange={event => updatePrompt(event.target.value)} />
          <div className="fusion-textarea-footer">
            <div className="fusion-prompt-actions"><PromptTools value={node.prompt} onChange={updatePrompt} labels={t} maxLength={promptLimit} expandedAction={promptAction} inlineIcons={{ expand: <NodeIcon src={assets.promptExpand} />, save: <NodeIcon src={assets.promptSave} />, library: <NodeIcon src={assets.promptLibrary} /> }} /></div>
            <div className="video-prompt-assist">
              {promptAction}
              <span className="fusion-counter" aria-label={t.count}>{node.prompt.length}/{promptLimit}</span>
            </div>
          </div>
        </div>
        {error && <p className="sr-only" id={promptId + '-error'} role="alert">{t.required}</p>}
      </div>
      <div className="fusion-field video-workflow-settings"><span className="fusion-label">{t.settings}</span>
        <div className="fusion-settings">
          <div className="video-generation-mode">
            <SettingSelect label={t.generationMode} value={generationMode} chevron={<NodeIcon src={assets.chevron} className="lc-setting-select-chevron" />}
              options={(['fast', 'professional'] as const).map(value => ({ value, label: t[value] }))}
              onChange={value => onChange({ generationMode: value === 'professional' ? 'professional' : 'fast' })} />
          </div>
          <VideoGenerationSettings locale={locale} value={node} onChange={onChange} autoIcon={assets.auto} chevron={<NodeIcon src={assets.chevron} className="lc-setting-select-chevron" />} />
        </div>
      </div>
    </div>
    <footer className="fusion-node-action video-workflow-action">
      <GenerateTaskButton label={t.generate} cost="999" costIcon={<NodeIcon src={videoNodeAssetSets.framesEmpty.generateStar} />} className="fusion-generate" disabled={!frames && (!references.length || !node.prompt.trim())} onClick={generate} />
    </footer>
  </section>;
}

