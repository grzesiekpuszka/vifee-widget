import { __ } from '@vifee/i18n';
import type { FeedbackIssueType, FeedbackPriority, FeedbackStatus } from '../../core/types';
import { issueTypeLabel, priorityLabel, statusLabel, workflowIssueTypes, workflowPriorities, workflowStatuses } from '../../core/workflow';

export function StatusSelect({ value, disabled, onChange }: { value: FeedbackStatus; disabled?: boolean; onChange(value: FeedbackStatus): void }) {
  return (
    <label class="vifee-workflow-select">
      <span class="screen-reader-text">{__( 'Status', 'vifee-visual-feedback' )}</span>
      <select
        aria-label={__( 'Status', 'vifee-visual-feedback' )}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value as FeedbackStatus)}
      >
        {workflowStatuses().map((option) => (
          <option key={option.key} value={option.key}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export function PrioritySelect({ value, disabled, onChange }: { value: FeedbackPriority; disabled?: boolean; onChange(value: FeedbackPriority): void }) {
  return (
    <label class="vifee-workflow-select">
      <span class="screen-reader-text">{__( 'Priority', 'vifee-visual-feedback' )}</span>
      <select
        aria-label={__( 'Priority', 'vifee-visual-feedback' )}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value as FeedbackPriority)}
      >
        {workflowPriorities().map((option) => (
          <option key={option.key} value={option.key}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export function IssueTypeSelect({ value, disabled, onChange }: { value: FeedbackIssueType | ''; disabled?: boolean; onChange(value: FeedbackIssueType | ''): void }) {
  return (
    <label class="vifee-workflow-select">
      <span class="screen-reader-text">{__( 'Issue type', 'vifee-visual-feedback' )}</span>
      <select
        aria-label={__( 'Issue type', 'vifee-visual-feedback' )}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value as FeedbackIssueType | '')}
      >
        {workflowIssueTypes().map((option) => (
          <option key={option.key} value={option.key}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export { issueTypeLabel, priorityLabel, statusLabel };
