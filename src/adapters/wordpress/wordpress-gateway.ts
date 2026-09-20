import { BaseGateway } from '../base-gateway';
import type { ReviewActivationInput, ReviewActivationResult } from '../../core/types';

export interface WordPressGatewayOptions {
  apiBase: string;
  restNonce?: string;
  csrfToken?: string;
  fetch?: typeof globalThis.fetch;
}

export class WordPressGateway extends BaseGateway {
  protected readonly credentialsMode: RequestCredentials = 'same-origin';

  constructor(private readonly options: WordPressGatewayOptions) {
    super(options.fetch);
  }

  activateReview(token: string, input: ReviewActivationInput): Promise<ReviewActivationResult> {
    return this.request<ReviewActivationResult>('/review/activate', {
      method: 'POST',
      body: JSON.stringify({ token, ...input }),
    });
  }

  protected applyAuthHeaders(headers: Headers, method: string): void {
    if (this.options.restNonce) headers.set('X-WP-Nonce', this.options.restNonce);
    if (!this.options.restNonce && method !== 'GET' && method !== 'HEAD' && this.options.csrfToken) {
      headers.set('X-Vifee-CSRF', this.options.csrfToken);
    }
  }

  // On a site using plain permalinks, apiBase (from rest_url()) already carries
  // its own query string — `https://host/?rest_route=/vifee/v1` — because the
  // whole REST path lives inside the `rest_route` value, not the URL's own
  // pathname. Naively concatenating `apiBase + path` (where path is often
  // itself `/feedback?pageKey=…`) nests a second `?` inside that value —
  // `?rest_route=/vifee/v1/feedback?pageKey=…` — which WordPress parses as a
  // literal (and non-existent) route, 404ing every request that carries query
  // parameters. Detecting and extending an existing `rest_route` value keeps
  // both permalink styles working.
  protected buildUrl(path: string): string {
    const separatorIndex = path.indexOf('?');
    const pathname = separatorIndex === -1 ? path : path.slice(0, separatorIndex);
    const query = separatorIndex === -1 ? '' : path.slice(separatorIndex + 1);

    const restRouteMatch = this.options.apiBase.match(/^(.*[?&]rest_route=)([^&]*)(.*)$/);
    let url: string;
    if (restRouteMatch) {
      url = `${restRouteMatch[1]}${restRouteMatch[2]}${pathname}${restRouteMatch[3]}`;
    } else {
      url = `${this.options.apiBase.replace(/\/$/, '')}${pathname}`;
    }
    if (query) url += (url.includes('?') ? '&' : '?') + query;
    return url;
  }
}
