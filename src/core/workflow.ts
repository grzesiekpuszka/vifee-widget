import { __ } from '@vifee/i18n';
import type { Bootstrap, FeedbackIssueType, FeedbackPriority, FeedbackStatus } from './types';

export interface WorkflowOption<TKey extends string> {
  key: TKey;
  label: string;
}

/**
 * The widget used to keep its own hardcoded label maps, so the statuses the
 * server advertised in the bootstrap payload were never read and the two could
 * drift apart — which they did. Everything now renders from the bootstrap,
 * which makes the server-side WorkflowRepository the single source of truth and
 * is what lets a paid add-on introduce custom statuses without touching the
 * widget.
 *
 * The built-in lists below are a fallback for tests and for a bootstrap that
 * predates this field; they are never preferred over what the server sent.
 */
const fallbackStatuses: Array<WorkflowOption<FeedbackStatus>> = [
  { key: 'open', label: __('To do', 'vifee-visual-feedback') },
  { key: 'in_progress', label: __('In progress', 'vifee-visual-feedback') },
  { key: 'verification', label: __('Needs review', 'vifee-visual-feedback') },
  { key: 'resolved', label: __('Done', 'vifee-visual-feedback') },
  { key: 'archived', label: __('Archived', 'vifee-visual-feedback') },
];

const fallbackPriorities: Array<WorkflowOption<FeedbackPriority>> = [
  { key: 'low', label: __('Low', 'vifee-visual-feedback') },
  { key: 'normal', label: __('Normal', 'vifee-visual-feedback') },
  { key: 'high', label: __('High', 'vifee-visual-feedback') },
  { key: 'urgent', label: __('Urgent', 'vifee-visual-feedback') },
];

const fallbackIssueTypes: Array<WorkflowOption<FeedbackIssueType>> = [
  { key: 'bug', label: __('Bug', 'vifee-visual-feedback') },
  { key: 'task', label: __('Task', 'vifee-visual-feedback') },
  { key: 'question', label: __('Question', 'vifee-visual-feedback') },
  { key: 'idea', label: __('Idea', 'vifee-visual-feedback') },
];

let statuses: Array<WorkflowOption<FeedbackStatus>> = fallbackStatuses;
let priorities: Array<WorkflowOption<FeedbackPriority>> = fallbackPriorities;
let issueTypes: Array<WorkflowOption<FeedbackIssueType>> = fallbackIssueTypes;

export function initWorkflow(bootstrap: Pick<Bootstrap, 'statuses' | 'priorities' | 'issueTypes'>): void {
  statuses = bootstrap.statuses?.length ? bootstrap.statuses : fallbackStatuses;
  priorities = bootstrap.priorities?.length ? bootstrap.priorities : fallbackPriorities;
  issueTypes = bootstrap.issueTypes?.length ? bootstrap.issueTypes : fallbackIssueTypes;
}

/** Test seam: restore the built-in lists between cases. */
export function resetWorkflow(): void {
  statuses = fallbackStatuses;
  priorities = fallbackPriorities;
  issueTypes = fallbackIssueTypes;
}

export function workflowStatuses(): ReadonlyArray<WorkflowOption<FeedbackStatus>> {
  return statuses;
}

export function workflowPriorities(): ReadonlyArray<WorkflowOption<FeedbackPriority>> {
  return priorities;
}

export function workflowIssueTypes(): ReadonlyArray<WorkflowOption<FeedbackIssueType>> {
  return issueTypes;
}

/**
 * Falls back to the raw key rather than rendering an empty label, so a status
 * introduced by an add-on the widget has not been told about is still legible.
 */
export function statusLabel(value: FeedbackStatus): string {
  return statuses.find((option) => option.key === value)?.label ?? value;
}

export function priorityLabel(value: FeedbackPriority): string {
  return priorities.find((option) => option.key === value)?.label ?? value;
}

export function issueTypeLabel(value: FeedbackIssueType | ''): string {
  return issueTypes.find((option) => option.key === value)?.label ?? value;
}
