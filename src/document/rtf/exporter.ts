function encodeRtfText(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 92) {
      result += '\\\\';
    } else if (code === 123) {
      result += '\\{';
    } else if (code === 125) {
      result += '\\}';
    } else if (code > 127) {
      result += `\\u${code}?`;
    } else {
      result += text[i];
    }
  }
  return result;
}

interface FormatContext {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fontSize?: number;
  fontIndex?: number;
}

function fontNameFromElement(el: HTMLElement): string {
  const match = (el.getAttribute('style') || '').match(/font-family:\s*['"]?([^'";,]+)/i);
  return match?.[1]?.trim() || '';
}

function processInlineNode(node: Node, ctx: FormatContext = {}): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const raw = node.textContent || '';
    if (!raw) return '';
    let prefix = '';
    let suffix = '';

    if (ctx.bold) {
      prefix += '\\b ';
      suffix = '\\b0 ' + suffix;
    }
    if (ctx.italic) {
      prefix += '\\i ';
      suffix = '\\i0 ' + suffix;
    }
    if (ctx.underline) {
      prefix += '\\ul ';
      suffix = '\\ulnone ' + suffix;
    }
    if (ctx.strike) {
      prefix += '\\strike ';
      suffix = '\\strike0 ' + suffix;
    }
    if (ctx.fontSize) {
      prefix += `\\fs${ctx.fontSize * 2} `;
      suffix = '\\fs24 ' + suffix;
    }
    if (ctx.fontIndex) {
      prefix += `\\f${ctx.fontIndex} `;
      suffix = '\\f0 ' + suffix;
    }

    return prefix + encodeRtfText(raw) + suffix;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'br') return '\\line ';

    const nextCtx: FormatContext = { ...ctx };
    if (tag === 'strong' || tag === 'b') nextCtx.bold = true;
    if (tag === 'em' || tag === 'i') nextCtx.italic = true;
    if (tag === 'u') nextCtx.underline = true;
    if (tag === 's' || tag === 'del' || tag === 'strike') nextCtx.strike = true;
    const family = fontNameFromElement(el);
    if (family) {
      const known = rtfFontTable.indexOf(family);
      if (known >= 0) nextCtx.fontIndex = known;
      else {
        rtfFontTable.push(family);
        nextCtx.fontIndex = rtfFontTable.length - 1;
      }
    }

    return Array.from(el.childNodes)
      .map((child) => processInlineNode(child, nextCtx))
      .join('');
  }

  return '';
}

const rtfFontTable = ['Noto Serif'];

export async function exportRtf(htmlContent: string): Promise<Blob> {
  rtfFontTable.splice(1);
  const parser = new (globalThis.DOMParser || DOMParser)();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const docElement = doc.body;

  let bodyRtf = '';

  const processBlockNode = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'h1') {
      const content = Array.from(el.childNodes).map((c) => processInlineNode(c)).join('');
      bodyRtf += `\\pard\\b\\fs40 ${content}\\b0\\fs24\\par\\sa140\r\n`;
    } else if (tag === 'h2') {
      const content = Array.from(el.childNodes).map((c) => processInlineNode(c)).join('');
      bodyRtf += `\\pard\\b\\fs32 ${content}\\b0\\fs24\\par\\sa120\r\n`;
    } else if (tag === 'h3') {
      const content = Array.from(el.childNodes).map((c) => processInlineNode(c)).join('');
      bodyRtf += `\\pard\\b\\fs28 ${content}\\b0\\fs24\\par\\sa100\r\n`;
    } else if (tag === 'p') {
      const content = Array.from(el.childNodes).map((c) => processInlineNode(c)).join('');
      bodyRtf += `\\pard\\sa140 ${content}\\par\r\n`;
    } else if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(el.querySelectorAll(':scope > li'));
      items.forEach((li) => {
        const content = Array.from(li.childNodes).map((c) => processInlineNode(c)).join('');
        bodyRtf += `\\pard\\bullet  ${content}\\par\r\n`;
      });
    } else if (tag === 'table') {
      const rows = Array.from(el.querySelectorAll('tr'));
      rows.forEach((r) => {
        const cells = Array.from(r.querySelectorAll('th, td'));
        bodyRtf += '\\trowd\\trgaph108\\trleft-108\r\n';
        cells.forEach((_, idx) => {
          bodyRtf += `\\cellx${(idx + 1) * 2000}\r\n`;
        });
        cells.forEach((c) => {
          const content = Array.from(c.childNodes).map((n) => processInlineNode(n)).join('');
          bodyRtf += `\\pard\\intbl ${content}\\cell\r\n`;
        });
        bodyRtf += '\\row\r\n';
      });
    } else {
      Array.from(el.childNodes).forEach(processBlockNode);
    }
  };

  Array.from(docElement.childNodes).forEach(processBlockNode);
  if (!bodyRtf) {
    bodyRtf = '\\pard\\par\r\n';
  }

  const fonttbl = rtfFontTable
    .map((name, index) => `{\\f${index}\\fnil\\fcharset0 ${name.replace(/[\\{}]/g, '')};}`)
    .join('');
  const rtfFull = `{\\rtf1\\ansi\\ansicpg1252\\deff0\\nouicompat
{\\fonttbl${fonttbl}}
{\\colortbl ;\\red15\\green118\\blue110;\\red180\\green83\\blue9;}
\\viewkind4\\uc1\\pard\\f0\\fs24
${bodyRtf}}`;

  return new Blob([rtfFull], { type: 'application/rtf' });
}
