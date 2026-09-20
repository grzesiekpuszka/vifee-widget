/**
 * Guarded Web Storage access.
 *
 * Reading `sessionStorage`/`localStorage` is not a safe expression: browsers
 * throw `SecurityError` outright when site data is blocked, and inside an
 * `<iframe sandbox>` without `allow-same-origin` even touching the property
 * throws. This widget renders on sites it does not control, so an unguarded
 * read during the first render takes the whole widget down — and because
 * `mountVifee()`'s rejection is caught by the host entry point, the visible
 * symptom is simply that nothing appears.
 *
 * The cloud adapter already learned this (see `session-token-store.ts`, which
 * wraps every call); this is the same guarantee for the host-agnostic core.
 * Every helper degrades to "no stored value" instead of throwing.
 */
export function readStorage(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(storage: () => Storage, key: string, value: string): void {
  try {
    storage().setItem(key, value);
  } catch {
    // Storage unavailable or over quota: the preference simply does not
    // persist across page loads. Never a reason to fail the interaction.
  }
}

export function removeStorage(storage: () => Storage, key: string): void {
  try {
    storage().removeItem(key);
  } catch {
    // As above.
  }
}

/**
 * Lazily resolved rather than captured once: `sessionStorage` is a getter that
 * can throw, so holding a reference at module scope would move the failure to
 * import time — before any caller could guard it.
 */
const session = (): Storage => window.sessionStorage;

export const sessionRead = (key: string): string | null => readStorage(session, key);
export const sessionWrite = (key: string, value: string): void => writeStorage(session, key, value);
export const sessionRemove = (key: string): void => removeStorage(session, key);
