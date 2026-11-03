import { lazy, Suspense, type ComponentProps } from 'react';

const Cutout = lazy(() => import('./CutoutEditor').then(module => ({ default: module.CutoutEditor })));
const DrawingGuide = lazy(() => import('./DrawingGuideEditor').then(module => ({ default: module.DrawingGuideEditor })));

// Keep loading boundaries local so opening an editor never hides the existing canvas.
export function CutoutEditor(props: ComponentProps<typeof Cutout>) {
  return <Suspense fallback={null}><Cutout {...props} /></Suspense>;
}

export function DrawingGuideEditor(props: ComponentProps<typeof DrawingGuide>) {
  return <Suspense fallback={null}><DrawingGuide {...props} /></Suspense>;
}
