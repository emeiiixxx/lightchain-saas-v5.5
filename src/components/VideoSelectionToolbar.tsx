import { messages, type Locale } from '../i18n';
import type { DownloadFormat } from '../download-image';
import { DownloadFormatMenu } from './DownloadFormatMenu';
import { MediaToolbar } from './SelectionToolbar';
import { VideoIcon } from './VideoIcon';
import { Button, Divider, Icon } from './ui';

const copy = {
  'zh-CN': { fashionVideo: '服装短视频', storyboard: '分镜成片', upscale: '高清放大' },
  en: { fashionVideo: 'Fashion video', storyboard: 'Storyboard video', upscale: 'Upscale' },
  ja: { fashionVideo: 'ファッション動画', storyboard: '絵コンテから動画', upscale: '高解像度化' },
};

export type VideoSelectionAction = 'cutout' | 'fashionVideo' | 'storyboard' | 'upscale' | 'saveAsset' | 'sendImage';
type Props = { locale: Locale; onAction: (action: VideoSelectionAction) => void; onDownload: (format: DownloadFormat) => void; downloading?: boolean };

export function VideoSelectionToolbar({ locale, onAction, onDownload, downloading }: Props) {
  const t = messages[locale], v = copy[locale];
  return <MediaToolbar label={t.selectionTools} nodeId="76:5775" className="media-toolbar--video">
    <Button onClick={() => onAction('cutout')}><Icon name="toolbarCutout" size={20} />{t.cutout}</Button>
    <Divider vertical />
    <Button className="video-media-generate" onClick={() => onAction('fashionVideo')}><VideoIcon name="fashionVideo" size={20} />{v.fashionVideo}</Button>
    <Button className="video-media-generate" onClick={() => onAction('storyboard')}><VideoIcon name="storyboard" size={20} />{v.storyboard}</Button>
    <Button onClick={() => onAction('upscale')}><VideoIcon name="upscale" size={16} />{v.upscale}</Button>
    <Divider vertical />
    <Button className="canvas-icon-button" aria-label={t.saveAsset} title={t.saveAsset} onClick={() => onAction('saveAsset')}><Icon name="saveAsset" size={20} /></Button>
    <DownloadFormatMenu locale={locale} disabled={downloading} onSelect={onDownload} />
    <Button className="canvas-icon-button" aria-label={t.sendImage} title={t.sendImage} onClick={() => onAction('sendImage')}><Icon name="sendIcon" size={20} /></Button>
  </MediaToolbar>;
}
