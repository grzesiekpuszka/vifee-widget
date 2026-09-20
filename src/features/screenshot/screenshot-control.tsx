import { useEffect, useRef, useState } from 'preact/hooks';
import { __ } from '@vifee/i18n';
import type { AttachmentSource, FeedbackGateway } from '../../core/gateway';
import { normalizeImage } from '../../core/image-normalizer';
import type { Attachment } from '../../core/types';
import { IconButton } from '../../ui/icon-button';
import { Icon } from '../../ui/icons';

interface AttachmentComposerProps {
  gateway: FeedbackGateway; attachments: Attachment[]; maximum: number; excludeRoot?: Element;
  regionEnabled?: boolean; uploadEnabled?: boolean; compact?: boolean; onChange(attachments: Attachment[]): void;
}

const captureTimeout = 20_000;
const uploadTimeout = 15_000;
const editTimeout = 120_000;

// Shared post-capture step for every acquisition path: opens the lazy
// annotation editor over the prepared blob. `native` carries the capture's
// on-screen CSS size (region crops) so the editor never renders a DPR-scaled
// bitmap larger than what the user actually selected. Resolves null when the
// user cancelled (callers must not upload); throws on real failures so the
// composer surfaces them through setError instead of silently uploading.
async function annotate(blob: Blob, operation: AbortController, native?: { width: number; height: number }): Promise<Blob | null> {
  const shadow = document.getElementById('vifee-widget-root')?.shadowRoot;
  if (!shadow) throw new Error(__( 'Unable to open the annotation editor.', 'vifee-visual-feedback' ));
  const { openAnnotationEditor } = await import('../annotations/annotation-editor');
  // Conditional spread keeps 3-arg calls for paths without a native cap, so
  // callers observing the editor invocation don't see a trailing undefined.
  const pending = native
    ? openAnnotationEditor(blob, shadow, operation.signal, native)
    : openAnnotationEditor(blob, shadow, operation.signal);
  return deadline(pending, editTimeout, operation, __( 'Preparing the image took too long.', 'vifee-visual-feedback' ));
}

export function AttachmentComposer({ gateway, attachments, maximum, excludeRoot, regionEnabled = false, uploadEnabled = false, compact = false, onChange }: AttachmentComposerProps) {
  const [working, setWorking] = useState<'viewport' | 'region' | 'upload' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function capture(mode: 'viewport' | 'region') {
    if (working || attachments.length >= maximum) return;
    const operation = new AbortController(); controller.current = operation; setWorking(mode); setError(null);
    try {
      const root = excludeRoot ?? document.getElementById('vifee-widget-root') ?? document.documentElement;
      const { captureViewport } = await import('./capture-viewport');
      let blob = await deadline(captureViewport({ maskSelector: '[data-vifee-mask]', excludeRoot: root, signal: operation.signal }), captureTimeout, operation, __( 'Generating the screenshot took too long.', 'vifee-visual-feedback' ));
      if (mode === 'region') {
        const shadow = document.getElementById('vifee-widget-root')?.shadowRoot;
        if (!shadow) throw new Error(__( 'Unable to start area selection.', 'vifee-visual-feedback' ));
        const { selectImageRegion } = await import('./region-selector');
        const selected = await selectImageRegion(blob, shadow, operation.signal); if (!selected) return;
        blob = selected.blob;
        const annotated = await annotate(blob, operation, { width: selected.cssWidth, height: selected.cssHeight });
        if (!annotated) return;
        await upload(annotated, operation, 'region');
        return;
      }
      const annotated = await annotate(blob, operation);
      if (!annotated) return;
      await upload(annotated, operation, 'viewport');
    } catch (reason) { if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(message(reason)); }
    finally { if (controller.current === operation) controller.current = null; setWorking(null); }
  }

  async function uploadFile(file: File) {
    if (working || attachments.length >= maximum) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError(__( 'Choose a JPEG, PNG or WebP image up to 5 MB.', 'vifee-visual-feedback' )); return; }
    const operation = new AbortController(); controller.current = operation; setWorking('upload'); setError(null);
    try {
      const annotated = await annotate(await normalizeImage(file), operation);
      if (!annotated) return;
      await upload(annotated, operation, 'file');
    }
    catch (reason) { if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(message(reason)); }
    finally { if (controller.current === operation) controller.current = null; setWorking(null); }
  }

  async function upload(blob: Blob, operation: AbortController, source: AttachmentSource) {
    const attachment = await deadline(gateway.uploadTemporaryAttachment(blob, source), uploadTimeout, operation, __( 'Uploading the image took too long.', 'vifee-visual-feedback' ));
    onChange([...attachments, attachment]);
  }
  async function remove(attachment: Attachment) {
    try {
      await gateway.deleteTemporaryAttachment(attachment.uuid);
      // downloadUrl is a local blob: URL created for the preview (see
      // BaseGateway.uploadTemporaryAttachment) — nothing else references it
      // once the attachment is gone, so it must be released here. Deliberately
      // NOT in a `finally`: a failed delete leaves the attachment on screen,
      // and revoking its URL would break the preview that is still rendered.
      URL.revokeObjectURL(attachment.downloadUrl);
      onChange(attachments.filter((item) => item.uuid !== attachment.uuid));
    } catch (reason) { setError(message(reason)); }
  }

  const full = attachments.length >= maximum;
  return <div class={`vifee-screenshot-control${compact ? ' is-compact' : ''}`}>
    <div class="vifee-screenshot-control__sources">
      {compact ? <IconButton label={__( 'Viewport screenshot', 'vifee-visual-feedback' )} icon="camera" disabled={Boolean(working) || full} onClick={() => void capture('viewport')} /> : <button type="button" class="vifee-capture-button" title={__( 'Viewport screenshot', 'vifee-visual-feedback' )} aria-label={__( 'Viewport screenshot', 'vifee-visual-feedback' )} disabled={Boolean(working) || full} onClick={() => void capture('viewport')}><Icon name="camera" size={17} /></button>}
      {regionEnabled && (compact ? <IconButton label={__( 'Select area', 'vifee-visual-feedback' )} icon="crop" disabled={Boolean(working) || full} onClick={() => void capture('region')} /> : <button type="button" class="vifee-capture-button" title={__( 'Select area', 'vifee-visual-feedback' )} aria-label={__( 'Select area', 'vifee-visual-feedback' )} disabled={Boolean(working) || full} onClick={() => void capture('region')}><Icon name="crop" size={17} /></button>)}
      {uploadEnabled && <label class={compact ? 'vifee-icon-button' : 'vifee-capture-button'} title={__( 'Add image', 'vifee-visual-feedback' )}><Icon name="paperclip" size={compact ? 16 : 17} /><input aria-label={__( 'Add image', 'vifee-visual-feedback' )} type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(working) || full} onChange={(event) => { const input = event.currentTarget; const file = input.files?.[0]; if (file) void uploadFile(file); /* Cleared so re-picking the SAME file after a rejected or failed upload fires change again; without this the input keeps its value and the second attempt is a no-op. */ input.value = ''; }} /></label>}
      {working && (compact ? <IconButton label={__( 'Cancel', 'vifee-visual-feedback' )} icon="x" onClick={() => controller.current?.abort()} /> : <button type="button" class="vifee-button" onClick={() => controller.current?.abort()}>{__( 'Cancel', 'vifee-visual-feedback' )}</button>)}
    </div>
    {attachments.length > 0 && <ul aria-label={__( 'Added images', 'vifee-visual-feedback' )}>{attachments.map((attachment) => <li key={attachment.uuid}><img src={attachment.downloadUrl} alt={__( 'Image preview', 'vifee-visual-feedback' )} /><IconButton label={__( 'Remove image', 'vifee-visual-feedback' )} icon="x" onClick={() => void remove(attachment)} /></li>)}</ul>}
    {error && <p class="vifee-form-error" role="alert">{error}</p>}
  </div>;
}

export function ScreenshotControl(props: AttachmentComposerProps) { return <AttachmentComposer {...props} />; }

function deadline<T>(promise: Promise<T>, milliseconds: number, controller: AbortController, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => { const timer = window.setTimeout(() => { controller.abort(); reject(new Error(timeoutMessage)); }, milliseconds); promise.then(resolve, reject).finally(() => window.clearTimeout(timer)); });
}
function message(reason: unknown): string { return reason instanceof Error ? reason.message : __( 'Failed to prepare the image.', 'vifee-visual-feedback' ); }
