import type { CommentAnchor } from '../core/types';
import { resolveAnchorPosition, type ResolvedAnchorPosition } from './legacy-anchor';

export function observeAnchorPosition(anchor: CommentAnchor, callback: (resolved: ResolvedAnchorPosition) => void): () => void {
  let frame = 0;
  let observedElement: Element | null = null;
  const resizeObserver = new ResizeObserver(schedule);
  const mutationObserver = new MutationObserver((mutations) => { if (mutations.some((mutation) => !isWidgetMutation(mutation))) schedule(); });
  function update(): void {
    frame = 0;
    const resolved = resolveAnchorPosition(anchor);
    if (resolved.element !== observedElement) {
      resizeObserver.disconnect(); observedElement = resolved.element;
      if (observedElement) resizeObserver.observe(observedElement);
    }
    callback(resolved);
  }
  function schedule(): void { if (!frame) frame = requestAnimationFrame(update); }
  window.addEventListener('scroll', schedule, true); window.addEventListener('resize', schedule);
  mutationObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true }); schedule();
  return () => { if (frame) cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule, true); window.removeEventListener('resize', schedule); resizeObserver.disconnect(); mutationObserver.disconnect(); };
}
function isWidgetMutation(mutation: MutationRecord): boolean { const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement; return Boolean(target?.closest('#vifee-widget-root, [data-vifee-owned="true"]')); }
