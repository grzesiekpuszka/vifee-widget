import { __, sprintf } from '@vifee/i18n';

export function relativeTime(value: string): string {
  const seconds = Math.max(1, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 60) return __( 'now', 'vifee-visual-feedback' );
  if (seconds < 3600) return sprintf( __( '%d min', 'vifee-visual-feedback' ), Math.floor(seconds / 60) );
  if (seconds < 86400) return sprintf( __( '%d hr', 'vifee-visual-feedback' ), Math.floor(seconds / 3600) );
  return sprintf( __( '%d d', 'vifee-visual-feedback' ), Math.floor(seconds / 86400) );
}

/**
 * Display names are optional on feedback authors (`author.displayName?`), and
 * a missing one used to throw on `.trim()`, taking the whole sidebar down with
 * it. An avatar is decoration; it must never be able to break the page.
 */
export function initials(value: string | null | undefined): string {
  const name = (value ?? '').trim();
  if (name === '') return '?';
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts.slice(0, 2).map((part) => part[0]).join('') : name.slice(0, 2)).toUpperCase();
}
