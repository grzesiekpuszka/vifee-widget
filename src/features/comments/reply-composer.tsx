import { useState } from 'preact/hooks';
import { __ } from '@vifee/i18n';
import type { FeedbackGateway } from '../../core/gateway';
import type { Attachment, Reply } from '../../core/types';
import { createUuid } from '../../core/uuid';
import { AttachmentComposer } from '../screenshot/screenshot-control';
import { IconButton } from '../../ui/icon-button';

interface ReplyComposerProps {
  feedbackUuid: string;
  gateway: FeedbackGateway;
  onCreated(reply: Reply): void;
  onError(message: string): void;
}

export function ReplyComposer({ feedbackUuid, gateway, onCreated, onError }: ReplyComposerProps) {
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  async function submit(event: Event) {
    event.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      const reply = await gateway.createReply(feedbackUuid, { content: draft.trim(), attachmentUuids: attachments.map((item) => item.uuid) }, createUuid());
      setDraft(''); setAttachments([]); onCreated(reply);
    } catch (reason) { onError(reason instanceof Error ? reason.message : __( 'Failed to add the reply.', 'vifee-visual-feedback' )); }
    finally { setBusy(false); }
  }
  return <form class="vifee-reply-composer" onSubmit={(event) => void submit(event)}>
    <label class="screen-reader-text" htmlFor={`vifee-reply-${feedbackUuid}`}>{__( 'Add reply', 'vifee-visual-feedback' )}</label>
    <textarea id={`vifee-reply-${feedbackUuid}`} placeholder={__( 'Add a reply…', 'vifee-visual-feedback' )} value={draft} onInput={(event) => setDraft(event.currentTarget.value)} />
    <div class="vifee-reply-composer__actions">
      <AttachmentComposer compact gateway={gateway} attachments={attachments} maximum={3} uploadEnabled onChange={setAttachments} />
      <IconButton class="vifee-reply-composer__send" label={__( 'Send reply', 'vifee-visual-feedback' )} icon="send" type="submit" disabled={busy || !draft.trim()} />
    </div>
  </form>;
}
