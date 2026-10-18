import { ImportReport, ImportWarning } from '../../types';
import { sanitizeHtml } from '../sanitize';

interface RtfState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  fontSize?: number; // pt
  color?: string;
}

export function importRtf(
  rtfText: string,
  fileName: string
): { html: string; report: ImportReport } {
  const warnings: ImportWarning[] = [];
  const skippedFeatures: string[] = [];

  // Parse color table if present: {\colortbl;\red0\green0\blue0;\red255\green0\blue0;}
  const colorTable: string[] = ['#000000'];
  const colortblMatch = rtfText.match(/\\colortbl\s*([^}]+);/);
  if (colortblMatch) {
    const colorEntries = colortblMatch[1].split(';');
    for (const entry of colorEntries) {
      const r = entry.match(/\\red(\d+)/);
      const g = entry.match(/\\green(\d+)/);
      const b = entry.match(/\\blue(\d+)/);
      if (r && g && b) {
        const hex = (
          (1 << 24) +
          (parseInt(r[1], 10) << 16) +
          (parseInt(g[1], 10) << 8) +
          parseInt(b[1], 10)
        )
          .toString(16)
          .slice(1);
        colorTable.push(`#${hex}`);
      }
    }
  }

  // Tokenize / parse
  const stateStack: RtfState[] = [
    { bold: false, italic: false, underline: false, strike: false },
  ];

  let currentParaHtml = '';
  const paragraphs: string[] = [];
  let i = 0;
  const len = rtfText.length;

  const getCurState = () => stateStack[stateStack.length - 1];

  let currentRunText = '';
  let activeRunState = { ...getCurState() };

  const flushRun = () => {
    if (!currentRunText) return;
    let safe = currentRunText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    if (activeRunState.color) {
      safe = `<span style="color: ${activeRunState.color}">${safe}</span>`;
    }
    if (activeRunState.fontSize) {
      safe = `<span style="font-size: ${activeRunState.fontSize}pt">${safe}</span>`;
    }
    if (activeRunState.bold) safe = `<strong>${safe}</strong>`;
    if (activeRunState.italic) safe = `<em>${safe}</em>`;
    if (activeRunState.underline) safe = `<u>${safe}</u>`;
    if (activeRunState.strike) safe = `<s>${safe}</s>`;

    currentParaHtml += safe;
    currentRunText = '';
    activeRunState = { ...getCurState() };
  };

  const flushPara = () => {
    flushRun();
    paragraphs.push(`<p>${currentParaHtml || '<br>'}</p>`);
    currentParaHtml = '';
  };

  let ignoreGroupDepth = 0;

  while (i < len) {
    const ch = rtfText[i];

    if (ch === '{') {
      flushRun();
      // Lookahead: destination group to ignore like {\*...} or {\fonttbl...} or {\colortbl...} or {\info...}
      if (ignoreGroupDepth > 0) {
        ignoreGroupDepth++;
      } else {
        const nextSlice = rtfText.slice(i, i + 20);
        if (
          nextSlice.startsWith('{\\*') ||
          nextSlice.startsWith('{\\fonttbl') ||
          nextSlice.startsWith('{\\colortbl') ||
          nextSlice.startsWith('{\\stylesheet') ||
          nextSlice.startsWith('{\\info')
        ) {
          ignoreGroupDepth = 1;
        } else {
          stateStack.push({ ...getCurState() });
          activeRunState = { ...getCurState() };
        }
      }
      i++;
      continue;
    }

    if (ch === '}') {
      flushRun();
      if (ignoreGroupDepth > 0) {
        ignoreGroupDepth--;
      } else {
        if (stateStack.length > 1) {
          stateStack.pop();
          activeRunState = { ...getCurState() };
        }
      }
      i++;
      continue;
    }

    if (ignoreGroupDepth > 0) {
      i++;
      continue;
    }

    if (ch === '\\') {
      const nextChar = rtfText[i + 1];
      if (nextChar === '\\' || nextChar === '{' || nextChar === '}') {
        currentRunText += nextChar;
        i += 2;
        continue;
      }
      if (nextChar === '~') {
        currentRunText += '&nbsp;';
        i += 2;
        continue;
      }

      // Hex byte \'hh
      if (nextChar === "'") {
        const hex = rtfText.slice(i + 2, i + 4);
        const code = parseInt(hex, 16);
        if (!isNaN(code)) {
          currentRunText += String.fromCharCode(code);
        }
        i += 4;
        continue;
      }

      // Control word \wordN
      i++;
      let word = '';
      while (i < len && /[a-zA-Z]/.test(rtfText[i])) {
        word += rtfText[i];
        i++;
      }
      let paramStr = '';
      let isNegative = false;
      if (i < len && rtfText[i] === '-') {
        isNegative = true;
        i++;
      }
      while (i < len && /[0-9]/.test(rtfText[i])) {
        paramStr += rtfText[i];
        i++;
      }
      // Trailing space delimiter is consumed
      if (i < len && rtfText[i] === ' ') {
        i++;
      }

      const param = paramStr ? (isNegative ? -parseInt(paramStr, 10) : parseInt(paramStr, 10)) : undefined;

      // Handle common RTF control words
      if (word === 'par') {
        flushPara();
      } else if (word === 'line') {
        flushRun();
        currentParaHtml += '<br>';
      } else if (word === 'b') {
        flushRun();
        getCurState().bold = param === undefined || param !== 0;
        activeRunState = { ...getCurState() };
      } else if (word === 'i') {
        flushRun();
        getCurState().italic = param === undefined || param !== 0;
        activeRunState = { ...getCurState() };
      } else if (word === 'ul' || word === 'ulnone') {
        flushRun();
        getCurState().underline = word === 'ul' && (param === undefined || param !== 0);
        activeRunState = { ...getCurState() };
      } else if (word === 'strike') {
        flushRun();
        getCurState().strike = param === undefined || param !== 0;
        activeRunState = { ...getCurState() };
      } else if (word === 'fs') {
        flushRun();
        if (param !== undefined) {
          getCurState().fontSize = Math.round(param / 2);
        }
        activeRunState = { ...getCurState() };
      } else if (word === 'cf') {
        flushRun();
        if (param !== undefined && colorTable[param]) {
          getCurState().color = colorTable[param];
        }
        activeRunState = { ...getCurState() };
      } else if (word === 'u') {
        // Unicode escape \uN?
        if (param !== undefined) {
          // code point can be negative for 16-bit signed int
          const codePoint = param < 0 ? param + 65536 : param;
          currentRunText += String.fromCharCode(codePoint);
          // Skip replacement char (often '?')
          if (i < len && rtfText[i] === '?') {
            i++;
          }
        }
      }
      continue;
    }

    if (ch === '\r' || ch === '\n') {
      // RTF treats raw newlines as whitespace, not paragraph breaks
      i++;
      continue;
    }

    currentRunText += ch;
    i++;
  }

  flushPara();

  const rawHtml = paragraphs.filter((p) => p !== '<p><br></p>' || paragraphs.length === 1).join('');
  const sanitized = sanitizeHtml(rawHtml || '<p></p>');

  return {
    html: sanitized,
    report: {
      fileName,
      format: 'rtf',
      importedAt: new Date().toISOString(),
      warnings,
      skippedFeatures,
    },
  };
}

