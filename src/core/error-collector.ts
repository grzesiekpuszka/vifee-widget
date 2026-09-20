export interface CapturedError {
  message: string;
  source?: string;
  line?: number;
}

const MAX_ERRORS = 10;
const MAX_MESSAGE = 300;
const MAX_SOURCE = 300;

/**
 * Every competing tool captures JavaScript errors, and the reason is simple:
 * "the page is broken" plus the actual error is a bug report, while "the page
 * is broken" on its own is the start of a conversation.
 *
 * Deliberately small. A ring buffer of the last few errors, message and origin
 * only — no stack traces, no full console history, no network log. Those cost
 * bundle weight and storage, and they carry more of the page's internals than
 * a free tier needs to.
 */
const buffer: CapturedError[] = [];
let installed = false;
let detach: (() => void) | null = null;

function truncate(value: string, max: number): string {
  const text = String(value ?? '').trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function record(entry: CapturedError): void {
  if (entry.message === '') return;
  // Repeats are common — a broken handler on a scroll listener fires hundreds
  // of times — and a buffer full of one identical line is worthless.
  const last = buffer[buffer.length - 1];
  if (last && last.message === entry.message && last.line === entry.line) return;
  buffer.push(entry);
  if (buffer.length > MAX_ERRORS) buffer.shift();
}

function onError(event: ErrorEvent): void {
  record({
    message: truncate(event.message, MAX_MESSAGE),
    source: event.filename ? truncate(event.filename, MAX_SOURCE) : undefined,
    line: typeof event.lineno === 'number' && event.lineno > 0 ? event.lineno : undefined,
  });
}

function onRejection(event: PromiseRejectionEvent): void {
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : String(reason);
  record({ message: truncate(`Unhandled promise rejection: ${message}`, MAX_MESSAGE) });
}

/**
 * Listeners are added, never replaced: assigning `window.onerror` would take
 * over a slot the page may already be using for its own error reporting.
 */
export function installErrorCollector(target: Window = window): void {
  if (installed) return;
  installed = true;
  target.addEventListener('error', onError as EventListener);
  target.addEventListener('unhandledrejection', onRejection as EventListener);
  detach = () => {
    target.removeEventListener('error', onError as EventListener);
    target.removeEventListener('unhandledrejection', onRejection as EventListener);
  };
}

export function uninstallErrorCollector(): void {
  detach?.();
  detach = null;
  installed = false;
  buffer.length = 0;
}

export function capturedErrors(): CapturedError[] {
  return buffer.slice();
}
