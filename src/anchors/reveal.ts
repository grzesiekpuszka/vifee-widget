import type { CommentAnchor } from '../core/types';
import { resolveAnchorPosition } from './legacy-anchor';

const VIEWPORT_PAD_TOP = 80;
const VIEWPORT_PAD_BOTTOM = 160;

export function revealAnchor(anchor: CommentAnchor): void {
  const resolved = resolveAnchorPosition(anchor);
  const viewportY = resolved.y - window.scrollY;
  if (viewportY < VIEWPORT_PAD_TOP || viewportY > window.innerHeight - VIEWPORT_PAD_BOTTOM) {
    window.scrollTo({
      top: Math.max(0, resolved.y - window.innerHeight / 3),
      behavior: 'smooth',
    });
  }
}
