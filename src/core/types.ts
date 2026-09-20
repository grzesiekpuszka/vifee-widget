export type FeedbackStatus = 'open' | 'in_progress' | 'verification' | 'resolved' | 'archived';
export type FeedbackPriority = 'low' | 'normal' | 'high' | 'urgent';
export type FeedbackIssueType = 'bug' | 'task' | 'question' | 'idea';
export interface Actor { identity: string; displayName: string; isManager: boolean; }
export interface ReviewActivationResult { actor: { identity: string; displayName: string }; csrfToken: string; }
export interface ReviewActivationInput { name: string; email?: string; }
export interface Bootstrap {
  apiBase: string; restNonce?: string; csrfToken?: string; actor: Actor; capabilities: Record<string, boolean>;
  statuses: Array<{ key: FeedbackStatus; label: string }>; priorities: Array<{ key: FeedbackPriority; label: string }>;
  issueTypes: Array<{ key: FeedbackIssueType; label: string }>;
  limits: { attachmentsPerMessage: number }; locale: string;
}
export interface PageIdentity { canonicalUrl: string; pageKey: string; }
export interface CommentAnchor {
  xPct: number;
  yPct: number;
  elementSelector: string | null;
  elementXPath: string | null;
  elementXOffset: number | null;
  elementYOffset: number | null;
}
export interface CapturedErrorPayload { message: string; source?: string; line?: number; }
export interface TechnicalMetadata { browser?: string; os?: string; viewport?: string; screen?: string; scale?: string; errors?: CapturedErrorPayload[]; }
export interface Attachment { uuid: string; mimeType: 'image/webp' | 'image/png'; byteSize: number; width: number; height: number; downloadUrl: string; }
export interface Feedback {
  uuid: string; page: PageIdentity; anchor: CommentAnchor; content: string; status: FeedbackStatus; priority: FeedbackPriority;
  issueType: FeedbackIssueType | '';
  author: { identity: string; displayName?: string }; metadata: TechnicalMetadata; attachments?: Attachment[];
  replyCount?: number;
  permissions?: { canReply: boolean; canEdit: boolean; canDelete: boolean; canChangeStatus: boolean };
  recordVersion: number; createdAt: string; updatedAt: string;
}
export interface Reply {
  uuid: string; feedbackUuid: string; content: string; author: { identity: string; displayName: string };
  permissions: { canEdit: boolean; canDelete: boolean }; attachments?: Attachment[]; createdAt: string; updatedAt: string;
}
export interface CreateReplyInput { content: string; attachmentUuids?: string[]; }
export interface FeedbackQuery {
  pageKey?: string; status?: FeedbackStatus[]; priority?: FeedbackPriority[]; issueType?: FeedbackIssueType[]; sort?: 'newest' | 'oldest' | 'priority_high' | 'priority_low'; page?: number; perPage?: number;
}
export interface FeedbackPage { items: Feedback[]; total?: number; }
export interface CreateFeedbackInput { page: PageIdentity; anchor: CommentAnchor; content: string; priority: FeedbackPriority; issueType: FeedbackIssueType | ''; attachmentUuids?: string[]; metadata: TechnicalMetadata; }
export interface FeedbackChanges { content?: string; status?: FeedbackStatus; priority?: FeedbackPriority; issueType?: FeedbackIssueType | ''; }
