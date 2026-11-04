import { prepareMainImage } from './asset-library';
import type { Locale } from './i18n';
import { sizeVideoCanvasMedia, type VideoCanvasMedia } from './video-canvas-media';
import { createVideoWorkflow, canGenerateVideoWorkflow, normalizeVideoWorkflowSettings, videoReferenceLimits, videoWorkflowReferences, type VideoReference } from './video-workflow';
import { videoTemplateMedia, type VideoTemplate, type VideoTemplateReplacements } from './video-templates';

// Uploaded images replace the template's complete input set. Editing without
// uploads preserves the maintained template's original images and slot bindings.
export async function prepareVideoTemplateGeneration(template: VideoTemplate, replacements: VideoTemplateReplacements, locale: Locale, requireReplacement = true) {
  const definition = template.workflow;
  if (!definition || !template.preview || (requireReplacement && !replacements.length)) {
    throw new Error('template_inputs_required');
  }
  if (replacements.length > videoReferenceLimits.image || replacements.some(image => !image.url)) throw new Error('invalid_template_inputs');
  const slots = replacements.length
    ? replacements.map((image, index) => ({ ...image, target: definition.mode === 'references' ? 'references' as const : index === 0 ? 'main' as const : 'endFrame' as const }))
    : definition.inputs.flatMap(input => input.images.map((url, index) => ({
      url, name: `${template.label[locale]} · ${input.slot === 'garment' ? '商品' : '模特'} ${index + 1}`, target: input.target,
    })));
  if (definition.mode === 'frames' && (slots.some(slot => slot.target === 'references')
    || slots.filter(slot => slot.target === 'main').length !== 1 || slots.filter(slot => slot.target === 'endFrame').length > 1)) {
    throw new Error('invalid_template_frame_slots');
  }
  if (definition.mode === 'references' && slots.some(slot => slot.target !== 'references')) throw new Error('invalid_template_reference_slots');

  const loaded = await Promise.all(slots.map(async slot => ({
    target: slot.target,
    media: sizeVideoCanvasMedia({ ...await prepareMainImage({ ...slot, id: crypto.randomUUID() }), role: undefined }),
  })));
  const { inputs: _inputs, prompt, ...settings } = definition;
  const workflow = normalizeVideoWorkflowSettings({ ...createVideoWorkflow(0, 0, undefined, definition.mode), ...settings, prompt: prompt[locale] });
  for (const { target, media } of loaded) {
    const reference: VideoReference = { id: crypto.randomUUID(), sourceImageId: media.id, url: media.url, name: media.name, kind: 'image' };
    if (target === 'references') workflow.references.push(reference);
    else workflow[target] = reference;
  }
  if (!canGenerateVideoWorkflow(workflow) || videoWorkflowReferences(workflow).length > videoReferenceLimits.image) throw new Error('invalid_template_workflow');
  // Do not silently change a maintained template into a different configuration.
  if (workflow.resolution !== definition.resolution || workflow.duration !== definition.duration || workflow.audio !== definition.audio) throw new Error('invalid_template_settings');
  workflow.referenceOrder = workflow.references.map(reference => reference.id);

  const { poster, video: videoUrl, width, height } = videoTemplateMedia(template);
  const name = `${template.label[locale]} · ${locale === 'zh-CN' ? '视频演示结果' : locale === 'ja' ? '動画デモ結果' : 'Video demo result'}.mp4`;
  const posterImage = await prepareMainImage({ id: crypto.randomUUID(), url: poster, name });
  const result: Omit<VideoCanvasMedia, 'x' | 'y'> = sizeVideoCanvasMedia({
    ...posterImage, role: undefined, generatedByEditorId: workflow.id,
    naturalWidth: width ?? posterImage.naturalWidth, naturalHeight: height ?? posterImage.naturalHeight,
    video: { id: crypto.randomUUID(), kind: 'video', url: videoUrl, posterUrl: poster, name,
      width: width ?? posterImage.naturalWidth!, height: height ?? posterImage.naturalHeight!, duration: Number.parseInt(workflow.duration, 10) },
  });
  return { images: loaded.map(item => item.media), workflow, result };
}
