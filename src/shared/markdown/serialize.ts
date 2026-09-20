const TEXT_NODE = 3;
const ELEMENT_NODE = 1;
const BLOCK_TAGS = new Set(['P', 'DIV', 'LI', 'PRE']);

function isHttpHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function serializeChildren(parent: Node): string {
  let out = '';
  for (const child of Array.from(parent.childNodes)) {
    out += serializeInline(child);
  }
  return out;
}

function serializeInline(node: Node): string {
  if (node.nodeType === TEXT_NODE) {
    return node.nodeValue ?? '';
  }
  if (node.nodeType !== ELEMENT_NODE) {
    return '';
  }
  const el = node as HTMLElement;
  switch (el.tagName) {
    case 'BR':
      return '\n';
    case 'STRONG':
    case 'B':
      return `**${serializeChildren(el)}**`;
    case 'EM':
    case 'I':
      return `*${serializeChildren(el)}*`;
    case 'CODE':
      return `\`${serializeChildren(el)}\``;
    case 'A': {
      const inner = serializeChildren(el);
      const href = el.getAttribute('href');
      if (href && isHttpHref(href)) {
        return `[${inner}](${href})`;
      }
      return inner;
    }
    default:
      return serializeChildren(el);
  }
}

export function serializeMarkdown(root: HTMLElement): string {
  const blocks: string[] = [];
  let para: string[] = [];

  const flushPara = (): void => {
    const text = para.join('').trim();
    if (text !== '') {
      blocks.push(text);
    }
    para = [];
  };

  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === TEXT_NODE) {
      para.push(node.nodeValue ?? '');
      continue;
    }
    if (node.nodeType !== ELEMENT_NODE) {
      continue;
    }
    const el = node as HTMLElement;
    if (el.tagName === 'UL' || el.tagName === 'OL') {
      flushPara();
      const items: string[] = [];
      for (const li of Array.from(el.children)) {
        if (li.tagName !== 'LI') {
          continue;
        }
        const item = serializeChildren(li).trim();
        if (item === '') {
          continue;
        }
        items.push(el.tagName === 'UL' ? `- ${item}` : `${items.length + 1}. ${item}`);
      }
      if (items.length > 0) {
        blocks.push(items.join('\n'));
      }
      continue;
    }
    if (BLOCK_TAGS.has(el.tagName)) {
      flushPara();
      const text = serializeChildren(el).trim();
      if (text !== '') {
        blocks.push(text);
      }
      continue;
    }
    para.push(serializeInline(el));
  }
  flushPara();

  return blocks.join('\n\n');
}
