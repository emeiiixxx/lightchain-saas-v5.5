const videoAssetBase = `${import.meta.env.BASE_URL}assets/video-workspace/`;

// Original artwork from Figma file 1dBgOC793NRsKgbNIaLZMK, node 64:2057.
export const videoAssets = {
  workspacePlate: `${videoAssetBase}workspacePlate.png`,
  workspaceIcon: `${videoAssetBase}workspaceIcon.svg`,
  templates: `${videoAssetBase}templates.svg`,
  imageGeneration: `${videoAssetBase}imageGeneration.svg`,
  videoGeneration: `${videoAssetBase}videoGeneration.svg`,
  videoExtend: `${videoAssetBase}videoExtend.svg`,
  videoEdit: `${videoAssetBase}videoEdit.svg`,
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
