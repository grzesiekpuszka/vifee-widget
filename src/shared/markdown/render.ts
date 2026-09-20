const FENCED_CODE_BLOCK = /^```[^\n]*\n([\s\S]*?)^```$/gm;
const LINK = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;
const BOLD = /\*\*([^*\n]+)\*\*/g;
const ITALIC = /\*([^*\n]+)\*/g;
const INLINE_CODE = /`([^`\n]+)`/g;
const LIST_ITEM_UL = /^- (.*)$/;
const LIST_ITEM_OL = /^\d+\. (.*)$/;
const PLACEHOLDER_LINE = /^\u0000(\d+)\u0000$/;

const HREF_PLACEHOLDER = /\x01(\d+)\x01/g;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderMarkdown(text: string): string {
  const source = text.replace(/\r\n/g, '\n');
  const blocks: string[] = [];

  let working = source.replace(FENCED_CODE_BLOCK, (_match: string, body: string) => {
    const content = body.endsWith('\n') ? body.slice(0, -1) : body;
    const placeholder = `\u0000${blocks.length}\u0000`;
    blocks.push(`<pre><code>${escapeHtml(content)}</code></pre>`);
    return `\n${placeholder}\n`;
  });

  working = escapeHtml(working);
  const hrefs: string[] = [];
  working = working.replace(LINK, (match: string, label: string, url: string) => {
    if (/["']/.test(url)) {
      return match;
    }
    const placeholder = `\x01${hrefs.length}\x01`;
    hrefs.push(url);
    return `<a href="${placeholder}" rel="nofollow noopener">${label}</a>`;
  });
  working = working.replace(BOLD, '<strong>$1</strong>');
  working = working.replace(ITALIC, '<em>$1</em>');
  working = working.replace(INLINE_CODE, '<code>$1</code>');
  working = working.replace(HREF_PLACEHOLDER, (_match: string, index: string) => hrefs[Number(index)]);

  const out: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;
  let para: string[] = [];

  const flushPara = (): void => {
    if (para.length > 0) {
      out.push(`<p>${para.join('<br>')}</p>`);
      para = [];
    }
  };
  const flushList = (): void => {
    if (list) {
      out.push(`<${list.tag}>${list.items.map((item) => `<li>${item}</li>`).join('')}</${list.tag}>`);
      list = null;
    }
  };

  for (const raw of working.split('\n')) {
    const line = raw.trim();
    if (line === '') {
      flushPara();
      flushList();
      continue;
    }
    const block = PLACEHOLDER_LINE.exec(line);
    if (block) {
      flushPara();
      flushList();
      out.push(blocks[Number(block[1])]);
      continue;
    }
    const ul = LIST_ITEM_UL.exec(line);
    if (ul) {
      flushPara();
      if (!list || list.tag !== 'ul') {
        flushList();
        list = { tag: 'ul', items: [] };
      }
      list.items.push(ul[1]);
      continue;
    }
    const ol = LIST_ITEM_OL.exec(line);
    if (ol) {
      flushPara();
      if (!list || list.tag !== 'ol') {
        flushList();
        list = { tag: 'ol', items: [] };
      }
      list.items.push(ol[1]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();

  return out.join('');
}
