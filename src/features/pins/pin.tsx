import { useEffect, useState } from 'preact/hooks';
import { __, sprintf } from '@vifee/i18n';
import { observeAnchorPosition } from '../../anchors/position-observer';
import type { Feedback } from '../../core/types';
import pinSvg from '@assets/vifee-pin.svg?raw';

export function Pin({ feedback, active, onOpen }: { feedback: Feedback; active: boolean; onOpen(): void }) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  useEffect(
    () =>
      observeAnchorPosition(feedback.anchor, (resolved) =>
        setPosition({ x: resolved.x - window.scrollX, y: resolved.y - window.scrollY })
      ),
    [feedback.anchor]
  );

  if (!position) return null;

  const priorityClass = `is-priority-${feedback.priority}`;
  const activeClass = active ? ' is-active' : '';
  const pendingClass = feedback.uuid.startsWith('pending:') ? ' is-pending' : '';

  return (
    <button
      type="button"
      class={`vifee-pin ${priorityClass}${activeClass}${pendingClass}`}
      style={{ left: position.x, top: position.y }}
      aria-label={sprintf( __( 'Comment: %s', 'vifee-visual-feedback' ), feedback.content )}
      onClick={onOpen}
    >
      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: pinSvg }} />
    </button>
  );
}
