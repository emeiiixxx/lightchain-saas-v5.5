import { messages, type Locale } from '../i18n';
import { MediaToolbar } from './SelectionToolbar';
import { VideoIcon } from './VideoIcon';
import { Button, Divider } from './ui';

export function VideoAssetToolbar({ locale, onModify, onSave, onDownload }: {
  locale: Locale; onModify: () => void; onSave: () => void; onDownload: () => void;
}) {
  const t = messages[locale];
  const modify = locale === 'zh-CN' ? '视频修改' : locale === 'ja' ? '動画を編集' : 'Edit video';
  return <MediaToolbar label={t.selectionTools} nodeId="97:6650" className="media-toolbar--video media-toolbar--video-asset">
    <Button onClick={onModify}><VideoIcon name="modifyVideo" size={20} />{modify}</Button>
    <Divider vertical />
    <Button className="canvas-icon-button" aria-label={t.saveAsset} title={t.saveAsset} onClick={onSave}><VideoIcon name="saveVideoAsset" size={20} /></Button>
    <Button className="canvas-icon-button" aria-label={t.download} title={t.download} onClick={onDownload}><VideoIcon name="downloadVideo" size={20} /></Button>
  </MediaToolbar>;
}
