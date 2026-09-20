import { useState } from 'preact/hooks';
import { __ } from '@vifee/i18n';
import type { FeedbackGateway } from '../../core/gateway';
import type { ReviewActivationResult } from '../../core/types';
import { Icon } from '../../ui/icons';

interface ReviewActivationProps {
  gateway: FeedbackGateway;
  token: string;
  onActivated(result: ReviewActivationResult): void;
}

export function ReviewActivation({ gateway, token, onActivated }: ReviewActivationProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activate(event: Event) {
    event.preventDefault();
    if (!gateway.activateReview || !name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      onActivated(await gateway.activateReview(token, { name: name.trim(), email: email.trim() || undefined }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : __( 'Failed to activate the link.', 'vifee-visual-feedback' ));
      setBusy(false);
    }
  }

  return (
    <div class="vifee-activation-backdrop">
      <form class="vifee-activation" aria-label={__( 'Access to commenting', 'vifee-visual-feedback' )} onSubmit={(event) => void activate(event)}>
        <div class="vifee-activation__header">
          <span class="vifee-activation__icon" aria-hidden="true"><Icon name="message-circle" size={24} /></span>
          <div>
            <strong style={{ display: 'block', fontSize: '18px', lineHeight: 1.2 }}>{__( 'Start a review', 'vifee-visual-feedback' )}</strong>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--vifee-ink-600)' }}>
              Vifee Visual Feedback
            </p>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--vifee-ink-700)', lineHeight: 1.45 }}>
          {__( 'Enter your name or nickname so you can leave comments directly on the page.', 'vifee-visual-feedback' )}
        </p>

        <label>
          {__( 'Your name or signature *', 'vifee-visual-feedback' )}
          <input
            required
            maxLength={80}
            autoComplete="name"
            placeholder={__( 'e.g. Jane Doe', 'vifee-visual-feedback' )}
            value={name}
            onInput={(event) => setName(event.currentTarget.value)}
          />
        </label>

        <label>
          {__( 'Email address', 'vifee-visual-feedback' )} <span>{__( '(optional, for notifications)', 'vifee-visual-feedback' )}</span>
          <input
            type="email"
            maxLength={254}
            autoComplete="email"
            placeholder="jane@example.com"
            value={email}
            onInput={(event) => setEmail(event.currentTarget.value)}
          />
        </label>

        <button
          class="vifee-button vifee-button--primary"
          type="submit"
          disabled={busy || !name.trim()}
          style={{ minHeight: '44px', fontSize: '14px', marginTop: '4px' }}
        >
          {busy ? __( 'Activating access…', 'vifee-visual-feedback' ) : __( 'Go to page review', 'vifee-visual-feedback' )}
        </button>

        {error && <p class="vifee-form-error" role="alert">{error}</p>}
      </form>
    </div>
  );
}
