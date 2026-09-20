import { getPageIdentity } from './page-identity';
import type { PageIdentity } from './types';

type NavigationCallback = (page: PageIdentity) => void;

const callbacks = new Set<NavigationCallback>();
let originalPushState: History['pushState'] | null = null;
let originalReplaceState: History['replaceState'] | null = null;

function notify(): void {
  const page = getPageIdentity(window.location.href);
  callbacks.forEach((callback) => callback(page));
}

function start(): void {
  if (originalPushState) return;

  originalPushState = history.pushState;
  originalReplaceState = history.replaceState;

  history.pushState = function (...args: Parameters<History['pushState']>): void {
    originalPushState?.apply(this, args);
    notify();
  };

  history.replaceState = function (...args: Parameters<History['replaceState']>): void {
    originalReplaceState?.apply(this, args);
    notify();
  };

  window.addEventListener('popstate', notify);
}

function stop(): void {
  if (!originalPushState || !originalReplaceState) return;
  history.pushState = originalPushState;
  history.replaceState = originalReplaceState;
  originalPushState = null;
  originalReplaceState = null;
  window.removeEventListener('popstate', notify);
}

export function observeNavigation(callback: NavigationCallback): () => void {
  callbacks.add(callback);
  start();

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    callbacks.delete(callback);
    if (callbacks.size === 0) stop();
  };
}
