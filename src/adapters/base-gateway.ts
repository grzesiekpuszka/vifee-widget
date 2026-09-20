import { __ } from '@vifee/i18n';
import { GatewayError, type AttachmentSource, type FeedbackGateway, type GatewayErrorKind } from '../core/gateway';
import type {
  Attachment,
  Bootstrap,
  CreateFeedbackInput,
  CreateReplyInput,
  Feedback,
  FeedbackChanges,
  FeedbackPage,
  FeedbackQuery,
  Reply,
  ReviewActivationInput,
  ReviewActivationResult,
} from '../core/types';

export interface Envelope<T> {
  data: T;
  meta?: { total?: number };
  error?: { code?: string; message?: string; fields?: Record<string, string> } | null;
}

export abstract class BaseGateway implements FeedbackGateway {
  protected readonly fetcher: typeof globalThis.fetch;

  protected constructor(fetchImpl?: typeof globalThis.fetch) {
    this.fetcher = fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  protected abstract readonly credentialsMode: RequestCredentials;
  protected abstract buildUrl(path: string): string;
  protected abstract applyAuthHeaders(headers: Headers, method: string): void;

  abstract activateReview(token: string, input: ReviewActivationInput): Promise<ReviewActivationResult>;

  bootstrap(): Promise<Bootstrap> {
    return this.request<Bootstrap>('/bootstrap');
  }

  async list(query: FeedbackQuery, options: { signal?: AbortSignal } = {}): Promise<FeedbackPage> {
    const parameters = new URLSearchParams();
    if (query.pageKey) parameters.set('pageKey', query.pageKey);
    query.status?.forEach((status) => parameters.append('status[]', status));
    query.priority?.forEach((priority) => parameters.append('priority[]', priority));
    query.issueType?.forEach((issueType) => parameters.append('issueType[]', issueType));
    if (query.sort) parameters.set('sort', query.sort);
    if (query.page) parameters.set('page', String(query.page));
    if (query.perPage) parameters.set('perPage', String(query.perPage));

    const suffix = parameters.size > 0 ? `?${parameters.toString()}` : '';
    const envelope = await this.requestEnvelope<Feedback[]>(`/feedback${suffix}`, { signal: options.signal });
    return { items: envelope.data, total: envelope.meta?.total };
  }

  create(input: CreateFeedbackInput, idempotencyKey: string): Promise<Feedback> {
    return this.request<Feedback>('/feedback', {
      method: 'POST',
      body: JSON.stringify(input),
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  update(uuid: string, version: number, changes: FeedbackChanges): Promise<Feedback> {
    return this.request<Feedback>(`/feedback/${encodeURIComponent(uuid)}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
      headers: { 'If-Match': String(version) },
    });
  }

  async remove(uuid: string): Promise<void> {
    await this.request<null>(`/feedback/${encodeURIComponent(uuid)}`, { method: 'DELETE' });
  }

  listReplies(feedbackUuid: string): Promise<Reply[]> {
    return this.request<Reply[]>(`/feedback/${encodeURIComponent(feedbackUuid)}/replies`);
  }

  createReply(feedbackUuid: string, input: CreateReplyInput, idempotencyKey: string): Promise<Reply> {
    return this.request<Reply>(`/feedback/${encodeURIComponent(feedbackUuid)}/replies`, {
      method: 'POST',
      body: JSON.stringify(input),
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  uploadTemporaryAttachment(blob: Blob, source: AttachmentSource = 'viewport'): Promise<Attachment> {
    return this.request<Attachment>('/attachments', {
      method: 'POST',
      body: blob,
      headers: {
        'Content-Type': blob.type,
        'X-Vifee-Filename': blob.type === 'image/webp' ? 'screenshot.webp' : 'screenshot.png',
        // The server gates region crops and file uploads by source; sending it
        // is what lets it tell a free viewport screenshot from a paid one.
        'X-Vifee-Source': source,
      },
    }).then((attachment) => ({ ...attachment, downloadUrl: URL.createObjectURL(blob) }));
  }

  async deleteTemporaryAttachment(uuid: string): Promise<void> {
    await this.request<null>('/attachments/' + encodeURIComponent(uuid), { method: 'DELETE' });
  }

  async downloadAttachment(uuid: string): Promise<Blob> {
    // The server streams this endpoint as raw bytes (see AttachmentController::download()),
    // not a JSON envelope, so this bypasses requestEnvelope()'s response.json() parsing and
    // reads the response body directly as a Blob.
    const headers = new Headers();
    this.applyAuthHeaders(headers, 'GET');

    let response: Response;
    try {
      response = await this.fetcher(this.buildUrl(`/attachments/${encodeURIComponent(uuid)}/content`), {
        headers,
        credentials: this.credentialsMode,
      });
    } catch {
      throw new GatewayError('network', __('Network request failed.', 'vifee-visual-feedback'));
    }

    if (!response.ok) {
      throw new GatewayError(
        this.errorKind(response.status),
        __('Failed to load the image.', 'vifee-visual-feedback'),
        response.status,
      );
    }

    return response.blob();
  }

  protected async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    return (await this.requestEnvelope<T>(path, init)).data;
  }

  protected async requestEnvelope<T>(path: string, init: RequestInit = {}): Promise<Envelope<T>> {
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body && typeof init.body === 'string') headers.set('Content-Type', 'application/json');
    this.applyAuthHeaders(headers, method);

    let response: Response;
    try {
      response = await this.fetcher(this.buildUrl(path), {
        ...init,
        method,
        headers,
        credentials: this.credentialsMode,
      });
    } catch {
      throw new GatewayError('network', __('Network request failed.', 'vifee-visual-feedback'));
    }

    let envelope: Envelope<T>;
    try {
      envelope = (await response.json()) as Envelope<T>;
    } catch {
      throw new GatewayError(
        'network',
        __('The server returned an invalid response.', 'vifee-visual-feedback'),
        response.status,
      );
    }

    if (!response.ok || envelope.error) {
      throw new GatewayError(
        this.errorKind(response.status),
        envelope.error?.message ?? __('The request could not be completed.', 'vifee-visual-feedback'),
        response.status,
        envelope.error?.fields,
      );
    }

    return envelope;
  }

  protected errorKind(status: number): GatewayErrorKind {
    if (status === 400 || status === 422) return 'validation';
    if (status === 401) return 'auth';
    if (status === 403) return 'forbidden';
    if (status === 409) return 'conflict';
    if (status === 429) return 'rate-limit';
    return 'network';
  }
}
