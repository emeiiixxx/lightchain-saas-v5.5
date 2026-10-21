import { messages, type Locale } from '../i18n';
import type { DownloadFormat } from '../download-image';
import { DownloadFormatMenu } from './DownloadFormatMenu';
import { MediaToolbar } from './SelectionToolbar';
import { VideoIcon } from './VideoIcon';
import { Button, Divider, Icon } from './ui';

const copy = {
  'zh-CN': { imageGeneration: '图片生成', videoGeneration: '视频生成', upscale: '高清放大' },
  en: { imageGeneration: 'Image creation', videoGeneration: 'Video creation', upscale: 'Upscale' },
  ja: { imageGeneration: '画像生成', videoGeneration: '動画生成', upscale: '高解像度化' },
};

export type VideoSelectionAction = 'cutout' | 'imageGeneration' | 'videoGeneration' | 'upscale' | 'saveAsset' | 'sendImage';
type Props = { locale: Locale; onAction: (action: VideoSelectionAction) => void; onDownload: (format: DownloadFormat) => void; downloading?: boolean };

export function VideoSelectionToolbar({ locale, onAction, onDownload, downloading }: Props) {
  const t = messages[locale], v = copy[locale];
  return <MediaToolbar label={t.selectionTools} nodeId="76:5775" className="media-toolbar--video">
    <Button onClick={() => onAction('cutout')}><Icon name="toolbarCutout" size={20} />{t.cutout}</Button>
    <Divider vertical />
    <Button className="video-media-generate" onClick={() => onAction('imageGeneration')}><VideoIcon name="imageGeneration" size={20} />{v.imageGeneration}</Button>
    <Button className="video-media-generate" onClick={() => onAction('videoGeneration')}><VideoIcon name="videoGeneration" size={20} />{v.videoGeneration}</Button>
    <Button onClick={() => onAction('upscale')}><VideoIcon name="upscale" size={16} />{v.upscale}</Button>
    <Divider vertical />
    <Button className="canvas-icon-button" aria-label={t.saveAsset} title={t.saveAsset} onClick={() => onAction('saveAsset')}><Icon name="saveAsset" size={20} /></Button>
    <DownloadFormatMenu locale={locale} disabled={downloading} onSelect={onDownload} />
    <Button className="canvas-icon-button" aria-label={t.sendImage} title={t.sendImage} onClick={() => onAction('sendImage')}><Icon name="sendIcon" size={20} /></Button>
  </MediaToolbar>;
}
