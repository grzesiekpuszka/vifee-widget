import type { PageIdentity } from './types';

// vifee_feedback/_wpnonce are appended by the admin's "Open pin on the page"
// link to identify which pin to open; they are never part of the page's own
// identity, so a manager clicking that link must still land on the same
// pageKey the pin was created under, or the widget looks up an empty page.
const ignoredParameters = new Set(['gclid', 'fbclid', 'msclkid', 'vifee_token', 'vifee_feedback', '_wpnonce']);

export function getPageIdentity(input: string): PageIdentity {
  const url = new URL(input, window.location.href);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TypeError('Page URL must be HTTP or HTTPS.');
  }

  const path = (url.pathname || '/').replace(/\/{2,}/g, '/');
  const entries = url.search
    .slice(1)
    .split('&')
    .filter(Boolean)
    .map((pair, position) => {
      const encodedKey = pair.split('=', 1)[0];
      let key: string;
      try {
        key = decodeURIComponent(encodedKey);
      } catch {
        key = encodedKey;
      }
      return { pair, position, key };
    })
    .filter(({ key }) => {
      const normalized = key.toLowerCase();
      return !normalized.startsWith('utm_') && !ignoredParameters.has(normalized);
    })
    .sort((left, right) => left.key.localeCompare(right.key) || left.position - right.position);

  const port = url.port ? `:${url.port}` : '';
  const query = entries.length > 0 ? `?${entries.map(({ pair }) => pair).join('&')}` : '';
  const host = `${url.hostname.toLowerCase()}${port}${path}${query}`;
  const canonicalUrl = `${url.protocol}//${host}`;

  // Scheme-less: a page reached over http and https must resolve to the same
  // thread — matches the server's PageIdentity::key(), which drops the scheme
  // for the same reason. canonicalUrl keeps the real scheme for display/nav.
  return { canonicalUrl, pageKey: host };
}
