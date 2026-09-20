import type {
  Bootstrap,
  CreateFeedbackInput,
  Feedback,
  FeedbackChanges,
  FeedbackPage,
  FeedbackQuery,
  CreateReplyInput,
  Reply,
  Attachment,
  ReviewActivationInput,
  ReviewActivationResult,
} from './types';

export type GatewayErrorKind =
  | 'validation'
  | 'auth'
  | 'forbidden'
  | 'conflict'
  | 'rate-limit'
  | 'network';

export class GatewayError extends Error {
  constructor(
    public readonly kind: GatewayErrorKind,
    message: string,
    public readonly status?: number,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

export interface FeedbackGateway {
  activateReview?(token: string, input: ReviewActivationInput): Promise<ReviewActivationResult>;
  bootstrap(): Promise<Bootstrap>;
  list(query: FeedbackQuery, options?: { signal?: AbortSignal }): Promise<FeedbackPage>;
  create(input: CreateFeedbackInput, idempotencyKey: string): Promise<Feedback>;
  update(uuid: string, version: number, changes: FeedbackChanges): Promise<Feedback>;
  remove(uuid: string): Promise<void>;
  listReplies(feedbackUuid: string): Promise<Reply[]>;
  createReply(feedbackUuid: string, input: CreateReplyInput, idempotencyKey: string): Promise<Reply>;
  uploadTemporaryAttachment(blob: Blob, source?: AttachmentSource): Promise<Attachment>;
  deleteTemporaryAttachment(uuid: string): Promise<void>;
  downloadAttachment(uuid: string): Promise<Blob>;
}

export type AttachmentSource = 'viewport' | 'region' | 'file';
