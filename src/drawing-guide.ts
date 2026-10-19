export type GuidePoint = { x: number; y: number };
export type GuideTool = 'brush' | 'eraser';
export type GuideStroke = { tool: GuideTool; color: string; size: number; points: GuidePoint[] };
export type DrawingGuide = {
  sourceUrl: string;
  width: number;
  height: number;
  strokes: GuideStroke[];
  previewUrl: string;
};

// Keep drawing coordinates independent of viewport size, zoom and image pixels.
export function guideDimensions(width: number, height: number) {
  const scale = 1000 / Math.max(1, width, height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function paintGuide(canvas: HTMLCanvasElement, strokes: GuideStroke[], active?: GuideStroke | null) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('drawing_context_unavailable');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const stroke of active ? [...strokes, active] : strokes) {
    const first = stroke.points[0];
    if (!first) continue;
    ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.fillStyle = ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    if (stroke.points.length === 1) {
      ctx.arc(first.x, first.y, stroke.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  return ctx;
}
