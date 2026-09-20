import { __, sprintf } from '@vifee/i18n';
import type { Feedback } from '../../core/types';
export { collectTechnicalMetadata } from '../../core/technical-metadata';

export function TechnicalInfo({ feedback, compact = false }: { feedback: Feedback; compact?: boolean }) {
  const rows = [
    [__( 'Browser', 'vifee-visual-feedback' ), feedback.metadata.browser], [__( 'OS', 'vifee-visual-feedback' ), feedback.metadata.os],
    [__( 'Viewport', 'vifee-visual-feedback' ), feedback.metadata.viewport], [__( 'Screen', 'vifee-visual-feedback' ), feedback.metadata.screen],
    [__( 'Scale', 'vifee-visual-feedback' ), feedback.metadata.scale], [__( 'URL', 'vifee-visual-feedback' ), feedback.page.canonicalUrl],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  const errors = feedback.metadata.errors ?? [];
  return (
    <details class={`vifee-technical-info${compact ? ' is-compact' : ''}`}>
      <summary>{__( 'Technical information', 'vifee-visual-feedback' )}</summary>
      <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {errors.length > 0 && (
        <div class="vifee-technical-info__errors">
          <h4>
            {sprintf(
              /* translators: %d: number of JavaScript errors captured. */
              __( 'JavaScript errors (%d)', 'vifee-visual-feedback' ),
              errors.length,
            )}
          </h4>
          <ul>
            {errors.map((error, index) => (
              <li key={`${error.message}-${index}`}>
                <code>{error.message}</code>
                {error.source && (
                  <span class="vifee-technical-info__origin">
                    {error.line ? `${error.source}:${error.line}` : error.source}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}
