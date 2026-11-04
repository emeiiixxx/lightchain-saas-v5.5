import type { UploadedVideo } from './video-reference-upload';

// User-supplied demo upload. Static metadata and poster avoid loading the clip
// when opening the picker; playback uses the original file only when requested.
export const videoHistoryAssets: UploadedVideo[] = [{
  id: 'history-storyboard-tutorial-720p60-v1',
  name: '分镜图storyboard-tutorial-720p60-v1.mp4',
  kind: 'video',
  url: `${import.meta.env.BASE_URL}assets/video-history/storyboard-tutorial-720p60-v1.mp4`,
  posterUrl: `${import.meta.env.BASE_URL}assets/video-history/storyboard-tutorial-poster.jpg`,
  width: 1280,
  height: 720,
  duration: 12.55,
}];
