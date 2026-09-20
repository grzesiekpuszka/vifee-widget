import { useEffect, useRef, useState } from 'preact/hooks';
import { __ } from '@vifee/i18n';
import { captureAnchor, isWidgetOwned } from '../../anchors/legacy-anchor';
import type { CommentAnchor } from '../../core/types';

export function PickerOverlay({ onSelect, onCancel }: { onSelect(anchor: CommentAnchor): void; onCancel(): void }) {
  const overlay = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  function captureUnderlying(x: number, y: number): CommentAnchor {
    const layer = overlay.current; const root = layer?.getRootNode(); const host = root instanceof ShadowRoot && root.host instanceof HTMLElement ? root.host : null;
    const display = host?.style.display ?? ''; if (host) host.style.display = 'none';
    try { return captureAnchor(x, y); } finally { if (host) host.style.display = display; }
  }
  function underlying(x: number, y: number): Element | null {
    const layer = overlay.current; if (!layer) return null;
    const root = layer.getRootNode(); const host = root instanceof ShadowRoot && root.host instanceof HTMLElement ? root.host : null;
    const display = host?.style.display ?? ''; if (host) host.style.display = 'none';
    const target = document.elementFromPoint(x, y); if (host) host.style.display = display;
    return target instanceof Element && !isWidgetOwned(target) ? target : null;
  }
  // The overlay only intercepts pointer events (it is not laid over the DOM
  // in a way that removes the underlying page from the tab order), so a
  // keyboard user can already Tab through the real page while picking. What
  // was missing is a way to *confirm* the currently focused element as the
  // anchor: Enter does that here, reusing the same captureAnchor() a pointer
  // click uses (fed the focused element's center point), so both paths
  // produce identical anchor data. Without this, placing any pin was
  // impossible without a pointer device.
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onCancel(); return; }
      if (event.key !== 'Enter') return;
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || active === document.body || isWidgetOwned(active)) return;
      event.preventDefault();
      const target = active.getBoundingClientRect();
      onSelect(captureUnderlying(target.left + target.width / 2, target.top + target.height / 2));
    };
    const focusin = (event: FocusEvent) => {
      const target = event.target;
      setRect(target instanceof HTMLElement && target !== document.body && !isWidgetOwned(target) ? target.getBoundingClientRect() : null);
    };
    document.addEventListener('keydown', keydown);
    document.addEventListener('focusin', focusin);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('focusin', focusin);
    };
  }, [onCancel, onSelect]);
  return <div ref={overlay} class="vifee-picker" role="button" tabIndex={0} aria-label={__( 'Select comment location', 'vifee-visual-feedback' )}
    onPointerMove={(event) => setRect(underlying(event.clientX, event.clientY)?.getBoundingClientRect() ?? null)}
    onPointerDown={(event) => {
      if ((event.target as Element).closest('.vifee-picker__hint')) return;
      // Confirming a pin mounts the comment form, whose layout effect focuses
      // the composer — but the browser's own mousedown focus default fires
      // after dispatch completes and would steal that focus (the picked
      // overlay is gone by then, so focus lands on <body> and Escape/typing
      // never reach the form). Cancelling the pointerdown suppresses exactly
      // that default; the hint's Cancel button above stays clickable.
      event.preventDefault();
      onSelect(captureUnderlying(event.clientX, event.clientY));
    }}>
    {rect && <div class="vifee-picker__highlight" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />}
    <div class="vifee-picker__hint">{__( 'Click the spot, or press Tab then Enter to select the focused element', 'vifee-visual-feedback' )}<button type="button" onClick={onCancel}>{__( 'Cancel', 'vifee-visual-feedback' )} <kbd>Esc</kbd></button></div>
  </div>;
}
