import type { CommentAnchor } from '../core/types';

const stableAttributes = ['data-testid', 'data-cy', 'data-test', 'data-section', 'data-block', 'id'] as const;

export function captureAnchor(clientX: number, clientY: number): CommentAnchor {
  const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0, 1);
  const documentHeight = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0, 1);
  const absoluteX = Math.max(0, clientX + window.scrollX);
  const absoluteY = Math.max(0, clientY + window.scrollY);
  const element = document.elementFromPoint(clientX, clientY);
  const documentAnchor = {
    xPct: clampPercent((absoluteX / documentWidth) * 100),
    yPct: clampPercent((absoluteY / documentHeight) * 100),
  };
  if (!element || element === document.body || isWidgetOwned(element)) {
    return { ...documentAnchor, elementSelector: null, elementXPath: null, elementXOffset: null, elementYOffset: null };
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return { ...documentAnchor, elementSelector: null, elementXPath: null, elementXOffset: null, elementYOffset: null };
  }
  return {
    ...documentAnchor,
    elementSelector: getElementSelector(element),
    elementXPath: getElementXPath(element),
    elementXOffset: clampUnit((clientX - rect.left) / rect.width),
    elementYOffset: clampUnit((clientY - rect.top) / rect.height),
  };
}

export interface ResolvedAnchorPosition {
  element: Element | null;
  x: number;
  y: number;
  strategy: 'selector' | 'xpath' | 'document';
}

export function resolveAnchorPosition(anchor: CommentAnchor): ResolvedAnchorPosition {
  const selectorElement = querySelector(anchor.elementSelector);
  const xpathElement = selectorElement ? null : queryXPath(anchor.elementXPath);
  const element = selectorElement ?? xpathElement;
  if (element && anchor.elementXOffset !== null && anchor.elementYOffset !== null) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return {
        element,
        x: rect.left + window.scrollX + anchor.elementXOffset * rect.width,
        y: rect.top + window.scrollY + anchor.elementYOffset * rect.height,
        strategy: selectorElement ? 'selector' : 'xpath',
      };
    }
  }
  const width = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0, 1);
  const height = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0, 1);
  return { element: null, x: anchor.xPct / 100 * width, y: anchor.yPct / 100 * height, strategy: 'document' };
}

export function getElementSelector(element: Element | null): string | null {
  if (!element || isWidgetOwned(element)) return null;
  const direct = stableSegment(element);
  if (direct) return direct;
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.body) {
    const stable = stableSegment(current);
    parts.unshift(stable ?? nthSegment(current));
    const candidate = parts.join(' > ');
    if (safeQueryAll(candidate).length === 1) return candidate;
    if (stable) break;
    current = current.parentElement;
  }
  return parts.join(' > ') || 'body';
}

export function isWidgetOwned(element: Element): boolean {
  const root = element.getRootNode();
  if (root instanceof ShadowRoot && (root.host.id === 'vifee-widget-root' || root.host.hasAttribute('data-vifee-owned'))) return true;
  return Boolean(element.closest('#vifee-widget-root, [data-vifee-owned="true"]'));
}

function stableSegment(element: Element): string | null {
  for (const attribute of stableAttributes) {
    const value = element.getAttribute(attribute);
    if (!value) continue;
    if (attribute === 'id') return `#${escapeCss(value)}`;
    return `${element.tagName.toLowerCase()}[${attribute}="${escapeAttribute(value)}"]`;
  }
  return null;
}
function nthSegment(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const siblings = element.parentElement ? Array.from(element.parentElement.children).filter((child) => child.tagName === element.tagName) : [];
  return siblings.length <= 1 ? tag : `${tag}:nth-of-type(${siblings.indexOf(element) + 1})`;
}
function getElementXPath(element: Element): string {
  const segments: string[] = [];
  let current: Element | null = element;
  while (current) {
    let index = 1;
    let sibling = current.previousElementSibling;
    while (sibling) { if (sibling.tagName === current.tagName) index += 1; sibling = sibling.previousElementSibling; }
    segments.unshift(`${current.tagName.toLowerCase()}[${index}]`);
    current = current.parentElement;
  }
  return `/${segments.join('/')}`;
}
function querySelector(selector: string | null): Element | null { if (!selector) return null; try { return document.querySelector(selector); } catch { return null; } }
function queryXPath(xpath: string | null): Element | null { if (!xpath) return null; try { const node = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue; return node instanceof Element ? node : null; } catch { return null; } }
function safeQueryAll(selector: string): Element[] { try { return Array.from(document.querySelectorAll(selector)); } catch { return []; } }
function escapeCss(value: string): string { const escape = globalThis.CSS?.escape; return escape ? escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, '\\$&'); }
function escapeAttribute(value: string): string { return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }
function clampUnit(value: number): number { return Math.min(1, Math.max(0, value)); }
function clampPercent(value: number): number { return Math.min(100, Math.max(0, value)); }
