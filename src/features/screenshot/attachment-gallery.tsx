import { useEffect, useState } from 'preact/hooks';
import { __ } from '@vifee/i18n';
import type { FeedbackGateway } from '../../core/gateway';
import type { Attachment } from '../../core/types';
import { IconButton } from '../../ui/icon-button';

export function AttachmentGallery({ attachments, gateway }: { attachments: Attachment[]; gateway: FeedbackGateway }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  if (attachments.length === 0) return null;
  return (
    <>
      <ul class="vifee-attachment-gallery" aria-label={__( 'Screenshots', 'vifee-visual-feedback' )}>
        {attachments.map((attachment) => (
          <AttachmentImage key={attachment.uuid} attachment={attachment} gateway={gateway} onOpen={setLightbox} />
        ))}
      </ul>
      {lightbox && (
        <div class="vifee-lightbox" role="dialog" aria-modal="true" aria-label={__( 'Screenshot preview', 'vifee-visual-feedback' )}>
          <div class="vifee-lightbox__backdrop" onClick={() => setLightbox(null)} />
          <div class="vifee-lightbox__frame">
            <div class="vifee-lightbox__actions">
              <IconButton
                label={__( 'Open in a new tab', 'vifee-visual-feedback' )}
                icon="arrow-up-right"
                onClick={() => window.open(lightbox, '_blank', 'noopener,noreferrer')}
              />
              <IconButton
                label={__( 'Close preview', 'vifee-visual-feedback' )}
                icon="x"
                onClick={() => setLightbox(null)}
              />
            </div>
            <img src={lightbox} alt={__( 'Comment screenshot', 'vifee-visual-feedback' )} />
          </div>
        </div>
      )}
    </>
  );
}

function AttachmentImage({
  attachment,
  gateway,
  onOpen,
}: {
  attachment: Attachment;
  gateway: FeedbackGateway;
  onOpen(source: string): void;
}) {
  // Freshly-uploaded attachments already carry a blob: URL created by the
  // caller (see wordpress-gateway.ts's uploadTemporaryAttachment) — that URL
  // is owned by the composer, not this component, so it must not be revoked
  // here. Everything else is fetched once via the authenticated download.
  const initialSource = attachment.downloadUrl.startsWith('blob:') ? attachment.downloadUrl : null;
  const [source, setSource] = useState<string | null>(initialSource);
  useEffect(() => {
    if (initialSource) return;
    let active = true;
    let objectUrl: string | null = null;
    gateway.downloadAttachment(attachment.uuid).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    }).catch(() => undefined);
    return () => {
      active = false;
      // Only revoke a URL this effect itself created — if it never resolved
      // (or resolved after unmount) objectUrl stays null and there is
      // nothing to clean up. Crucially, `source` is NOT a dependency below,
      // so setting it via setSource() does not re-run/cleanup this effect
      // and prematurely revoke the very URL just handed to the <img>.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `initialSource` is derived from `attachment.uuid` and must not itself be a dependency (see comment above).
  }, [attachment.uuid, gateway]);

  return (
    <li>
      {source ? (
        <button
          type="button"
          class="vifee-attachment-gallery__thumb"
          onClick={() => onOpen(source)}
          aria-label={__( 'Open screenshot', 'vifee-visual-feedback' )}
        >
          <img src={source} alt={__( 'Comment screenshot', 'vifee-visual-feedback' )} />
        </button>
      ) : (
        <span>{__( 'Loading image…', 'vifee-visual-feedback' )}</span>
      )}
    </li>
  );
}
