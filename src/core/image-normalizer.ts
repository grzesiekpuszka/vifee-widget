import { __ } from '@vifee/i18n';
import { canvasToBlob } from '../shared/canvas';

/**
 * Browsers cap a canvas at 16384 px per side (Chrome/Firefox; Safari is lower
 * on some devices). Past that the canvas silently becomes unusable and
 * `toBlob()` hands back null, which surfaced to the user as a bare "Failed to
 * prepare the image." with nothing to act on. Scaling by height as well as
 * width keeps a tall screenshot — a full-page phone capture is easily
 * 1200x20000 and well inside the 5 MB upload gate — inside the limit instead.
 */
const MAXIMUM_CANVAS_SIDE = 16384;

export async function normalizeImage(blob: Blob, maximumWidth = 2560): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(
    1,
    maximumWidth / bitmap.width,
    MAXIMUM_CANVAS_SIDE / bitmap.width,
    MAXIMUM_CANVAS_SIDE / bitmap.height,
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error(__( 'The browser does not support image processing.', 'vifee-visual-feedback' ));
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const webp = await canvasToBlob(canvas, 'image/webp', 0.86);
  if (webp?.type === 'image/webp') return webp;
  const png = await canvasToBlob(canvas, 'image/png');
  if (!png) throw new Error(__( 'Failed to prepare the image.', 'vifee-visual-feedback' ));
  return png;
}
