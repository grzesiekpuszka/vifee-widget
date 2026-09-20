import type { RefObject } from 'preact';
import { __ } from '@vifee/i18n';
import { Icon, type IconName } from '../../ui/icons';

export const CONTENT_LIMIT = 10000;

/**
 * Pure decision core of the beforeinput guard: jsdom cannot construct
 * faithful beforeinput events, so unit tests pin this function and the real
 * flow stays under e2e coverage.
 */
export function shouldBlockInsert(currentLength: number): boolean {
	return currentLength >= CONTENT_LIMIT;
}

export type InlineTag = 'strong' | 'em' | 'code';
export type ListKind = 'ul' | 'ol';

const TEXT_NODE = 3;
const LINE_TAGS = ['P', 'DIV', 'PRE'];

function scopeOf(node: Node): ShadowRoot | Document {
  const root = node.getRootNode();
  return root instanceof ShadowRoot ? root : node.ownerDocument ?? (node as Document);
}

/**
 * The widget renders inside a shadow root, and selections that live in a
 * shadow tree are invisible to window/document.getSelection() — Chromium
 * reports them collapsed at the host element, which made every toolbar
 * action silently no-op (activeRange() could never see the composer's
 * ranges; only e2e coverage caught it, jsdom unit tests could not).
 * Resolving through the node's own root — ShadowRoot.getSelection() where it
 * exists, the document otherwise — reads and writes the real ranges.
 */
export type SelectionPath = 'shadow-root' | 'composed-ranges' | 'document-fallback';

/**
 * WHY: a selection inside our open shadow root is not uniformly visible to
 * document.getSelection(), and engines disagree on the workaround, so
 * detection order matters:
 *  1. ShadowRoot.getSelection() — Chromium and Safari expose shadow-tree
 *     selections directly on the root.
 *  2. Selection.getComposedRanges({ shadowRoots }) — Safari 17+ bridge over
 *     the shadow boundary (WHATWG selection API); without the root argument
 *     the document selection cannot cross into the tree at all. It returns
 *     StaticRange-like tuples that must be rebuilt into live Ranges
 *     (rangeFromComposed below).
 *  3. document.getSelection() — last resort, kept as the legacy fallback:
 *     only engines whose document selection penetrates open shadow trees see
 *     anything there (Firefox's long-standing interop divergence around its
 *     selection/shadow-DOM handling, ~FF 126 era bugzilla threads; engine
 *     support tracked as mdn-api_Selection_getComposedRanges /
 *     mdn-api_ShadowRoot_getSelection).
 * pickSelectionPath pins this ordering as pure logic; activeRange() wires it.
 */
export function pickSelectionPath(
	inShadowRoot: boolean,
	shadowHasGetSelection: boolean,
	selectionHasComposedRanges: boolean,
): SelectionPath {
	if (inShadowRoot && shadowHasGetSelection) return 'shadow-root';
	if (inShadowRoot && selectionHasComposedRanges) return 'composed-ranges';
	return 'document-fallback';
}

interface ComposedRangeLike {
	startContainer: Node | null;
	startOffset: number;
	endContainer: Node | null;
	endOffset: number;
}

/**
 * Rebuilds a live Range from one StaticRange-shaped getComposedRanges tuple,
 * or returns null when the tuple is unusable (containers detached, offsets
 * out of range) instead of throwing mid-toolbar-action.
 */
export function rangeFromComposed(doc: Document, composed: ComposedRangeLike): Range | null {
	const startContainer = composed.startContainer;
	const endContainer = composed.endContainer;
	if (!startContainer || !endContainer) return null;
	try {
		const range = doc.createRange();
		range.setStart(startContainer, composed.startOffset);
		range.setEnd(endContainer, composed.endOffset);
		return range;
	} catch {
		return null;
	}
}

interface SelectionScope {
	getSelection?(): Selection | null;
	defaultView?: Window & { getSelection(): Selection } | null;
}

function selectionWithin(node: Node): Selection | null {
	const scope = scopeOf(node) as unknown as SelectionScope;
	return typeof scope.getSelection === 'function' ? scope.getSelection() : scope.defaultView?.getSelection() ?? null;
}

function selectionOf(editor: HTMLElement): Selection | null {
	return selectionWithin(editor);
}

function selectRange(doc: Document, range: Range): void {
	const selection = selectionWithin(range.startContainer) ?? doc.defaultView?.getSelection() ?? null;
	if (!selection) return;
	selection.removeAllRanges();
	selection.addRange(range);
}

/**
 * 'composed-ranges' bridge: asks the document-level selection for composed
 * ranges across our shadow root and rebuilds them editor-relative. Null when
 * the engine lacks the API, the tuple is empty or the range lands outside
 * the editor.
 */
export function rangeViaComposedRanges(editor: HTMLElement, selection: Selection): Range | null {
	const root = editor.getRootNode();
	if (!(root instanceof ShadowRoot)) return null;
	const composable = selection as {
		getComposedRanges?: (options?: { shadowRoots?: ShadowRoot[] }) => ComposedRangeLike[];
	};
	if (typeof composable.getComposedRanges !== 'function') return null;
	const first = composable.getComposedRanges({ shadowRoots: [root] })[0];
	if (!first) return null;
	const range = rangeFromComposed(editor.ownerDocument, first);
	return range && editor.contains(range.commonAncestorContainer) ? range : null;
}

function activeRange(editor: HTMLElement): Range | null {
	const root = editor.getRootNode();
	const inShadowRoot = root instanceof ShadowRoot;
	const shadow = root as ShadowRoot & { getSelection?: () => Selection | null };
	const path = pickSelectionPath(
		inShadowRoot,
		inShadowRoot && typeof shadow.getSelection === 'function',
		typeof (editor.ownerDocument.getSelection() as { getComposedRanges?: unknown } | null)?.getComposedRanges === 'function',
	);
	let selection: Selection | null;
	if (path === 'shadow-root') {
		selection = shadow.getSelection!();
	} else {
		// 'composed-ranges' and the legacy 'document-fallback' both start from
		// selectionWithin(); only the bridging step below differs.
		selection = selectionWithin(editor);
	}
	if (!selection || selection.rangeCount === 0) return null;
	if (path === 'composed-ranges') return rangeViaComposedRanges(editor, selection);
	const range = selection.getRangeAt(0);
	return editor.contains(range.commonAncestorContainer) ? range : null;
}

function closestTag(from: Node, boundary: HTMLElement, tags: string[]): HTMLElement | null {
	let current: Node | null = from.nodeType === TEXT_NODE ? from.parentNode : from;
	while (current && current !== boundary) {
		if (current.nodeType === 1 && tags.includes((current as HTMLElement).tagName)) {
			return current as HTMLElement;
		}
		current = current.parentNode;
	}
	return null;
}

export function wrapWith(tag: InlineTag, range: Range, doc: Document): void {
	const wrapper = doc.createElement(tag);
	wrapper.appendChild(range.extractContents());
	range.insertNode(wrapper);
	const inner = doc.createRange();
	inner.selectNodeContents(wrapper);
	selectRange(doc, inner);
}

function unwrapElement(element: HTMLElement, doc: Document): void {
	const parent = element.parentNode;
	if (!parent) return;
	const index = Array.prototype.indexOf.call(parent.childNodes, element);
	const first = element.firstChild;
	const last = element.lastChild;
	while (element.firstChild) {
		parent.insertBefore(element.firstChild, element);
	}
	element.remove();
	const range = doc.createRange();
	if (first && last) {
		range.setStartBefore(first);
		range.setEndAfter(last);
	} else {
		range.setStart(parent, Math.max(index, 0));
		range.collapse(true);
	}
	selectRange(doc, range);
}

export function toggleWrap(tag: InlineTag, range: Range, editor: HTMLElement, doc: Document): void {
	const existing = closestTag(range.commonAncestorContainer, editor, [tag.toUpperCase()]);
	if (existing) {
		unwrapElement(existing, doc);
	} else {
		wrapWith(tag, range, doc);
	}
}

function blockLineOf(editor: HTMLElement, node: Node): HTMLElement | null {
	let current: Node | null = node;
	while (current && current.parentNode !== editor) {
		current = current.parentNode;
	}
	if (!current || current.nodeType !== 1) return null;
	const element = current as HTMLElement;
	return LINE_TAGS.includes(element.tagName) ? element : null;
}

function touchedLines(editor: HTMLElement, range: Range): HTMLElement[] {
	const first = blockLineOf(editor, range.startContainer);
	const last = blockLineOf(editor, range.endContainer);
	if (!first || !last) return [];
	const lines: HTMLElement[] = [];
	let current: Element | null = first;
	while (current) {
		if (LINE_TAGS.includes(current.tagName)) {
			lines.push(current as HTMLElement);
		}
		if (current === last) break;
		current = current.nextElementSibling;
	}
	return lines;
}

function splitByBr(line: HTMLElement, doc: Document): DocumentFragment[] {
	const fragments: DocumentFragment[] = [];
	let current = doc.createDocumentFragment();
	for (const child of Array.from(line.childNodes)) {
		if (child.nodeName === 'BR') {
			fragments.push(current);
			current = doc.createDocumentFragment();
			continue;
		}
		current.appendChild(child);
	}
	fragments.push(current);
	const filled = fragments.filter((fragment) => fragment.hasChildNodes());
	return filled.length > 0 ? filled : fragments.slice(0, 1);
}

function buildList(lines: HTMLElement[], kind: ListKind, doc: Document): void {
	const list = doc.createElement(kind);
	lines[0].parentNode?.insertBefore(list, lines[0]);
	for (const line of lines) {
		for (const segment of splitByBr(line, doc)) {
			const item = doc.createElement('li');
			item.appendChild(segment);
			list.appendChild(item);
		}
		line.remove();
	}
	const range = doc.createRange();
	range.selectNodeContents(list);
	selectRange(doc, range);
}

function listOff(list: HTMLElement, doc: Document): void {
	const parent = list.parentNode;
	if (!parent) return;
	const paragraphs: HTMLElement[] = [];
	for (const item of Array.from(list.children)) {
		if (item.tagName !== 'LI') continue;
		const paragraph = doc.createElement('p');
		while (item.firstChild) {
			paragraph.appendChild(item.firstChild);
		}
		paragraphs.push(paragraph);
		parent.insertBefore(paragraph, list);
	}
	list.remove();
	if (paragraphs.length === 0) return;
	const range = doc.createRange();
	range.setStartBefore(paragraphs[0]);
	range.setEndAfter(paragraphs[paragraphs.length - 1]);
	selectRange(doc, range);
}

function switchKind(list: HTMLElement, kind: ListKind, doc: Document): void {
	const next = doc.createElement(kind);
	while (list.firstChild) {
		next.appendChild(list.firstChild);
	}
	list.parentNode?.replaceChild(next, list);
	const range = doc.createRange();
	range.selectNodeContents(next);
	selectRange(doc, range);
}

export function toggleList(kind: ListKind, editor: HTMLElement): void {
	const doc = editor.ownerDocument;
	const selection = selectionOf(editor);
	if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) return;
	const range = selection.getRangeAt(0);

	const list = closestTag(range.commonAncestorContainer, editor, ['UL', 'OL']);
	if (list) {
		if (list.tagName.toLowerCase() === kind) {
			listOff(list, doc);
		} else {
			switchKind(list, kind, doc);
		}
		return;
	}
	const lines = touchedLines(editor, range);
	if (lines.length > 0) {
		buildList(lines, kind, doc);
	}
}

export function insertPlainText(editor: HTMLElement, text: string): Text | null {
	const doc = editor.ownerDocument;
	const selection = selectionOf(editor);
	if (!selection || selection.rangeCount === 0) return null;
	const range = selection.getRangeAt(0);
	if (!editor.contains(range.commonAncestorContainer)) return null;
	range.deleteContents();
	const node = doc.createTextNode(text);
	range.insertNode(node);
	range.collapse(false);
	selectRange(doc, range);
	return node;
}

function applyLink(editor: HTMLElement): void {
	const range = activeRange(editor);
	if (!range) return;
	const url = window.prompt(__('Link URL', 'vifee-visual-feedback'));
	if (!url || !/^https?:\/\//i.test(url)) return;
	const doc = editor.ownerDocument;
	const anchor = doc.createElement('a');
	anchor.setAttribute('href', url);
	if (range.collapsed) {
		anchor.textContent = url;
		range.insertNode(anchor);
		const after = doc.createRange();
		after.setStartAfter(anchor);
		after.collapse(true);
		selectRange(doc, after);
		return;
	}
	anchor.appendChild(range.extractContents());
	range.insertNode(anchor);
	const inner = doc.createRange();
	inner.selectNodeContents(anchor);
	selectRange(doc, inner);
}

interface ToolbarAction {
	label: string;
	glyph?: string;
	glyphClass?: string;
	icon?: IconName;
	run(editor: HTMLElement): void;
}

function inlineAction(label: string, tag: InlineTag): ToolbarAction {
	return {
		label,
		run: (editor) => {
			const range = activeRange(editor);
			if (range) toggleWrap(tag, range, editor, editor.ownerDocument);
		},
	};
}

const ACTIONS: ToolbarAction[] = [
	{ ...inlineAction(__('Bold', 'vifee-visual-feedback'), 'strong'), glyph: 'B', glyphClass: 'bold' },
	{ ...inlineAction(__('Italic', 'vifee-visual-feedback'), 'em'), glyph: 'I', glyphClass: 'italic' },
	{ ...inlineAction(__('Inline code', 'vifee-visual-feedback'), 'code'), icon: 'code' },
	{ label: __('Link', 'vifee-visual-feedback'), icon: 'link', run: applyLink },
	{ label: __('List', 'vifee-visual-feedback'), icon: 'list', run: (editor) => toggleList('ul', editor) },
	{ label: __('Ordered list', 'vifee-visual-feedback'), icon: 'list-ordered', run: (editor) => toggleList('ol', editor) },
];

interface ComposerToolbarProps {
	editor: RefObject<HTMLDivElement | null>;
	onEdit(): void;
}

export function ComposerToolbar({ editor, onEdit }: ComposerToolbarProps) {
	const run = (action: ToolbarAction) => {
		const element = editor.current;
		if (!element) return;
		action.run(element);
		element.focus();
		onEdit();
	};
	return (
		<div class="vifee-composer-toolbar" role="toolbar" aria-label={__('Markdown formatting', 'vifee-visual-feedback')}>
			{ACTIONS.map((action) => (
				<button
					key={action.label}
					type="button"
					class="vifee-composer-toolbar__button"
					aria-label={action.label}
					title={action.label}
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => run(action)}
				>
					{action.icon ? (
						<Icon name={action.icon} size={14} />
					) : (
						<span class={`vifee-composer-toolbar__glyph vifee-composer-toolbar__glyph--${action.glyphClass}`} aria-hidden="true">
							{action.glyph}
						</span>
					)}
				</button>
			))}
		</div>
	);
}
