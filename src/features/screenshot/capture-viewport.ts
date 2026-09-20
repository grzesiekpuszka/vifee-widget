import { __ } from '@vifee/i18n';
import { canvasToBlob } from '../../shared/canvas';

interface CaptureViewportOptions {
  maskSelector: string;
  excludeRoot: Element;
  signal?: AbortSignal;
}

export async function captureViewport({ maskSelector, excludeRoot, signal }: CaptureViewportOptions): Promise<Blob> {
  throwIfAborted(signal);
  const { default: html2canvas } = await import('html2canvas');
  throwIfAborted(signal);
  const canvas = await raceAbort(html2canvas(document.documentElement, {
    useCORS: false,
    allowTaint: false,
    logging: false,
    imageTimeout: 5000,
    removeContainer: true,
    scale: Math.min(window.devicePixelRatio || 1, 2),
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    ignoreElements: (element) => element === excludeRoot || excludeRoot.contains(element),
    onclone: (clonedDocument) => {
      clonedDocument.querySelectorAll<HTMLElement>(maskSelector).forEach((element) => {
        element.replaceChildren();
        element.style.background = '#d1d5db';
      });
      clonedDocument.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach((input) => {
        input.value = '';
        input.placeholder = '••••••••';
        input.style.background = '#d1d5db';
      });
    },
  }), signal);
  throwIfAborted(signal);
  const blob = await raceAbort(canvasToBlob(canvas, 'image/webp', 0.86), signal);
  if (blob?.type === 'image/webp') return blob;
  const png = await raceAbort(canvasToBlob(canvas, 'image/png'), signal);
  if (!png) throw new Error(__( 'Failed to prepare the image.', 'vifee-visual-feedback' ));
  return png;
}

function raceAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException(__( 'Capture cancelled.', 'vifee-visual-feedback' ), 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException(__( 'Capture cancelled.', 'vifee-visual-feedback' ), 'AbortError');
}
