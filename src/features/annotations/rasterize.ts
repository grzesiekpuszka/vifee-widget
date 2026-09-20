import { COLOR_HEX, type Rect, type Shape } from './state';

export function rasterizeAnnotations(base: ImageBitmap, shapes: Shape[]): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = base.width;
  canvas.height = base.height;
  const ctx = acquireContext(canvas);
  ctx.drawImage(base, 0, 0);
  for (const shape of shapes) {
    if (shape.tool === 'blur-rect' || shape.tool === 'blur-ellipse') {
      applyBlur(canvas, ctx, shape.rect, shape.tool);
    }
  }
  for (const shape of shapes) {
    if (shape.tool !== 'blur-rect' && shape.tool !== 'blur-ellipse') {
      drawOpaqueShape(ctx, base.width, shape);
    }
  }
  return canvas;
}

function acquireContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable');
  return ctx;
}

function lineWidthFor(baseWidth: number): number {
  return Math.max(2, Math.round(baseWidth / 300));
}

function fontFor(baseWidth: number): string {
  return `${Math.max(7, Math.round(baseWidth / 80))}px system-ui, sans-serif`;
}

function applyBlur(
  source: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  tool: 'blur-rect' | 'blur-ellipse',
): void {
  if (rect.width <= 0 || rect.height <= 0) return;
  const pixelSize = Math.max(4, Math.round(Math.min(rect.width, rect.height) / 10));
  const tmp = document.createElement('canvas');
  tmp.width = Math.ceil(rect.width / pixelSize);
  tmp.height = Math.ceil(rect.height / pixelSize);
  const tmpCtx = acquireContext(tmp);
  tmpCtx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, tmp.width, tmp.height);
  ctx.save();
  ctx.beginPath();
  if (tool === 'blur-ellipse') {
    ctx.ellipse(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width / 2, rect.height / 2, 0, 0, Math.PI * 2);
  } else {
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
  }
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

function drawOpaqueShape(ctx: CanvasRenderingContext2D, baseWidth: number, shape: Shape): void {
  switch (shape.tool) {
    case 'arrow': {
      const lineWidth = lineWidthFor(baseWidth);
      ctx.save();
      ctx.strokeStyle = COLOR_HEX[shape.color];
      ctx.fillStyle = COLOR_HEX[shape.color];
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      const angle = Math.atan2(shape.to.y - shape.from.y, shape.to.x - shape.from.x);
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);
      // Bold head: 4×LW long with a π/6 half-angle gives a base ≈4× the
      // shaft thickness — a clearly visible triangle instead of a nub
      // barely wider than the line. The head is clamped to the shaft so a
      // tiny arrow never inverts its triangle.
      const shaftLength = Math.hypot(shape.to.x - shape.from.x, shape.to.y - shape.from.y);
      const headLength = Math.min(lineWidth * 4, shaftLength * 0.8);
      const baseX = shape.to.x - headLength * dirX;
      const baseY = shape.to.y - headLength * dirY;
      const halfBase = headLength * Math.tan(Math.PI / 6);
      // The shaft stops at the head base: a line drawn through to the tip
      // would let the round cap poke out past the apex as a rounded nub.
      // The triangle alone forms the tip.
      ctx.beginPath();
      ctx.moveTo(shape.from.x, shape.from.y);
      ctx.lineTo(baseX, baseY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(shape.to.x, shape.to.y);
      ctx.lineTo(baseX + halfBase * -dirY, baseY + halfBase * dirX);
      ctx.lineTo(baseX - halfBase * -dirY, baseY - halfBase * dirX);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'rect': {
      ctx.strokeStyle = COLOR_HEX[shape.color];
      ctx.lineWidth = lineWidthFor(baseWidth);
      ctx.strokeRect(shape.rect.x, shape.rect.y, shape.rect.width, shape.rect.height);
      break;
    }
    case 'ellipse': {
      ctx.strokeStyle = COLOR_HEX[shape.color];
      ctx.lineWidth = lineWidthFor(baseWidth);
      ctx.beginPath();
      ctx.ellipse(shape.rect.x + shape.rect.width / 2, shape.rect.y + shape.rect.height / 2, shape.rect.width / 2, shape.rect.height / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'text': {
      ctx.font = fontFor(baseWidth);
      ctx.fillStyle = COLOR_HEX[shape.color];
      ctx.fillText(shape.value, shape.at.x, shape.at.y);
      break;
    }
  }
}
