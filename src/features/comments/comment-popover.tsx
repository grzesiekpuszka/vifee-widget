import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { __ } from '@vifee/i18n';
import { observeAnchorPosition } from '../../anchors/position-observer';
import type { FeedbackGateway } from '../../core/gateway';
import type { Feedback } from '../../core/types';
import { IconButton } from '../../ui/icon-button';
import { Icon } from '../../ui/icons';
import { useFocusTrap } from '../../ui/use-focus-trap';
import { AttachmentGallery } from '../screenshot/attachment-gallery';
import { renderMarkdown } from '../../shared/markdown/render';
import { relativeTime } from './discussion-meta';
import { issueTypeLabel, priorityLabel, StatusSelect } from './workflow-selects';

interface CommentPopoverProps {
  feedback: Feedback;
  number: number;
  gateway: FeedbackGateway;
  onClose(): void;
  onOpenDetails(): void;
  onUpdated(feedback: Feedback): void;
}

export function CommentPopover({ feedback, number, gateway, onClose, onOpenDetails, onUpdated }: CommentPopoverProps) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => observeAnchorPosition(feedback.anchor, (resolved) => {
    setPosition({
      left: resolved.x - window.scrollX + 24,
      top: resolved.y - window.scrollY - 24,
    });
  }), [feedback.anchor]);

  const panelRef = useRef<HTMLElement | null>(null);
  const settledRef = useRef(false);

  // The panel's width/height depend on its own CSS (responsive on narrow
  // viewports) and aren't known until it renders, so positioning is two-pass:
  // anchor-relative first, then clamped into the viewport once measured —
  // otherwise a pin near a screen edge pushes the panel off-screen. Must wait
  // for the mount "pop-in" transform animation to finish first: measuring
  // mid-animation reads a scaled-down, still-moving rect, so the clamp is
  // computed from the wrong size (same reason the sidebar e2e test waits for
  // animationend before measuring its box).
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !position) return;
    const clamp = () => {
      const rect = panel.getBoundingClientRect();
      const margin = 8;
      const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
      const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
      const clampedLeft = Math.min(Math.max(position.left, margin), maxLeft);
      const clampedTop = Math.min(Math.max(position.top, margin), maxTop);
      if (clampedLeft !== position.left || clampedTop !== position.top) {
        setPosition({ left: clampedLeft, top: clampedTop });
      }
    };
    if (settledRef.current || getComputedStyle(panel).animationName === 'none') {
      clamp();
      return;
    }
    const onSettled = () => { settledRef.current = true; clamp(); };
    panel.addEventListener('animationend', onSettled, { once: true });
    return () => panel.removeEventListener('animationend', onSettled);
  }, [position]);

  async function update(changes: Parameters<FeedbackGateway['update']>[2]) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onUpdated(await gateway.update(feedback.uuid, feedback.recordVersion, changes));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : __( 'Failed to save the change.', 'vifee-visual-feedback' ));
    } finally {
      setBusy(false);
    }
  }

  const trapRef = useFocusTrap<HTMLElement>(onClose);
  const setRefs = (node: HTMLElement | null) => {
    panelRef.current = node;
    trapRef(node);
  };

  if (!position) return null;

  return (
    <section
      ref={setRefs}
      class={`vifee-popover is-priority-${feedback.priority}`}
      role="dialog"
      aria-modal="true"
      aria-label={__( 'Comment preview', 'vifee-visual-feedback' )}
      tabIndex={-1}
      style={position}
    >
      <header class="vifee-popover__header">
        <div class="vifee-popover__badge">
          <strong>#{number}</strong>
          <span class={`vifee-priority-badge is-${feedback.priority}`}>{priorityLabel(feedback.priority)}</span>
          {feedback.issueType && (
            <span class={`vifee-issue-type-badge is-${feedback.issueType}`}>{issueTypeLabel(feedback.issueType)}</span>
          )}
        </div>
        <div class="vifee-popover__header-actions">
          <button type="button" class="vifee-popover__details" onClick={onOpenDetails}>
            <Icon name="maximize-2" size={14} />
            <span>{__( 'Open full thread', 'vifee-visual-feedback' )}</span>
          </button>
          <IconButton label={__( 'Close', 'vifee-visual-feedback' )} icon="x" onClick={onClose} />
        </div>
      </header>

      <div class="vifee-popover__content vifee-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(feedback.content) }} />
      <AttachmentGallery attachments={feedback.attachments ?? []} gateway={gateway} />

      <footer class="vifee-popover__footer">
        <span>#{number} · {relativeTime(feedback.createdAt)}</span>
        <StatusSelect
          value={feedback.status}
          disabled={busy || !feedback.permissions?.canChangeStatus}
          onChange={(status) => void update({ status })}
        />
      </footer>

      {error && <p class="vifee-form-error" role="alert">{error}</p>}
    </section>
  );
}
