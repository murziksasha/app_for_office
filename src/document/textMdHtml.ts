import MarkdownIt from 'markdown-it';
import TurndownService from 'turndown';
import { sanitizeHtml } from './sanitize';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

const turndown = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

// Fallback Turndown rules for tables if gfm plugin is missing or limited
turndown.addRule('table', {
  filter: 'table',
  replacement: function (_content, node) {
    const table = node as HTMLTableElement;
    const rows = Array.from(table.rows);
    if (!rows.length) return '';

    let mdTable = '\n\n';
    rows.forEach((row, rowIndex) => {
      const cells = Array.from(row.cells).map((cell) => cell.textContent?.trim().replace(/\|/g, '\\|') || '');
      mdTable += '| ' + cells.join(' | ') + ' |\n';
      if (rowIndex === 0) {
        mdTable += '| ' + cells.map(() => '---').join(' | ') + ' |\n';
      }
    });
    return mdTable + '\n\n';
  },
});

export function plainTextToHtml(text: string): string {
  if (!text) return '<p></p>';
  const paragraphs = text.split(/\r?\n\r?\n/);
  return paragraphs
    .map((p) => {
      const safeText = p
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\r?\n/g, '<br>');
      return `<p>${safeText || '<br>'}</p>`;
    })
    .join('');
}

export function htmlToPlainText(html: string): string {
  if (typeof document === 'undefined') {
    // In node/test environment without document
    return html
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
  const div = document.createElement('div');
  div.innerHTML = html;

  // Walk nodes
  function extract(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === 'br') return '\n';
      if (tag === 'hr') return '\n---\n';

      let inner = Array.from(el.childNodes).map(extract).join('');
      if (tag === 'p' || tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
        return inner + '\n\n';
      }
      if (tag === 'li') {
        return '- ' + inner + '\n';
      }
      if (tag === 'tr') {
        return inner + '\n';
      }
      if (tag === 'td' || tag === 'th') {
        return inner + '\t';
      }
      return inner;
    }
    return '';
  }

  return extract(div).trim();
}

export function markdownToHtml(markdown: string): string {
  const rawHtml = md.render(markdown || '');
  return sanitizeHtml(rawHtml);
}

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html || '');
}

export function wrapInHtmlDocument(bodyHtml: string, title = 'Document'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1f2328;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
    }
    h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
    p { margin-bottom: 1em; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #d8d3c8; padding: 8px 12px; text-align: left; }
    th { background: #f6f4ee; }
    img { max-width: 100%; height: auto; }
    blockquote { border-left: 4px solid #0f766e; padding-left: 12px; color: #5c6370; margin-left: 0; }
  </style>
</head>
<body>
${sanitizeHtml(bodyHtml)}
</body>
</html>`;
}
