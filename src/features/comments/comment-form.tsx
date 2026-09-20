import { useLayoutEffect, useRef } from 'preact/hooks';
import { __ } from '@vifee/i18n';
import type { FeedbackGateway } from '../../core/gateway';
import { AttachmentComposer } from '../screenshot/screenshot-control';
import { ComposerToolbar, CONTENT_LIMIT, insertPlainText, shouldBlockInsert } from './composer-toolbar';
import { serializeMarkdown } from '../../shared/markdown/serialize';
import { renderMarkdown } from '../../shared/markdown/render';
import type { FeedbackIssueType, FeedbackPriority } from '../../core/types';
import type { FeedbackDraftState } from '../../state/feedback-store';
import { IconButton } from '../../ui/icon-button';
import { Icon } from '../../ui/icons';

const COMPOSER_PLACEHOLDER = 'Describe the issue or what needs fixing on this element…';

interface CommentFormProps {
  draft: FeedbackDraftState;
  pending: boolean;
  error: string | null;
  onChange(changes: Partial<FeedbackDraftState>): void;
  onSubmit(): void;
  onCancel(): void;
  gateway: FeedbackGateway;
  screenshotEnabled: boolean;
  regionScreenshotEnabled: boolean;
  imageUploadEnabled: boolean;
  attachmentLimit: number;
}

export function CommentForm({
  draft,
  pending,
  error,
  onChange,
  onSubmit,
  onCancel,
  gateway,
  screenshotEnabled,
  regionScreenshotEnabled,
  imageUploadEnabled,
  attachmentLimit,
}: CommentFormProps) {
  const editor = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = editor.current;
    if (element && draft.content !== '') {
      element.innerHTML = renderMarkdown(draft.content);
    }
    element?.focus();
  }, []);

  const handleInput = () => {
    if (!editor.current) return;
    onChange({ content: serializeMarkdown(editor.current) });
  };

  const handlePaste = (event: ClipboardEvent) => {
    const element = editor.current;
    if (!element) return;
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (!text) return;
    const budget = CONTENT_LIMIT - serializeMarkdown(element).length;
    if (budget <= 0) return;
    const inserted = insertPlainText(element, budget < text.length ? text.slice(0, budget) : text);
    if (!inserted) {
      handleInput();
      return;
    }
    let excess = serializeMarkdown(element).length - CONTENT_LIMIT;
    while (excess > 0 && inserted.nodeValue) {
      const cut = Math.min(excess, inserted.nodeValue.length);
      inserted.nodeValue = inserted.nodeValue.slice(0, inserted.nodeValue.length - cut);
      excess -= cut;
    }
    handleInput();
  };

  const handleBeforeInput = (event: Event) => {
    const inputType = (event as InputEvent).inputType;
    if (inputType !== 'insertText' || !editor.current) return;
    if (shouldBlockInsert(serializeMarkdown(editor.current).length)) {
      event.preventDefault();
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onCancel();
    } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      if (!pending && draft.content.trim()) {
        event.preventDefault();
        onSubmit();
      }
    }
  };

  const placeholder = __(COMPOSER_PLACEHOLDER, 'vifee-visual-feedback');

  return (
    <form
      class="vifee-comment-form"
      aria-label={__( 'New comment', 'vifee-visual-feedback' )}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      onKeyDown={handleKeyDown}
    >
      <div class="vifee-comment-form__header">
        <div class="vifee-comment-form__title">
          <Icon name="message-circle" size={16} />
          <span>{__( 'Add comment', 'vifee-visual-feedback' )}</span>
        </div>
        <IconButton label={__( 'Close', 'vifee-visual-feedback' )} icon="x" onClick={onCancel} />
      </div>

      <ComposerToolbar editor={editor} onEdit={handleInput} />

      <div
        ref={editor}
        class="vifee-composer"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        data-placeholder={placeholder}
        onInput={handleInput}
        onPaste={handlePaste}
        onBeforeInput={handleBeforeInput}
      />

      {(screenshotEnabled || regionScreenshotEnabled || imageUploadEnabled) && (
        <AttachmentComposer
          gateway={gateway}
          attachments={draft.attachments}
          maximum={attachmentLimit}
          regionEnabled={regionScreenshotEnabled}
          uploadEnabled={imageUploadEnabled}
          onChange={(attachments) => onChange({ attachments })}
        />
      )}

      <div class="vifee-comment-form__footer">
        <label>
          <span>{__( 'Priority:', 'vifee-visual-feedback' )}</span>
          <select
            value={draft.priority}
            onChange={(event) =>
              onChange({ priority: event.currentTarget.value as FeedbackPriority })
            }
          >
            <option value="low">{__( 'Low', 'vifee-visual-feedback' )}</option>
            <option value="normal">{__( 'Normal', 'vifee-visual-feedback' )}</option>
            <option value="high">{__( 'High', 'vifee-visual-feedback' )}</option>
            <option value="urgent">{__( 'Urgent', 'vifee-visual-feedback' )}</option>
          </select>
        </label>

        <label>
          <span>{__( 'Issue type:', 'vifee-visual-feedback' )}</span>
          <select
            value={draft.issueType}
            onChange={(event) =>
              onChange({ issueType: event.currentTarget.value as FeedbackIssueType })
            }
          >
            <option value="bug">{__( 'Bug', 'vifee-visual-feedback' )}</option>
            <option value="task">{__( 'Task', 'vifee-visual-feedback' )}</option>
            <option value="question">{__( 'Question', 'vifee-visual-feedback' )}</option>
            <option value="idea">{__( 'Idea', 'vifee-visual-feedback' )}</option>
          </select>
        </label>
      </div>

      <div class="vifee-form-hint">
        <span>{__( 'Press', 'vifee-visual-feedback' )} <kbd>Ctrl</kbd> + <kbd>Enter</kbd> {__( 'to save quickly', 'vifee-visual-feedback' )}</span>
        <button
          class="vifee-button vifee-button--primary"
          type="submit"
          disabled={pending || !draft.content.trim()}
        >
          {pending ? __( 'Adding…', 'vifee-visual-feedback' ) : __( 'Add comment', 'vifee-visual-feedback' )}
        </button>
      </div>

      {error && (
        <p class="vifee-form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
