import {useEffect, useState} from 'preact/hooks';
import {__, sprintf} from '@vifee/i18n';
import type {FeedbackGateway} from '../../core/gateway';
import type {Feedback} from '../../core/types';
import {ActionMenu, type ActionMenuItem} from '../../ui/action-menu';
import {IconButton} from '../../ui/icon-button';
import {Icon} from '../../ui/icons';
import {relativeTime} from '../comments/discussion-meta';
import {renderMarkdown} from '../../shared/markdown/render';
import {Thread} from '../comments/thread';
import {AttachmentGallery} from '../screenshot/attachment-gallery';
import {IssueTypeSelect, issueTypeLabel, PrioritySelect, priorityLabel, StatusSelect} from '../comments/workflow-selects';

interface FeedbackCardProps {
	feedback: Feedback;
	number?: number;
	gateway: FeedbackGateway;
	expanded: boolean;
	otherPage?: boolean;

	onToggle(): void;

	onShowPin(): void;

	onUpdated(feedback: Feedback): void;

	onRemoved(): void;
}

export function FeedbackCard({
	feedback,
	number,
	gateway,
	expanded,
	otherPage = false,
	onToggle,
	onShowPin,
	onUpdated,
	onRemoved,
}: FeedbackCardProps) {
	const [replyCount, setReplyCount] = useState(feedback.replyCount ?? 0);
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(feedback.content);
	const [draftPriority, setDraftPriority] = useState(feedback.priority);
	const [draftIssueType, setDraftIssueType] = useState(feedback.issueType);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// The expanded Thread loads the exact reply list and is the source of truth
	// while open; otherwise, keep the count in sync with whatever the server
	// last reported for this feedback item.
	useEffect(() => {
		if (!expanded) setReplyCount(feedback.replyCount ?? 0);
	}, [feedback.replyCount, expanded]);

	async function update(changes: Parameters<FeedbackGateway['update']>[2]) {
		if (busy) return;
		setBusy(true);
		setError(null);
		try {
			onUpdated(await gateway.update(feedback.uuid, feedback.recordVersion, changes));
			setEditing(false);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : __( 'Failed to save the change.', 'vifee-visual-feedback' ));
		} finally {
			setBusy(false);
		}
	}

	async function remove() {
		if (busy || !window.confirm(__( 'Delete this comment?', 'vifee-visual-feedback' ))) return;
		setBusy(true);
		try {
			await gateway.remove(feedback.uuid);
			onRemoved();
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : __( 'Failed to delete the comment.', 'vifee-visual-feedback' ));
			setBusy(false);
		}
	}

	const actions: ActionMenuItem[] = [
		...(feedback.permissions?.canEdit
			? [{label: __( 'Edit comment', 'vifee-visual-feedback' ), onSelect: () => {
				setDraft(feedback.content);
				setDraftPriority(feedback.priority);
				setDraftIssueType(feedback.issueType);
				setEditing(true);
			}}]
			: []),
		...(feedback.permissions?.canDelete
			? [{label: __( 'Delete', 'vifee-visual-feedback' ), tone: 'danger' as const, onSelect: () => void remove()}]
			: []),
	];

	const author = feedback.author.displayName ?? feedback.author.identity;

	// Clicking anywhere on the summary activates the card (expands its thread),
	// same as clicking the reply count, EXCEPT when the click originated from
	// an interactive control (button, select, link, form field, or the action
	// menu) — those keep handling their own click and must not also toggle
	// the card out from under the user.
	const handleSummaryClick = (event: MouseEvent) => {
		const target = event.target as HTMLElement | null;
		if (target?.closest('button, select, a, textarea, input, label, [role="menu"]')) return;
		onToggle();
	};

	return (
		<article
			class={`vifee-feedback-card is-priority-${feedback.priority}${expanded ? ' is-expanded' : ''}`}
			data-feedback-uuid={feedback.uuid}
		>
			<div class="vifee-feedback-card__summary" onClick={handleSummaryClick}>
				<div class="vifee-feedback-card__heading">
					{number !== undefined && <span class="vifee-feedback-card__number">#{number}</span>}
					<div class="vifee-feedback-card__identity">
						<strong>{author}</strong>
						<span aria-hidden="true">·</span>
						<small>{relativeTime(feedback.createdAt)}</small>
					</div>
					<div class="vifee-feedback-card__actions">
						<IconButton
							label={otherPage ? __( 'Open page', 'vifee-visual-feedback' ) : __( 'Show on page', 'vifee-visual-feedback' )}
							icon="crosshair"
							onClick={onShowPin}
						/>
						<ActionMenu items={actions}/>
					</div>
				</div>

				{editing ? (
					<form
						class="vifee-feedback-card__edit"
						onSubmit={(event) => {
							event.preventDefault();
							void update({content: draft.trim(), priority: draftPriority, issueType: draftIssueType});
						}}
					>
						<textarea value={draft} onInput={(event) => setDraft(event.currentTarget.value)}/>
						<div class="vifee-feedback-card__edit-workflow">
							<PrioritySelect value={draftPriority} onChange={setDraftPriority}/>
							<IssueTypeSelect value={draftIssueType} onChange={setDraftIssueType}/>
						</div>
						<div>
							<button
								type="button"
								class="vifee-icon-button"
								aria-label={__( 'Cancel editing', 'vifee-visual-feedback' )}
								title={__( 'Cancel editing', 'vifee-visual-feedback' )}
								onClick={() => setEditing(false)}
							>
								<Icon name="x"/>
							</button>
							<button
								type="submit"
								class="vifee-icon-button"
								aria-label={__( 'Save comment', 'vifee-visual-feedback' )}
								title={__( 'Save comment', 'vifee-visual-feedback' )}
								disabled={busy || !draft.trim()}
							>
								<Icon name="check"/>
							</button>
						</div>
					</form>
				) : (
					<div class="vifee-feedback-card__content">
						<div class="vifee-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(feedback.content) }} />
					</div>
				)}

				<AttachmentGallery attachments={feedback.attachments ?? []} gateway={gateway}/>

				{otherPage && <small class="vifee-feedback-card__url">{feedback.page.canonicalUrl}</small>}

				<div class="vifee-feedback-card__tags">
					<span class={`vifee-priority-badge is-${feedback.priority}`}>
						{priorityLabel(feedback.priority)}
					</span>
					{feedback.issueType && (
						<span class={`vifee-issue-type-badge is-${feedback.issueType}`}>
							{issueTypeLabel(feedback.issueType)}
						</span>
					)}
				</div>

				<div class="vifee-feedback-card__footer">
					<StatusSelect
						value={feedback.status}
						disabled={busy || !feedback.permissions?.canChangeStatus}
						onChange={(status) => void update({status})}
					/>

					<button
						type="button"
						class="vifee-feedback-card__toggle"
						aria-label={expanded ? __( 'Collapse comment', 'vifee-visual-feedback' ) : __( 'Expand comment', 'vifee-visual-feedback' )}
						aria-expanded={expanded}
						onClick={onToggle}
					>
						<Icon name="message-circle" size={12}/>
						<span>
							{replyCount === 1
								? sprintf( __( '%d reply', 'vifee-visual-feedback' ), replyCount )
								: sprintf( __( '%d replies', 'vifee-visual-feedback' ), replyCount )}
						</span>
						<Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={12} class="vifee-arr"/>
					</button>

				</div>

				{error && (
					<p class="vifee-form-error" role="alert">
						{error}
					</p>
				)}
			</div>

			{expanded && (
				<div class="vifee-feedback-card__details">
					<Thread feedback={feedback} gateway={gateway} onReplyCountChange={setReplyCount}/>
				</div>
			)}
		</article>
	);
}
