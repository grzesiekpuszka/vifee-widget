import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { __, sprintf } from '@vifee/i18n';
import type { Feedback, FeedbackIssueType, FeedbackPriority, FeedbackStatus } from '../../core/types';
import type { FeedbackGateway } from '../../core/gateway';
import { workflowIssueTypes, workflowPriorities, workflowStatuses } from '../../core/workflow';
import { IconButton } from '../../ui/icon-button';
import { useFocusTrap } from '../../ui/use-focus-trap';
import { initials } from '../comments/discussion-meta';
import { FeedbackCard } from './feedback-card';
import { selectFilteredFeedback, selectOtherPageGroups, type SidebarFilters } from './filters';

interface SidebarProps {
  open: boolean;
  currentPageKey: string;
  currentPageNumbers: ReadonlyMap<string, number>;
  currentFeedback: Feedback[];
  allFeedback: Feedback[];
  loadingOther: boolean;
  gateway: FeedbackGateway;
  actorName: string;
  initialExpandedUuid?: string | null;
  onAdd(): void;
  onLocate(uuid: string): void;
  onNavigate(url: string, uuid: string): void;
  onClose(): void;
  onUpdated(feedback: Feedback): void;
  onRemoved(uuid: string): void;
}

const defaultFilters: SidebarFilters = { statuses: [], priorities: [], issueTypes: [], sort: 'newest' };

export function Sidebar({
  open,
  currentPageKey,
  currentPageNumbers,
  currentFeedback,
  allFeedback,
  loadingOther,
  gateway,
  actorName,
  initialExpandedUuid = null,
  onAdd,
  onLocate,
  onNavigate,
  onClose,
  onUpdated,
  onRemoved,
}: SidebarProps) {
  const [scope, setScope] = useState<'current-page' | 'other-pages'>('current-page');
  const [filters, setFilters] = useState(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedUuid, setExpandedUuid] = useState<string | null>(initialExpandedUuid);

  useEffect(() => {
    if (initialExpandedUuid) setExpandedUuid(initialExpandedUuid);
  }, [initialExpandedUuid]);

  useEffect(() => {
    if (!open) setFiltersOpen(false);
  }, [open]);

  const otherGroups = useMemo(
    () => selectOtherPageGroups(allFeedback, currentPageKey),
    [allFeedback, currentPageKey]
  );
  const otherCount = [...otherGroups.values()].reduce((sum, items) => sum + items.length, 0);
  const visibleCurrent = selectFilteredFeedback(currentFeedback, filters);
  const visibleOtherGroups = new Map(
    [...otherGroups.entries()]
      .map(([url, items]) => [url, selectFilteredFeedback(items, filters)] as const)
      .filter(([, items]) => items.length > 0),
  );
  const visibleOtherCount = [...visibleOtherGroups.values()].reduce((sum, items) => sum + items.length, 0);
  const activeFilterCount = filters.statuses.length + filters.priorities.length + filters.issueTypes.length;
  const hasActiveFilters = activeFilterCount > 0 || filters.sort !== 'newest';
  const clearFilters = () => setFilters(defaultFilters);
  const trapRef = useFocusTrap<HTMLElement>(onClose);
  const panelRef = useRef<HTMLElement | null>(null);
  const setPanelRef = useCallback((node: HTMLElement | null) => {
    panelRef.current = node;
    trapRef(open ? node : null);
  }, [open, trapRef]);

  useEffect(() => {
    if (!open || !initialExpandedUuid || expandedUuid !== initialExpandedUuid) return;
    const frame = requestAnimationFrame(() => {
      const card = [...(panelRef.current?.querySelectorAll<HTMLElement>('[data-feedback-uuid]') ?? [])]
        .find((item) => item.dataset.feedbackUuid === expandedUuid);
      card?.scrollIntoView({ block: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [expandedUuid, initialExpandedUuid, open]);

  return (
    <aside ref={setPanelRef} hidden={!open} class="vifee-sidebar" role="dialog" aria-modal="true" tabIndex={-1} aria-label={__( 'vifee comments', 'vifee-visual-feedback' )}>
      <header class="vifee-sidebar__header">
        <div class="vifee-sidebar__brand">
          <span class="vifee-sidebar__brand-dot" aria-hidden="true" />
          <span>{__( 'Comments', 'vifee-visual-feedback' )}</span>
          <span class="vifee-sidebar__count">{currentFeedback.length + otherCount}</span>
        </div>
        <IconButton label={__( 'Close comments', 'vifee-visual-feedback' )} icon="x" onClick={onClose} />
      </header>

      <div class="vifee-sidebar__scope" role="group" aria-label={__( 'Comment scope', 'vifee-visual-feedback' )}>
        <button
          type="button"
          aria-pressed={scope === 'current-page'}
          onClick={() => setScope('current-page')}
        >
          {sprintf( __( 'This page (%d)', 'vifee-visual-feedback' ), currentFeedback.length )}
        </button>
        <button
          type="button"
          aria-pressed={scope === 'other-pages'}
          onClick={() => setScope('other-pages')}
        >
          {sprintf( __( 'Other pages (%d)', 'vifee-visual-feedback' ), otherCount )}
        </button>
      </div>

      <div class="vifee-sidebar__filter-bar">
        <button
          type="button"
          class="vifee-sidebar__filter-toggle"
          aria-expanded={filtersOpen}
          aria-controls="vifee-sidebar-filters"
          onClick={() => setFiltersOpen((value) => !value)}
        >
          <span>{__( 'Filters', 'vifee-visual-feedback' )}</span>
          {activeFilterCount > 0 && <span class="vifee-sidebar__filter-count">{activeFilterCount}</span>}
        </button>
        {hasActiveFilters && <button
          type="button"
          class="vifee-sidebar__clear-filters"
          onClick={clearFilters}
        >
          {__( 'Clear filters', 'vifee-visual-feedback' )}
        </button>}
      </div>

      {filtersOpen && <div id="vifee-sidebar-filters" class="vifee-sidebar__filters">
        <FilterSelect<FeedbackStatus>
          label={__( 'Status', 'vifee-visual-feedback' )}
          value={filters.statuses[0] ?? ''}
          options={workflowStatuses().map((option) => option.key)}
          onChange={(value) => setFilters({ ...filters, statuses: value ? [value] : [] })}
        />
        <FilterSelect<FeedbackPriority>
          label={__( 'Priority', 'vifee-visual-feedback' )}
          value={filters.priorities[0] ?? ''}
          options={[...workflowPriorities()].reverse().map((option) => option.key)}
          onChange={(value) => setFilters({ ...filters, priorities: value ? [value] : [] })}
        />
        <FilterSelect<FeedbackIssueType>
          label={__( 'Issue type', 'vifee-visual-feedback' )}
          value={filters.issueTypes[0] ?? ''}
          options={workflowIssueTypes().map((option) => option.key)}
          onChange={(value) => setFilters({ ...filters, issueTypes: value ? [value] : [] })}
        />
        <label>
          <span>{__( 'Sort by', 'vifee-visual-feedback' )}</span>
          <select
            aria-label={__( 'Sort by', 'vifee-visual-feedback' )}
            value={filters.sort}
            onChange={(event) =>
              setFilters({ ...filters, sort: event.currentTarget.value as SidebarFilters['sort'] })
            }
          >
            <option value="newest">{__( 'Newest', 'vifee-visual-feedback' )}</option>
            <option value="oldest">{__( 'Oldest', 'vifee-visual-feedback' )}</option>
            <option value="priority_high">{__( 'Priority: highest', 'vifee-visual-feedback' )}</option>
            <option value="priority_low">{__( 'Priority: lowest', 'vifee-visual-feedback' )}</option>
          </select>
        </label>
      </div>}

      <div class="vifee-sidebar__content">
        {scope === 'current-page' &&
          (visibleCurrent.length > 0 ? (
            visibleCurrent.map((item) => (
              <FeedbackCard
                key={item.uuid}
                number={currentPageNumbers.get(item.uuid)}
                feedback={item}
                gateway={gateway}
                expanded={expandedUuid === item.uuid}
                onToggle={() => setExpandedUuid(expandedUuid === item.uuid ? null : item.uuid)}
                onShowPin={() => onLocate(item.uuid)}
                onUpdated={onUpdated}
                onRemoved={() => {
                  onRemoved(item.uuid);
                  setExpandedUuid(null);
                }}
              />
            ))
          ) : (
            activeFilterCount > 0 ? (
              <EmptyFilters />
            ) : (
              <p class="vifee-sidebar__empty">{__( 'No comments on this page.', 'vifee-visual-feedback' )}</p>
            )
          ))}
        {scope === 'other-pages' &&
          (loadingOther ? (
            <p class="vifee-sidebar__empty">{__( 'Loading comments…', 'vifee-visual-feedback' )}</p>
          ) : (
            visibleOtherCount > 0 ? [...visibleOtherGroups.entries()].map(([url, items]) => (
              <section class="vifee-sidebar__page-group" key={url}>
                <h3>{url}</h3>
                {items.map((item) => (
                  <FeedbackCard
                    key={item.uuid}
                    feedback={item}
                    gateway={gateway}
                    otherPage
                    expanded={expandedUuid === item.uuid}
                    onToggle={() => setExpandedUuid(expandedUuid === item.uuid ? null : item.uuid)}
                    onShowPin={() => onNavigate(url, item.uuid)}
                    onUpdated={onUpdated}
                    onRemoved={() => {
                      onRemoved(item.uuid);
                      setExpandedUuid(null);
                    }}
                  />
                ))}
              </section>
            )) : activeFilterCount > 0 ? (
              <EmptyFilters />
            ) : (
              <p class="vifee-sidebar__empty">{__( 'No comments on other pages.', 'vifee-visual-feedback' )}</p>
            )
          ))}
      </div>

      <footer class="vifee-sidebar__footer">
        <span class="vifee-sidebar__user">
          <span class="vifee-avatar vifee-avatar--sm" aria-hidden="true">{initials(actorName)}</span>
          <span class="vifee-sidebar__user-name">{actorName}</span>
        </span>
        <button type="button" class="vifee-sidebar__add" onClick={onAdd}>
          <span class="vifee-sidebar__add-symbol" aria-hidden="true">+</span>
          <span>{__( 'Add comment', 'vifee-visual-feedback' )}</span>
        </button>
      </footer>
    </aside>
  );
}

function EmptyFilters() {
  return (
    <div class="vifee-sidebar__empty">
      <p>{__( 'No comments match these filters.', 'vifee-visual-feedback' )}</p>
    </div>
  );
}

interface FilterSelectProps<T extends string> {
  label: string;
  value: T | '';
  options: T[];
  onChange(value: T | ''): void;
}

/**
 * The sidebar filters used to carry their own label map, which is how the
 * dropdown ended up saying "Needs verification" while the card next to it said
 * "Needs review". Everything reads from the shared workflow registry now.
 */
function optionLabel(option: string): string {
  const status = workflowStatuses().find((candidate) => candidate.key === option);
  if (status) return status.label;
  const priority = workflowPriorities().find((candidate) => candidate.key === option);
  if (priority) return priority.label;
  return workflowIssueTypes().find((candidate) => candidate.key === option)?.label ?? option;
}

function FilterSelect<T extends string>({ label, value, options, onChange }: FilterSelectProps<T>) {
  return (
    <label>
      <span>{label}</span>
      {/* A wrapping <label> alone leaves the select's accessible name
          computed from the label's full text plus the select's own current
          option, e.g. "StatusAll" instead of "Status" — breaking exact
          name lookups and confusing screen readers. An explicit aria-label
          matches the pattern already used by StatusSelect/PrioritySelect. */}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.currentTarget.value as T | '')}>
        <option value="">{__( 'All', 'vifee-visual-feedback' )}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}
