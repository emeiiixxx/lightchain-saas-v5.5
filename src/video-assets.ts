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
  // Figma exposes the video hashes and poster images, but no original video URL.
  portraitVideo: undefined as string | undefined,
  landscapeVideo: undefined as string | undefined,
  // EmptyIcon / 暂无数据 (6:317), used by StateMessage 64:4668.
  empty: `${videoAssetBase}empty.png`,
} as const;
