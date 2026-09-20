import { render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { __ } from '@vifee/i18n';
import { Icon, type IconName } from '../../ui/icons';
import { canvasToBlob } from '../../shared/canvas';
import { rasterizeAnnotations } from './rasterize';
import {
  COLOR_HEX,
  clearAll,
  commitShape,
  initialState,
  normalizeRect,
  redo,
  undo,
  type ColorName,
  type EditorState,
  type Point,
  type Rect,
  type Shape,
  type Tool,
} from './state';

export interface ScalePair { x: number; y: number }
interface Size { width: number; height: number }
interface GestureDraft { start: Point; current: Point }
interface TextDraft { at: Point; value: string }

/** Smallest bitmap-space extent a committed shape may have (filters stray clicks). */
const MIN_SHAPE_PX = 2;
const TEXT_DOMAIN = 'vifee-visual-feedback';

/**
 * Opens the full-screen annotation editor over `image` inside `root`
 * (a ShadowRoot). Resolves the annotated WebP/PNG blob, or `null` when
 * cancelled. Mirrors `selectImageRegion`: container in the shadow root,
 * preact render, finish-cleanup.
 */
/** On-screen CSS size of the capture (region selector); caps the editor surface. */
export interface NativeCaptureSize { width: number; height: number }

export function openAnnotationEditor(image: Blob, root: ShadowRoot, signal?: AbortSignal, native?: NativeCaptureSize): Promise<Blob | null> {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    root.append(container);
    const finish = (result: Blob | null) => {
      render(null, container);
      container.remove();
      resolve(result);
    };
    render(<AnnotationEditor image={image} signal={signal} native={native} finish={finish} />, container);
  });
}

/**
 * Display→bitmap multipliers — also used by region-selector's confirm():
 * the base image fills the stage, so both axes scale independently.
 */
export function bitmapScale(display: Size, bitmap: Size): ScalePair {
  return {
    x: display.width > 0 ? bitmap.width / display.width : 1,
    y: display.height > 0 ? bitmap.height / display.height : 1,
  };
}

export function toBitmapPoint(point: Point, scale: ScalePair): Point {
  return { x: point.x * scale.x, y: point.y * scale.y };
}

export function toBitmapRect(from: Point, to: Point, scale: ScalePair): Rect {
  return normalizeRect(toBitmapPoint(from, scale), toBitmapPoint(to, scale));
}

/** Keeps a display-space point (e.g. the text caret) inside the visible stage. */
export function clampPoint(point: Point, bounds: Size): Point {
  return {
    x: Math.min(Math.max(point.x, 8), Math.max(8, bounds.width - 8)),
    y: Math.min(Math.max(point.y, 8), Math.max(8, bounds.height - 8)),
  };
}

/**
 * Display-space box the bitmap occupies when fitted into `display` with
 * uniform scaling: never anisotropically stretched and never upscaled —
 * a region crop smaller than the stage shows at its native 1:1 size,
 * while oversized bitmaps shrink to the limiting axis. `cap` (a capture's
 * on-screen CSS size, threaded from the region selector) further limits
 * the box: the bitmap is in device pixels, so a
 * DPR-2 crop must not render at twice its on-screen size. Centered by the
 * stage; pointer mapping and the preview canvas are anchored to this box,
 * so gestures land exactly where they are drawn.
 */
export function containBox(display: Size, bitmap: Size, cap?: Size): Size {
  if (display.width <= 0 || display.height <= 0 || bitmap.width <= 0 || bitmap.height <= 0) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(
    1,
    display.width / bitmap.width,
    display.height / bitmap.height,
    cap && cap.width > 0 ? cap.width / bitmap.width : 1,
    cap && cap.height > 0 ? cap.height / bitmap.height : 1,
  );
  return { width: bitmap.width * scale, height: bitmap.height * scale };
}

/**
 * Display-space font size for the live text input. The rasterizer burns text
 * at `max(7, round(base.width / 80))` *bitmap* px (rasterize.ts), and the
 * stage shows the whole bitmap scaled down, so matching its visual size means
 * dividing by scale.y — multiplying rendered the caret 4× too big at DPR 2.
 */
export function displayTextFontSize(bitmapWidth: number, scale: ScalePair): number {
  return Math.max(7, Math.round(bitmapWidth / 80)) / (scale.y > 0 ? scale.y : 1);
}

/**
 * Turns a completed pointer gesture into a committed `Shape`, or `null` when
 * the gesture is too small to be intentional. Blur shapes carry no color by
 * design; text never comes from gestures (it goes through its input flow).
 */
export function gestureShape(tool: Tool, color: ColorName, start: Point, end: Point, scale: ScalePair): Shape | null {
  const from = toBitmapPoint(start, scale);
  const to = toBitmapPoint(end, scale);
  if (tool === 'arrow') {
    return Math.hypot(to.x - from.x, to.y - from.y) < MIN_SHAPE_PX ? null : { tool: 'arrow', color, from, to };
  }
  if (tool === 'text') return null;
  const rect = normalizeRect(from, to);
  if (rect.width < MIN_SHAPE_PX || rect.height < MIN_SHAPE_PX) return null;
  switch (tool) {
    case 'rect': return { tool: 'rect', color, rect };
    case 'ellipse': return { tool: 'ellipse', color, rect };
    case 'blur-rect': return { tool: 'blur-rect', rect };
    case 'blur-ellipse': return { tool: 'blur-ellipse', rect };
    default: return null;
  }
}

const TOOLS: Array<{ id: Tool; label: string }> = [
  { id: 'arrow', label: __( 'Arrow', TEXT_DOMAIN ) },
  { id: 'rect', label: __( 'Rectangle', TEXT_DOMAIN ) },
  { id: 'ellipse', label: __( 'Ellipse', TEXT_DOMAIN ) },
  { id: 'text', label: __( 'Text', TEXT_DOMAIN ) },
  { id: 'blur-rect', label: __( 'Blur rectangle', TEXT_DOMAIN ) },
  { id: 'blur-ellipse', label: __( 'Blur ellipse', TEXT_DOMAIN ) },
];
const TOOL_ICONS: Record<Tool, IconName> = {
  arrow: 'arrow-up-right',
  rect: 'square',
  ellipse: 'circle',
  text: 'type',
  'blur-rect': 'blur-rect',
  'blur-ellipse': 'blur-ellipse',
};
const COLORS: ColorName[] = ['red', 'yellow', 'blue', 'black'];
const COLOR_LABELS: Record<ColorName, string> = {
  red: __( 'Red', TEXT_DOMAIN ),
  yellow: __( 'Yellow', TEXT_DOMAIN ),
  blue: __( 'Blue', TEXT_DOMAIN ),
  black: __( 'Black', TEXT_DOMAIN ),
};

function AnnotationEditor({ image, signal, native, finish }: { image: Blob; signal?: AbortSignal; native?: NativeCaptureSize; finish(result: Blob | null): void }) {
  const [state, setState] = useState<EditorState>(initialState);
  const [tool, setTool] = useState<Tool>('arrow');
  const [color, setColor] = useState<ColorName>('red');
  const [draft, setDraft] = useState<GestureDraft | null>(null);
  const [typing, setTyping] = useState<TextDraft | null>(null);
  const [display, setDisplay] = useState<Size>({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // The global keydown handler runs outside preact's render cycle; mirror the
  // two pieces of state it needs so it always sees the current gesture/typing.
  const latest = useRef<{ typing: TextDraft | null; draft: GestureDraft | null }>({ typing: null, draft: null });
  latest.current = { typing, draft };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  const source = useMemo(() => URL.createObjectURL(image), [image]);

  useEffect(() => () => URL.revokeObjectURL(source), [source]);

  useEffect(() => {
    let disposed = false;
    let loaded: ImageBitmap | null = null;
    createImageBitmap(image).then((bitmap) => {
      if (disposed) { bitmap.close(); return; }
      loaded = bitmap;
      bitmapRef.current = bitmap;
      setReady(true);
    }).catch(() => {
      if (!disposed) setFatal(__( 'Could not open the image for editing.', TEXT_DOMAIN ));
    });
    return () => {
      disposed = true;
      loaded?.close();
      bitmapRef.current = null;
    };
  }, [image]);

  useEffect(() => {
    const measure = () => setDisplay({ width: window.innerWidth, height: window.innerHeight });
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // ESC hierarchy: cancel typing first (the input handles its own Escape and
  // stops propagation), then cancel an active gesture, else close the editor.
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (latest.current.typing) return;
      if (latest.current.draft) { setDraft(null); return; }
      finishRef.current(null);
    };
    const cancel = () => finishRef.current(null);
    window.addEventListener('keydown', keydown);
    signal?.addEventListener('abort', cancel, { once: true });
    return () => {
      window.removeEventListener('keydown', keydown);
      signal?.removeEventListener('abort', cancel);
    };
  }, [signal]);

  // Redraws committed shapes plus the in-progress preview through the very
  // same rasterizer used for the final export, so the preview is WYSIWYG.
  // Scheduling goes through requestAnimationFrame: pointermove floods coalesce
  // into one rasterization per frame (last state wins) and a pending frame is
  // cancelled on unmount. confirm() never reads this canvas — it rasterizes
  // fresh from committed shapes, so an unflushed frame cannot lose work.
  useEffect(() => {
    const canvas = canvasRef.current;
    const bitmap = bitmapRef.current;
    if (!canvas || !bitmap || display.width <= 0 || display.height <= 0) return;
    const frame = requestAnimationFrame(() => {
      // Backing store matches the bitmap 1:1; CSS (object-fit: contain on a
      // box with the bitmap's aspect) scales it uniformly, so the preview is
      // WYSIWYG for any stage size.
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      if (!context) return;
      const scale = bitmapScale(containBox(display, bitmap, native), bitmap);
      const preview = draft ? gestureShape(tool, color, draft.start, draft.current, scale) : null;
      const shapes = preview ? [...state.shapes, preview] : state.shapes;
      context.drawImage(rasterizeAnnotations(bitmap, shapes), 0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, state, draft, tool, color, display]);

  function localPoint(event: PointerEvent): Point {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function commitGesture(gesture: GestureDraft): void {
    const bitmap = bitmapRef.current;
    if (!bitmap || display.width <= 0 || display.height <= 0) return;
    const shape = gestureShape(tool, color, gesture.start, gesture.current, bitmapScale(containBox(display, bitmap, native), bitmap));
    if (!shape) return;
    setState((current) => commitShape(current, shape));
  }

  function commitTyping(): void {
    const value = typing?.value.trim() ?? '';
    const bitmap = bitmapRef.current;
    if (!typing || !value || !bitmap || display.width <= 0 || display.height <= 0) { setTyping(null); return; }
    const box = containBox(display, bitmap, native);
    const at = toBitmapPoint(clampPoint(typing.at, box), bitmapScale(box, bitmap));
    setState((current) => commitShape(current, { tool: 'text', color, at, value }));
    setTyping(null);
  }

  async function confirm(): Promise<void> {
    const bitmap = bitmapRef.current;
    if (!bitmap || busy) return;
    setBusy(true);
    try {
      const rendered = rasterizeAnnotations(bitmap, state.shapes);
      const blob = (await canvasToBlob(rendered, 'image/webp', 0.86)) ?? (await canvasToBlob(rendered, 'image/png'));
      if (!blob) throw new Error(__( 'Failed to save the annotated image.', TEXT_DOMAIN ));
      finish(blob);
    } catch (reason) {
      setBusy(false);
      setError(reason instanceof Error && reason.message ? reason.message : __( 'Failed to save the annotated image.', TEXT_DOMAIN ));
    }
  }

  const isBlur = tool === 'blur-rect' || tool === 'blur-ellipse';
  const status = fatal ?? error;
  const activeBitmap = bitmapRef.current;
  const surface = activeBitmap && display.width > 0 && display.height > 0 ? containBox(display, activeBitmap, native) : null;
  const textFontPx = activeBitmap && surface ? displayTextFontSize(activeBitmap.width, bitmapScale(surface, activeBitmap)) : 7;

  return (
    <div class="vifee-annotation-editor">
      <div class="vifee-annotation-editor__stage">
        <div
          class="vifee-annotation-editor__surface"
          style={surface ? { width: `${surface.width}px`, height: `${surface.height}px` } : undefined}
          onPointerDown={(event) => {
            if (!ready || busy || fatal) return;
            if ((event.target as Element).closest('button, input')) return;
            const point = localPoint(event);
            setTyping(null);
            if (tool === 'text') { setTyping({ at: clampPoint(point, surface ?? display), value: '' }); return; }
            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
            setDraft({ start: point, current: point });
          }}
          onPointerMove={(event) => { setDraft((current) => (current ? { ...current, current: localPoint(event) } : null)); }}
          onPointerUp={(event) => {
            if (!draft) return;
            const final = { ...draft, current: localPoint(event) };
            setDraft(null);
            commitGesture(final);
          }}
          onPointerCancel={() => { setDraft(null); }}
        >
          <img
            class="vifee-annotation-editor__base vifee-annotation-editor__base--contain"
            src={source}
            alt={__( 'Screenshot to annotate', TEXT_DOMAIN )}
            draggable={false}
          />
          <canvas ref={canvasRef} class="vifee-annotation-editor__canvas" />
          {typing && (
            <input
              class="vifee-annotation-editor__text"
              style={{
                left: `${clampPoint(typing.at, surface ?? display).x}px`,
                top: `${Math.max(4, clampPoint(typing.at, surface ?? display).y - textFontPx - 6)}px`,
                color: COLOR_HEX[color],
                fontSize: `${textFontPx}px`,
              }}
              value={typing.value}
              autoFocus
              aria-label={__( 'Annotation text', TEXT_DOMAIN )}
              onInput={(event) => setTyping({ ...typing, value: event.currentTarget.value })}
              onKeyDown={(event) => {
                if (event.key === 'Escape') { event.stopPropagation(); setTyping(null); }
                else if (event.key === 'Enter') { event.preventDefault(); commitTyping(); }
              }}
            />
          )}
        </div>
      </div>
      <div class="vifee-annotation-editor__toolbar">
        <div class="vifee-annotation-editor__group" role="group" aria-label={__( 'Drawing tools', TEXT_DOMAIN )}>
          {TOOLS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              class="vifee-annotation-editor__tool"
              title={label}
              aria-label={label}
              aria-pressed={tool === id}
              onClick={() => { setTool(id); setTyping(null); }}
            >
              <Icon name={TOOL_ICONS[id]} size={16} />
            </button>
          ))}
        </div>
        {!isBlur && (
          <div class="vifee-annotation-editor__group" role="group" aria-label={__( 'Color', TEXT_DOMAIN )}>
            {COLORS.map((name) => (
              <span key={name} class="vifee-annotation-editor__cell">
                <button
                  type="button"
                  class="vifee-annotation-editor__swatch"
                  style={{ background: COLOR_HEX[name] }}
                  title={COLOR_LABELS[name]}
                  aria-label={COLOR_LABELS[name]}
                  aria-pressed={color === name}
                  onClick={() => setColor(name)}
                />
              </span>
            ))}
          </div>
        )}
        <div class="vifee-annotation-editor__group">
          <button
            type="button"
            class="vifee-annotation-editor__tool"
            title={__( 'Undo', TEXT_DOMAIN )}
            aria-label={__( 'Undo', TEXT_DOMAIN )}
            disabled={state.undoStack.length === 0}
            onClick={() => setState(undo)}
          >
            <Icon name="undo" size={16} />
          </button>
          <button
            type="button"
            class="vifee-annotation-editor__tool"
            title={__( 'Redo', TEXT_DOMAIN )}
            aria-label={__( 'Redo', TEXT_DOMAIN )}
            disabled={state.redoStack.length === 0}
            onClick={() => setState(redo)}
          >
            <Icon name="redo" size={16} />
          </button>
          <button
            type="button"
            class="vifee-annotation-editor__tool"
            title={__( 'Clear annotations', TEXT_DOMAIN )}
            aria-label={__( 'Clear annotations', TEXT_DOMAIN )}
            disabled={state.shapes.length === 0}
            onClick={() => { setState(clearAll); setTyping(null); }}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      </div>
      <div class={`vifee-annotation-editor__hint${status ? ' vifee-annotation-editor__hint--error' : ''}`}>{status ?? __( 'Draw on the image to explain the issue. Esc cancels.', TEXT_DOMAIN )}</div>
      <div class="vifee-annotation-editor__actions">
        <button type="button" class="vifee-button" onClick={() => finish(null)}>{__( 'Cancel', TEXT_DOMAIN )}</button>
        <button type="button" class="vifee-button vifee-button--primary" disabled={!ready || busy} onClick={() => void confirm()}>{busy ? __( 'Saving…', TEXT_DOMAIN ) : __( 'Done', TEXT_DOMAIN )}</button>
      </div>
    </div>
  );
}
