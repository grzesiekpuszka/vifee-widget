import { useEffect, useState } from 'preact/hooks';
import { __ } from '@vifee/i18n';
import type { FeedbackGateway } from '../../core/gateway';
import type { Feedback, Reply } from '../../core/types';
import { AttachmentGallery } from '../screenshot/attachment-gallery';
import { renderMarkdown } from '../../shared/markdown/render';
import { initials, relativeTime } from './discussion-meta';
import { ReplyComposer } from './reply-composer';
import { TechnicalInfo } from './technical-info';

interface ThreadProps {
  feedback: Feedback;
  gateway: FeedbackGateway;
  onReplyCountChange?(count: number): void;
}

export function Thread({ feedback, gateway, onReplyCountChange }: ThreadProps) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    gateway.listReplies(feedback.uuid).then((items) => { if (active) { setReplies((current) => { const known = new Set(items.map((item) => item.uuid)); const next = [...items, ...current.filter((item) => !known.has(item.uuid))]; onReplyCountChange?.(next.length); return next; }); setLoaded(true); } }).catch((reason) => { if (active) { setError(messageFor(reason)); setLoaded(true); } });
    return () => { active = false; };
  }, [feedback.uuid, gateway]);
  function append(reply: Reply) { setReplies((items) => { const next = [...items, reply]; onReplyCountChange?.(next.length); return next; }); }
  return <div class="vifee-thread">
    {/* Only live once the initial history has loaded, so opening a thread
        with existing replies doesn't read the whole backlog aloud — only a
        reply added afterwards (via ReplyComposer's `append`) is announced. */}
    <ol class="vifee-thread__replies" aria-label={__( 'Replies', 'vifee-visual-feedback' )} aria-live={loaded ? 'polite' : undefined} aria-relevant="additions">
      {replies.map((reply) => <li key={reply.uuid}>
        <div class="vifee-chat-row">
          <div class="vifee-avatar" aria-hidden="true">{initials(reply.author.displayName)}</div>
          <div class="vifee-chat-bubble">
            <div class="vifee-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(reply.content) }} />
            <AttachmentGallery attachments={reply.attachments ?? []} gateway={gateway} />
          </div>
        </div>
        <div class="vifee-chat-meta">
          <span>{reply.author.displayName}</span>
          <time dateTime={reply.createdAt}>{relativeTime(reply.createdAt)}</time>
        </div>
      </li>)}
    </ol>
    {feedback.permissions?.canReply && <ReplyComposer feedbackUuid={feedback.uuid} gateway={gateway} onCreated={append} onError={setError} />}
    <TechnicalInfo feedback={feedback} compact />
    {error && <p class="vifee-form-error" role="alert">{error}</p>}
  </div>;
}

function messageFor(reason: unknown): string { return reason instanceof Error ? reason.message : __( 'Failed to load replies.', 'vifee-visual-feedback' ); }
