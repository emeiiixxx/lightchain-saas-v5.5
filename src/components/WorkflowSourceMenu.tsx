import type { CSSProperties, ReactNode } from 'react';
import type { Locale } from '../i18n';
import { ReferenceSourceMenu } from './ReferenceSourceMenu';

export type WorkflowSource = 'upload' | 'canvas';
const labels = {
  'zh-CN': { image: '上传参考图', video: '上传视频', canvas: '从画布中选择' },
  en: { image: 'Upload reference image', video: 'Upload video', canvas: 'Select from canvas' },
  ja: { image: '参照画像をアップロード', video: '動画をアップロード', canvas: 'キャンバスから選択' },
};
export function WorkflowSourceMenu({ locale, kind = 'image', label, onChoose, className, style, children }: {
  locale: Locale; kind?: 'image' | 'video'; label: string; onChoose: (source: WorkflowSource) => void;
  className?: string; style?: CSSProperties; children: ReactNode;
}) {
  return <ReferenceSourceMenu addLabel={label} uploadLabel={labels[locale][kind]} canvasLabel={labels[locale].canvas}
    onChoose={onChoose} className={className} style={style}>{children}</ReferenceSourceMenu>;
}
