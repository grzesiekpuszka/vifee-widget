import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { __ } from '@vifee/i18n';
import { bitmapScale } from '../annotations/annotation-editor';
import { canvasToBlob } from '../../shared/canvas';

interface Point { x: number; y: number }

/** The crop blob plus the selection's on-screen CSS size — the bitmap is in
 * device pixels (html2canvas renders at DPR), so the editor needs the CSS
 * size to show the crop at its native on-screen scale. */
export interface RegionSelection { blob: Blob; cssWidth: number; cssHeight: number }

export function selectImageRegion(image: Blob, root: ShadowRoot, signal?: AbortSignal): Promise<RegionSelection | null> {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    root.append(container);
    const finish = (result: RegionSelection | null) => {
      render(null, container);
      container.remove();
      resolve(result);
    };
    render(<RegionSelector image={image} signal={signal} finish={finish} />, container);
  });
}

function RegionSelector({ image, signal, finish }: { image: Blob; signal?: AbortSignal; finish(result: RegionSelection | null): void }) {
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const source = useMemo(() => URL.createObjectURL(image), [image]);
  const selection = rectangle(start, end);

  useEffect(() => {
    const cancel = () => finish(null);
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    signal?.addEventListener('abort', cancel, { once: true });
    window.addEventListener('keydown', keydown);
    return () => {
      URL.revokeObjectURL(source);
      signal?.removeEventListener('abort', cancel);
      window.removeEventListener('keydown', keydown);
    };
  }, [finish, signal, source]);

  async function confirm(): Promise<void> {
    if (!selection || selection.width < 5 || selection.height < 5) return;
    const bitmap = await createImageBitmap(image);
    const scale = bitmapScale({ width: window.innerWidth, height: window.innerHeight }, bitmap);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(selection.width * scale.x));
    canvas.height = Math.max(1, Math.round(selection.height * scale.y));
    const context = canvas.getContext('2d');
    if (!context) { bitmap.close(); throw new Error(__( 'Failed to prepare the selection.', 'vifee-visual-feedback' )); }
    context.drawImage(bitmap, selection.left * scale.x, selection.top * scale.y, selection.width * scale.x, selection.height * scale.y, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await canvasToBlob(canvas, 'image/webp', 0.86);
    if (!blob) { finish(null); return; }
    finish({ blob, cssWidth: Math.round(selection.width), cssHeight: Math.round(selection.height) });
  }

  return (
    <div
      class="vifee-region-selector"
      onPointerDown={(event) => {
        if ((event.target as Element).closest('button')) return;
        const point = { x: event.clientX, y: event.clientY };
        setStart(point); setEnd(point); setDragging(true);
      }}
      onPointerMove={(event) => { if (dragging) setEnd({ x: event.clientX, y: event.clientY }); }}
      onPointerUp={(event) => { if (dragging) { setEnd({ x: event.clientX, y: event.clientY }); setDragging(false); } }}
    >
      <img src={source} alt={__( 'Page screenshot to select', 'vifee-visual-feedback' )} />
      {selection && <div class="vifee-region-selector__selection" style={selection} />}
      <div class="vifee-region-selector__hint">{__( 'Drag to select an area. Esc cancels.', 'vifee-visual-feedback' )}</div>
      {!dragging && selection && selection.width >= 5 && selection.height >= 5 && (
        <div class="vifee-region-selector__actions">
          <button type="button" class="vifee-button vifee-button--primary" onClick={() => void confirm()}>{__( 'Use selection', 'vifee-visual-feedback' )}</button>
          <button type="button" class="vifee-button" onClick={() => finish(null)}>{__( 'Cancel', 'vifee-visual-feedback' )}</button>
        </div>
      )}
    </div>
  );
}

function rectangle(start: Point | null, end: Point | null) {
  if (!start || !end) return null;
  return {
    left: Math.min(start.x, end.x), top: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y),
  };
}
