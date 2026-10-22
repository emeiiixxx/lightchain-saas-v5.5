const videoAssetBase = `${import.meta.env.BASE_URL}assets/video-workspace/`;
const entryAssetBase = `${import.meta.env.BASE_URL}assets/video-entry-20261022/`;

// Original artwork from Figma file 1dBgOC793NRsKgbNIaLZMK, node 64:2057.
export const videoAssets = {
  // Figma 64:2061, updated 2026-10-22; original 24×24 entry-slot exports.
  entryTemplates: `${entryAssetBase}templates.svg`,
  entryMaterialGeneration: `${entryAssetBase}material-generation.svg`,
  entryVideoGeneration: `${entryAssetBase}video-generation.svg`,
  entryVideoRemake: `${entryAssetBase}video-remake.svg`,
  entryVideoEdit: `${entryAssetBase}video-edit.svg`,
  workspacePlate: `${videoAssetBase}workspacePlate.png`,
  workspaceIcon: `${videoAssetBase}workspaceIcon.svg`,
  templates: `${videoAssetBase}templates.svg`,
  imageGeneration: `${videoAssetBase}imageGeneration.svg`,
  videoGeneration: `${videoAssetBase}videoGeneration.svg`,
  // Icon/Business/Video masters 64:4169 / 64:4168 in the revised single-image toolbar.
  fashionVideo: `${videoAssetBase}fashion-short-video.svg`,
  storyboard: `${videoAssetBase}storyboard-to-video.svg`,
  // Icon/ImageEditingTool / upscale, master 80:77 in the single-image canvas.
  upscale: `${videoAssetBase}upscale.svg`,
  videoExtend: `${videoAssetBase}videoExtend.svg`,
  videoEdit: `${videoAssetBase}videoEdit.svg`,
  // Original 97:6649 uploaded-video controls, each exported at 20×20.
  modifyVideo: `${import.meta.env.BASE_URL}assets/video-canvas/modify.svg`,
  saveVideoAsset: `${import.meta.env.BASE_URL}assets/video-canvas/save-asset.svg`,
  downloadVideo: `${import.meta.env.BASE_URL}assets/video-canvas/download.svg`,
  playVideo: `${import.meta.env.BASE_URL}assets/video-canvas/play.svg`,
  upload: `${videoAssetBase}upload.svg`,
  // Pure VIDEO-fill layers 76:5023 / 76:5591, exported without player controls.
  portraitPoster: `${videoAssetBase}portraitPoster.png`,
  landscapePoster: `${videoAssetBase}landscapePoster.png`,
  // Original MP4s supplied by the user, matched to the template orientation.
  portraitVideo: `${videoAssetBase}ecommerce.mp4`,
  landscapeVideo: `${videoAssetBase}brand-story.mp4`,
  // EmptyIcon / 暂无数据 (6:317), used by StateMessage 64:4668.
  empty: `${videoAssetBase}empty.png`,
} as const;
