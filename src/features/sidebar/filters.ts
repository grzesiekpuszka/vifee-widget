import type { Feedback, FeedbackIssueType, FeedbackPriority, FeedbackStatus } from '../../core/types';

export interface SidebarFilters {
  statuses: FeedbackStatus[];
  priorities: FeedbackPriority[];
  issueTypes: FeedbackIssueType[];
  sort: 'newest' | 'oldest' | 'priority_high' | 'priority_low';
}

const priorityWeight: Record<FeedbackPriority, number> = { urgent: 4, high: 3, normal: 2, low: 1 };

export function selectCurrentPageFeedback(feedback: Feedback[], pageKey: string): Feedback[] {
  return feedback.filter((item) => item.page.pageKey === pageKey);
}

export function selectOtherPageGroups(feedback: Feedback[], pageKey: string): Map<string, Feedback[]> {
  const groups = new Map<string, Feedback[]>();
  feedback
    .filter((item) => item.page.pageKey !== pageKey)
    .forEach((item) => groups.set(item.page.canonicalUrl, [...(groups.get(item.page.canonicalUrl) ?? []), item]));
  return groups;
}

export function selectFilteredFeedback(feedback: Feedback[], filters: SidebarFilters): Feedback[] {
  const selected = feedback.filter((item) => {
    if (filters.statuses.length > 0 && !filters.statuses.includes(item.status)) return false;
    if (filters.priorities.length > 0 && !filters.priorities.includes(item.priority)) return false;
    if (filters.issueTypes.length > 0 && !(filters.issueTypes as string[]).includes(item.issueType)) return false;
    return true;
  });

  return selected.sort((left, right) => {
    if (filters.sort === 'oldest') return Date.parse(left.createdAt) - Date.parse(right.createdAt);
    if (filters.sort === 'priority_high') return priorityWeight[right.priority] - priorityWeight[left.priority];
    if (filters.sort === 'priority_low') return priorityWeight[left.priority] - priorityWeight[right.priority];
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
}
