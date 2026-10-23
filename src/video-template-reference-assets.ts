const base = `${import.meta.env.BASE_URL}assets/video-template-20261023/`;

// Original Figma assets: template 76:5477, hover panels 141:24346 / 141:24242.
export const videoTemplateReferenceAssets = {
  subjectThumbnail: `${base}subject-thumbnail.png`,
  modelThumbnail: `${base}model-thumbnail.png`,
  subjectFront: `${base}subject-front.jpg`,
  subjectBack: `${base}subject-back.png`,
  subjectPrevious: `${base}subject-previous.svg`,
  subjectNext: `${base}subject-next.svg`,
  modelPreview: `${base}model-preview.png`,
  brandSubject: `${base}brand-subject.png`,
  brandModel: `${base}brand-model.png`,
};

export const videoTemplateSubjectImages = [
  videoTemplateReferenceAssets.subjectFront,
  videoTemplateReferenceAssets.subjectBack,
];

export type VideoTemplateReferenceSet = {
  subjects: readonly string[];
  subjectThumbnail: string;
  modelThumbnail: string;
  modelPreview: string;
  hasModelDescription: boolean;
};

export const videoTemplateReferenceSets = {
  commerce: {
    subjects: videoTemplateSubjectImages,
    subjectThumbnail: videoTemplateReferenceAssets.subjectThumbnail,
    modelThumbnail: videoTemplateReferenceAssets.modelThumbnail,
    modelPreview: videoTemplateReferenceAssets.modelPreview,
    hasModelDescription: true,
  },
  brand: {
    // Only one brand subject image is supplied in the current design.
    subjects: [videoTemplateReferenceAssets.brandSubject],
    subjectThumbnail: videoTemplateReferenceAssets.brandSubject,
    modelThumbnail: videoTemplateReferenceAssets.brandModel,
    modelPreview: videoTemplateReferenceAssets.brandModel,
    hasModelDescription: false,
  },
} satisfies Record<string, VideoTemplateReferenceSet>;
