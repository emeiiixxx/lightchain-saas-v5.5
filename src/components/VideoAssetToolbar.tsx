import { messages, type Locale } from '../i18n';
import { MediaToolbar } from './SelectionToolbar';
import { VideoIcon } from './VideoIcon';
import { Button, Divider } from './ui';

const copy = {
  'zh-CN': { remake: '视频复刻', modify: '视频修改', hd: '高清' },
  en: { remake: 'Video remake', modify: 'Edit video', hd: 'HD' },
  ja: { remake: '動画再現', modify: '動画を編集', hd: '高画質' },
};

export function VideoAssetToolbar({ locale, onRemake, onModify, onHD, onSave, onDownload }: {
  locale: Locale; onRemake: () => void; onModify: () => void; onHD: () => void; onSave: () => void; onDownload: () => void;
}) {
  const t = messages[locale], v = copy[locale];
  return <MediaToolbar label={t.selectionTools} nodeId="97:6650" className="media-toolbar--video media-toolbar--video-asset">
    <div className="video-asset-toolbar-group" data-node-id="I97:6650;1675:2981">
      <Button onClick={onRemake}><VideoIcon name="remakeVideo" size={20} />{v.remake}</Button>
      <Button onClick={onModify}><VideoIcon name="modifyVideo" size={20} />{v.modify}</Button>
      <Button className="video-asset-hd" onClick={onHD}><VideoIcon name="hdVideo" size={20} />{v.hd}</Button>
      <Divider vertical />
    </div>
    <div className="video-asset-toolbar-group" data-node-id="I97:6650;1675:2985">
      <Button className="canvas-icon-button" aria-label={t.saveAsset} title={t.saveAsset} onClick={onSave}><VideoIcon name="saveVideoAsset" size={20} /></Button>
      <Button className="canvas-icon-button" aria-label={t.download} title={t.download} onClick={onDownload}><VideoIcon name="downloadVideo" size={20} /></Button>
    </div>
  </MediaToolbar>;
}
