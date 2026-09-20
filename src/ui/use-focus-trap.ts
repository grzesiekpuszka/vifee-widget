import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === container.ownerDocument.activeElement
  );
}

/**
 * Traps Tab focus inside the element this returns a ref-callback for, closes
 * on Escape, and restores focus to whatever was focused before it mounted
 * (the pin or launcher button that opened it) once it unmounts.
 *
 * A callback ref rather than a ref object: some callers (CommentPopover)
 * render `null` for one or more renders before the container element exists
 * (its position resolves asynchronously), so setup must run exactly when the
 * node actually attaches/detaches, not on the enclosing component's mount.
 *
 * Reads/writes activeElement via the container's own root node rather than
 * `document`, because the widget renders inside a shadow root —
 * `document.activeElement` there resolves to the shadow host, not the
 * actually focused element.
 */
export function useFocusTrap<T extends HTMLElement>(onClose: () => void): (node: T | null) => void {
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [node, setNode] = useState<T | null>(null);
  const ref = useCallback((el: T | null) => setNode(el), []);

  useEffect(() => {
    if (!node) return;
    const root = node.getRootNode() as Document | ShadowRoot;
    previouslyFocused.current = root.activeElement instanceof HTMLElement ? root.activeElement : null;
    const focusable = focusableIn(node);
    (focusable[0] ?? node).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusableIn(node);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const activeRoot = node.getRootNode() as Document | ShadowRoot;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && activeRoot.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeRoot.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    node.addEventListener('keydown', handleKeyDown);

    return () => {
      node.removeEventListener('keydown', handleKeyDown);
      const target = previouslyFocused.current;
      if (target?.isConnected) target.focus();
    };
  }, [node]);

  return ref;
}
