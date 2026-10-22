const base = `${import.meta.env.BASE_URL}assets/video-workflow/`;

// Original SVGs reused by 84:6110 / 112:7764 in the v5.5 design file.
export const videoNodeAssets = {
  add: `${base}add.svg`, // Icon/System / Linear / add, 64:2241, latest 84:6110.
  info: `${base}info.svg`, // Icon/System / Linear / info-circle, 64:2228.
  expandText: `${base}expand-text.svg`, // Icon/Business/AI / expand-text, 3:868.
  imageToPrompt: `${base}image-to-prompt.svg`, // Icon/Business/AI / image-to-prompt, 3:876.
  auto: `${base}auto.svg`, // Icon/AspectRatio / auto, 84:6078.
} as const;
