import type { Locale } from './i18n';

type LocalizedText = Record<Locale, string>;

export type VideoTemplateId = 'commerce' | 'creator' | 'runway' | 'brand' | 'launch' | 'fabric' | 'live' | 'wholesale';
export type VideoTemplate = {
  id: VideoTemplateId;
  label: LocalizedText;
  preview?: 'portrait' | 'landscape';
  description?: LocalizedText;
};

// Only the two examples supplied in Figma have template content.
export const videoTemplates: readonly VideoTemplate[] = [
  {
    id: 'commerce',
    label: { 'zh-CN': '电商视频', en: 'E-commerce', ja: 'EC動画' },
    preview: 'portrait',
    description: {
      'zh-CN': '让消费者快速看清衣服的款式、版型、穿着效果和购买理由',
      en: 'Help shoppers quickly understand the style, fit, look and reasons to buy.',
      ja: '服のデザイン、シルエット、着用イメージ、購入する理由を素早く伝えます。',
    },
  },
  { id: 'creator', label: { 'zh-CN': '博主种草', en: 'Creator picks', ja: 'クリエイター紹介' } },
  { id: 'runway', label: { 'zh-CN': '高级秀场', en: 'Runway', ja: 'ランウェイ' } },
  {
    id: 'brand',
    label: { 'zh-CN': '品牌故事', en: 'Brand story', ja: 'ブランドストーリー' },
    preview: 'landscape',
    description: {
      'zh-CN': '通过人物、场景和细节，让观众理解品牌为何做这件衣服',
      en: 'Use people, settings and details to tell the story behind the garment.',
      ja: '人物、シーン、ディテールを通じて、この服に込めたブランドの想いを伝えます。',
    },
  },
  { id: 'launch', label: { 'zh-CN': '新品预热', en: 'Product launch', ja: '新作ティーザー' } },
  { id: 'fabric', label: { 'zh-CN': '面料工艺', en: 'Fabric & craft', ja: '素材と技術' } },
  { id: 'live', label: { 'zh-CN': '直播预热', en: 'Livestream teaser', ja: 'ライブ配信予告' } },
  { id: 'wholesale', label: { 'zh-CN': '招商订货', en: 'Wholesale', ja: '商談・受注' } },
];

export const videoTemplateMessages = {
  'zh-CN': {
    title: '热门视频模版', categories: '模版分类', close: '关闭',
    portraitShots: '默认 5 个镜头，适合 9:16 竖屏', landscapeShots: '默认 5 个镜头，适合 16:9 横屏',
    replaceImages: '服装图、模特图均可替换', adjustNodes: '带入画布后可继续调整节点',
    garment: '上传服装图', model: '上传模特图',
    garmentPlaceholder: '替换模版商品，选填', modelPlaceholder: '替换模版人物，选填',
    replace: '替换图片', remove: '删除图片', reading: '正在读取图片…',
    uploadError: '请上传 JPG、JPEG、PNG 或 WebP 图片，单张不超过 20 MB。',
    singleImage: '每处最多上传 1 张图片。', decodeError: '图片读取失败，请重新选择。',
    formats: '支持 JPG、JPEG、PNG、WebP，单张不超过 20 MB',
    emptyTitle: '暂无数据', emptyDescription: '当前没有可展示的内容',
    edit: '编辑模版', generate: '立即生成',
    editPending: '模版编辑节点暂未接入，当前可预览模版及替换参考图。',
    generatePending: '视频生成暂未接入，本次不会创建任务或扣除积分。',
    videoUnavailable: '预览视频暂不可用', videoError: '视频加载失败，请稍后重试',
  },
  en: {
    title: 'Popular video templates', categories: 'Template categories', close: 'Close',
    portraitShots: '5 shots by default, designed for 9:16 portrait', landscapeShots: '5 shots by default, designed for 16:9 landscape',
    replaceImages: 'Replace the garment and model images', adjustNodes: 'Adjust nodes after adding the template to the canvas',
    garment: 'Upload garment image', model: 'Upload model image',
    garmentPlaceholder: 'Replace template product · Optional', modelPlaceholder: 'Replace template model · Optional',
    replace: 'Replace image', remove: 'Remove image', reading: 'Reading image…',
    uploadError: 'Upload a JPG, JPEG, PNG or WebP image, up to 20 MB.',
    singleImage: 'Upload one image per field.', decodeError: 'Could not read this image. Please choose another.',
    formats: 'JPG, JPEG, PNG or WebP, up to 20 MB per image',
    emptyTitle: 'No data yet', emptyDescription: 'There is no content to display',
    edit: 'Edit template', generate: 'Generate now',
    editPending: 'Template editing nodes are not connected yet. You can preview templates and replace reference images.',
    generatePending: 'Video generation is not connected yet. No task will be created and no credits will be charged.',
    videoUnavailable: 'Video preview is currently unavailable', videoError: 'Video could not load. Please try again later.',
  },
  ja: {
    title: '人気動画テンプレート', categories: 'テンプレートの分類', close: '閉じる',
    portraitShots: '標準は5カット、9:16の縦向き動画に対応', landscapeShots: '標準は5カット、16:9の横向き動画に対応',
    replaceImages: '服装画像とモデル画像は差し替え可能', adjustNodes: 'キャンバスに追加後もノードを調整可能',
    garment: '服装画像をアップロード', model: 'モデル画像をアップロード',
    garmentPlaceholder: '商品画像を差し替え（任意）', modelPlaceholder: 'モデル画像を差し替え（任意）',
    replace: '画像を差し替え', remove: '画像を削除', reading: '画像を読み込み中…',
    uploadError: 'JPG・JPEG・PNG・WebP形式、1枚20 MB以内の画像を選択してください。',
    singleImage: '各欄にアップロードできる画像は1枚です。', decodeError: '画像を読み込めませんでした。別の画像を選択してください。',
    formats: 'JPG・JPEG・PNG・WebP形式、1枚20 MB以内',
    emptyTitle: 'データがありません', emptyDescription: '現在表示できるコンテンツはありません',
    edit: 'テンプレート編集', generate: '今すぐ生成',
    editPending: 'テンプレート編集ノードは未接続です。現在はプレビューと参考画像の差し替えができます。',
    generatePending: '動画生成は未接続です。タスクの作成やポイントの消費は行いません。',
    videoUnavailable: '動画プレビューは現在利用できません', videoError: '動画を読み込めませんでした。後でもう一度お試しください。',
  },
} satisfies Record<Locale, Record<string, string>>;
