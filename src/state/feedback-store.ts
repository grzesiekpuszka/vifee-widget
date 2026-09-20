import { __ } from '@vifee/i18n';
import type { FeedbackGateway } from '../core/gateway';
import type {
  CommentAnchor,
  Feedback,
  FeedbackIssueType,
  FeedbackPriority,
  PageIdentity,
  TechnicalMetadata,
  Attachment,
} from '../core/types';
import { createUuid } from '../core/uuid';

export interface FeedbackDraftState {
  content: string;
  priority: FeedbackPriority;
  issueType: FeedbackIssueType | '';
  metadata: TechnicalMetadata;
  attachments: Attachment[];
}

export interface FeedbackStoreState {
  page: PageIdentity | null;
  feedback: Feedback[];
  allFeedback: Feedback[];
  mode: 'idle' | 'picking' | 'composing';
  selectedAnchor: CommentAnchor | null;
  openFeedbackUuid: string | null;
  loading: boolean;
  loadingOther: boolean;
  pendingUuid: string | null;
  draft: FeedbackDraftState;
  error: string | null;
}

type Listener = () => void;

const emptyDraft = (): FeedbackDraftState => ({ content: '', priority: 'normal', issueType: 'task', metadata: {}, attachments: [] });

export class FeedbackStore {
  private state: FeedbackStoreState = {
    page: null,
    feedback: [],
    allFeedback: [],
    mode: 'idle',
    selectedAnchor: null,
    openFeedbackUuid: null,
    loading: false,
    loadingOther: false,
    pendingUuid: null,
    draft: emptyDraft(),
    error: null,
  };

  private readonly listeners = new Set<Listener>();
  private loadController: AbortController | null = null;
  // Bumped by every local mutation of `feedback` (create/replace/remove). A
  // fast create can resolve before the page's own initial GET /feedback —
  // fired on mount, well before any pin exists — so without this, that GET's
  // now-stale (pre-creation) snapshot arrives afterward and silently
  // overwrites the just-created pin back out of state. loadPage() only
  // applies its result if nothing local changed while it was in flight.
  private feedbackVersion = 0;

  constructor(private readonly gateway: FeedbackGateway) {}

  snapshot = (): FeedbackStoreState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async loadPage(page: PageIdentity): Promise<void> {
    this.loadController?.abort();
    const controller = new AbortController();
    this.loadController = controller;
    this.setState({ page, loading: true, error: null, openFeedbackUuid: null });

    const versionAtStart = this.feedbackVersion;
    try {
      const result = await this.gateway.list({ pageKey: page.pageKey }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (this.feedbackVersion !== versionAtStart) {
        this.setState({ loading: false });
        return;
      }
      this.setState({ feedback: result.items, loading: false });
    } catch (error) {
      if (controller.signal.aborted) return;
      this.setState({ loading: false, error: error instanceof Error ? error.message : __( 'Failed to load comments.', 'vifee-visual-feedback' ) });
    }
  }

  async loadOtherPages(): Promise<void> {
    if (this.state.loadingOther) return;
    this.setState({ loadingOther: true });
    try {
      const result = await this.gateway.list({ perPage: 100 });
      this.setState({ allFeedback: result.items, loadingOther: false });
    } catch (error) {
      this.setState({
        loadingOther: false,
        error: error instanceof Error ? error.message : __( 'Failed to load other comments.', 'vifee-visual-feedback' ),
      });
    }
  }

  beginPick(): void {
    // Closes any open comment popover too: without this, starting a new pin
    // while one is open left the popover rendered on top of (and intercepting
    // clicks meant for) the picker overlay, since its z-index sits above it.
    this.setState({ mode: 'picking', selectedAnchor: null, openFeedbackUuid: null, error: null });
  }

  cancelPick(): void {
    this.setState({ mode: 'idle', selectedAnchor: null });
  }

  selectAnchor(anchor: CommentAnchor): void {
    this.setState({ mode: 'composing', selectedAnchor: anchor, openFeedbackUuid: null, error: null });
  }

  setDraft(changes: Partial<FeedbackDraftState>): void {
    this.setState({ draft: { ...this.state.draft, ...changes }, error: null });
  }

  async createFeedback(): Promise<Feedback | null> {
    const { page, selectedAnchor, draft } = this.state;
    if (!page || !selectedAnchor || !draft.content.trim() || this.state.pendingUuid) return null;

    const pendingUuid = `pending:${createUuid()}`;
    const now = new Date().toISOString();
    const optimistic: Feedback = {
      uuid: pendingUuid,
      page,
      anchor: selectedAnchor,
      content: draft.content.trim(),
      status: 'open',
      priority: draft.priority,
      issueType: draft.issueType,
      author: { identity: 'pending' },
      metadata: draft.metadata,
      recordVersion: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.feedbackVersion += 1;
    this.setState({ feedback: [...this.state.feedback, optimistic], pendingUuid, error: null });

    try {
      const created = await this.gateway.create(
        {
          page,
          anchor: selectedAnchor,
          content: draft.content.trim(),
          priority: draft.priority,
          issueType: draft.issueType,
          attachmentUuids: draft.attachments.map((attachment) => attachment.uuid),
          metadata: draft.metadata,
        },
        createUuid(),
      );
      this.feedbackVersion += 1;
      this.setState({
        feedback: this.state.feedback.map((item) => (item.uuid === pendingUuid ? created : item)),
        pendingUuid: null,
        selectedAnchor: null,
        mode: 'idle',
        draft: emptyDraft(),
        openFeedbackUuid: created.uuid,
      });
      // The draft's attachments were only ever local blob: URLs for preview
      // (see WordPressGateway.uploadTemporaryAttachment); the submitted
      // feedback now carries the server's own attachment URLs instead, so
      // these are no longer referenced anywhere and must be released.
      draft.attachments.forEach((attachment) => URL.revokeObjectURL(attachment.downloadUrl));
      return created;
    } catch (error) {
      this.feedbackVersion += 1;
      this.setState({
        feedback: this.state.feedback.filter((item) => item.uuid !== pendingUuid),
        pendingUuid: null,
        error: error instanceof Error ? error.message : __( 'Failed to add the comment.', 'vifee-visual-feedback' ),
      });
      return null;
    }
  }

  openFeedback(uuid: string): void {
    this.setState({ openFeedbackUuid: uuid });
  }

  closeFeedback(): void {
    this.setState({ openFeedbackUuid: null });
  }

  replaceFeedback(feedback: Feedback): void {
    this.feedbackVersion += 1;
    this.setState({
      feedback: this.state.feedback.map((item) => item.uuid === feedback.uuid ? feedback : item),
      allFeedback: this.state.allFeedback.map((item) => item.uuid === feedback.uuid ? feedback : item),
    });
  }

  removeFeedback(uuid: string): void {
    this.feedbackVersion += 1;
    this.setState({
      feedback: this.state.feedback.filter((item) => item.uuid !== uuid),
      allFeedback: this.state.allFeedback.filter((item) => item.uuid !== uuid),
      openFeedbackUuid: this.state.openFeedbackUuid === uuid ? null : this.state.openFeedbackUuid,
    });
  }


  destroy(): void {
    this.loadController?.abort();
    this.listeners.clear();
  }

  private setState(changes: Partial<FeedbackStoreState>): void {
    this.state = { ...this.state, ...changes };
    this.listeners.forEach((listener) => listener());
  }
}
