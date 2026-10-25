import type { EditorView } from '@tiptap/pm/view';
import {
  chromeFromDoc,
  formatFieldRun,
  isStoryEmpty,
  type ChromeMarks,
  type ChromeParagraph,
  type ChromeRun,
  type ChromeStory,
  type ChromeStoryTarget,
  type ChromeZone,
  type DocumentChrome,
} from './chrome';
import { bandState } from './bandState';
import { t } from '../i18n/instance';

export interface BandRenderOptions {
  storyTarget: ChromeStoryTarget;
  story: ChromeStory;
  bandType: 'header' | 'footer';
  pageIndex: number;
  totalPages: number;
  heightPx: number;
  view: EditorView;
}

function parseZoneDom(zoneEl: HTMLElement): ChromeRun[] {
  const runs: ChromeRun[] = [];
  const nodes = Array.from(zoneEl.childNodes);

  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text) {
        runs.push({ type: 'text', text });
      }
      continue;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      // Check field run
      const fieldAttr = el.getAttribute('data-field');
      if (fieldAttr === 'page' || fieldAttr === 'pageOfTotal') {
        runs.push({
          type: 'field',
          field: fieldAttr,
          bold: el.style.fontWeight === 'bold' || el.style.fontWeight === '700',
          italic: el.style.fontStyle === 'italic',
          underline: el.style.textDecoration.includes('underline'),
          color: el.style.color || undefined,
        });
        continue;
      }

      // Check image
      if (el.tagName.toLowerCase() === 'img') {
        const img = el as HTMLImageElement;
        if (img.src) {
          runs.push({ type: 'image', src: img.src });
        }
        continue;
      }

      // Check text span
      const text = el.textContent || '';
      if (text) {
        runs.push({
          type: 'text',
          text,
          bold: el.style.fontWeight === 'bold' || el.style.fontWeight === '700',
          italic: el.style.fontStyle === 'italic',
          underline: el.style.textDecoration.includes('underline'),
          color: el.style.color || undefined,
        });
      }
    }
  }

  return runs;
}

export function createBandElement(options: BandRenderOptions): HTMLElement {
  const { storyTarget, story, bandType, pageIndex, totalPages, heightPx, view } = options;

  const container = document.createElement('div');
  container.className = `folio-band-container folio-band-${bandType}`;
  container.setAttribute('contenteditable', 'false');
  container.style.width = '100%';
  container.style.height = `${heightPx}px`;
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.justifyContent = 'center';
  container.style.boxSizing = 'border-box';
  container.style.pointerEvents = 'auto';
  container.style.userSelect = 'text';
  container.style.position = 'relative';

  const empty = isStoryEmpty(story);

  // Helper to commit updated story into doc attrs
  const commitStory = (updatedStory: ChromeStory) => {
    const chrome = chromeFromDoc(view.state.doc);
    const nextChrome: DocumentChrome = {
      ...chrome,
      [storyTarget]: updatedStory,
    };
    view.dispatch(view.state.tr.setDocAttribute('chrome', nextChrome));
  };

  if (empty) {
    const hint = document.createElement('div');
    hint.className = 'folio-band-hint';
    hint.style.color = 'var(--folio-ink-faint, #94a3b8)';
    hint.style.fontSize = '11px';
    hint.style.fontStyle = 'italic';
    hint.style.userSelect = 'none';
    hint.style.cursor = 'pointer';
    hint.style.padding = '4px 0';
    hint.textContent = bandType === 'header' ? t('ribbon.headerHint') : t('ribbon.footerHint');

    hint.addEventListener('click', (e) => {
      e.stopPropagation();
      // Activate zone editing
      hint.remove();
      const nextStory: ChromeStory = {
        line0: {
          left: { align: 'left', runs: [{ type: 'text', text: '' }] },
          center: { align: 'center', runs: [] },
          right: { align: 'right', runs: [] },
        },
        lines: [],
      };
      commitStory(nextStory);
    });

    container.appendChild(hint);
    return container;
  }

  // Render Line 0 (three zones: left, center, right)
  const line0El = document.createElement('div');
  line0El.className = 'folio-band-line0';
  line0El.style.display = 'flex';
  line0El.style.width = '100%';
  line0El.style.alignItems = 'center';
  line0El.style.gap = '8px';

  const zoneKeys: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];

  for (const zk of zoneKeys) {
    const zone = story.line0[zk];
    const zoneEl = document.createElement('div');
    zoneEl.className = `folio-band-zone folio-band-zone-${zk}`;
    zoneEl.setAttribute('contenteditable', 'true');
    zoneEl.style.flex = '1';
    zoneEl.style.textAlign = zone.align || zk;
    zoneEl.style.outline = 'none';
    zoneEl.style.minHeight = '18px';
    zoneEl.style.padding = '2px 4px';
    zoneEl.style.fontSize = '10pt';

    // Populate runs
    for (const run of zone.runs) {
      if (run.type === 'image') {
        const img = document.createElement('img');
        img.src = run.src;
        img.setAttribute('contenteditable', 'false');
        img.style.maxHeight = '24px';
        img.style.verticalAlign = 'middle';
        img.style.marginRight = '4px';
        zoneEl.appendChild(img);
      } else if (run.type === 'field') {
        const span = document.createElement('span');
        span.className = 'folio-page-field';
        span.setAttribute('contenteditable', 'false');
        span.setAttribute('data-field', run.field);
        span.style.padding = '1px 4px';
        span.style.borderRadius = '2px';
        span.style.backgroundColor = 'rgba(15, 118, 110, 0.08)';
        span.style.color = 'var(--folio-teal, #0f766e)';
        span.style.fontWeight = run.bold ? 'bold' : 'normal';
        span.style.fontStyle = run.italic ? 'italic' : 'normal';
        span.textContent = formatFieldRun(run.field, pageIndex, totalPages);
        zoneEl.appendChild(span);
      } else if (run.type === 'text') {
        const span = document.createElement('span');
        span.textContent = run.text;
        if (run.bold) span.style.fontWeight = 'bold';
        if (run.italic) span.style.fontStyle = 'italic';
        if (run.underline) span.style.textDecoration = 'underline';
        if (run.color) span.style.color = run.color;
        if (run.fontSize) span.style.fontSize = `${run.fontSize}pt`;
        if (run.fontFamily) span.style.fontFamily = run.fontFamily;
        zoneEl.appendChild(span);
      }
    }

    zoneEl.addEventListener('focus', () => {
      bandState.setView(view);
      const firstRun = zone.runs.find((r) => r.type === 'text' || r.type === 'field') as any;
      const marks: ChromeMarks = {
        bold: firstRun?.bold,
        italic: firstRun?.italic,
        underline: firstRun?.underline,
        color: firstRun?.color,
        fontSize: firstRun?.fontSize,
        fontFamily: firstRun?.fontFamily,
      };
      bandState.setFocus({
        storyTarget,
        zoneKey: zk,
        lineIndex: 0,
        marks,
        align: zone.align || zk,
        pageIndex,
      });
    });

    zoneEl.addEventListener('input', () => {
      const newRuns = parseZoneDom(zoneEl);
      const updatedStory: ChromeStory = {
        ...story,
        line0: {
          ...story.line0,
          [zk]: {
            ...zone,
            runs: newRuns,
          },
        },
      };
      commitStory(updatedStory);
    });

    zoneEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const updatedStory: ChromeStory = {
          ...story,
          lines: [...story.lines, { align: 'left', runs: [{ type: 'text', text: '' }] }],
        };
        commitStory(updatedStory);
      }
    });

    line0El.appendChild(zoneEl);
  }

  container.appendChild(line0El);

  // Render further lines (full-width paragraphs)
  for (let lIdx = 0; lIdx < story.lines.length; lIdx++) {
    const line = story.lines[lIdx];
    const lineEl = document.createElement('div');
    lineEl.className = 'folio-band-line';
    lineEl.setAttribute('contenteditable', 'true');
    lineEl.style.width = '100%';
    lineEl.style.textAlign = line.align || 'left';
    lineEl.style.outline = 'none';
    lineEl.style.minHeight = '18px';
    lineEl.style.padding = '2px 4px';
    lineEl.style.fontSize = '10pt';

    for (const run of line.runs) {
      if (run.type === 'image') {
        const img = document.createElement('img');
        img.src = run.src;
        img.setAttribute('contenteditable', 'false');
        img.style.maxHeight = '24px';
        img.style.verticalAlign = 'middle';
        img.style.marginRight = '4px';
        lineEl.appendChild(img);
      } else if (run.type === 'field') {
        const span = document.createElement('span');
        span.className = 'folio-page-field';
        span.setAttribute('contenteditable', 'false');
        span.setAttribute('data-field', run.field);
        span.style.padding = '1px 4px';
        span.style.borderRadius = '2px';
        span.style.backgroundColor = 'rgba(15, 118, 110, 0.08)';
        span.style.color = 'var(--folio-teal, #0f766e)';
        span.style.fontWeight = run.bold ? 'bold' : 'normal';
        span.style.fontStyle = run.italic ? 'italic' : 'normal';
        span.textContent = formatFieldRun(run.field, pageIndex, totalPages);
        lineEl.appendChild(span);
      } else if (run.type === 'text') {
        const span = document.createElement('span');
        span.textContent = run.text;
        if (run.bold) span.style.fontWeight = 'bold';
        if (run.italic) span.style.fontStyle = 'italic';
        if (run.underline) span.style.textDecoration = 'underline';
        if (run.color) span.style.color = run.color;
        if (run.fontSize) span.style.fontSize = `${run.fontSize}pt`;
        if (run.fontFamily) span.style.fontFamily = run.fontFamily;
        lineEl.appendChild(span);
      }
    }

    lineEl.addEventListener('focus', () => {
      bandState.setView(view);
      const firstRun = line.runs.find((r) => r.type === 'text' || r.type === 'field') as any;
      const marks: ChromeMarks = {
        bold: firstRun?.bold,
        italic: firstRun?.italic,
        underline: firstRun?.underline,
        color: firstRun?.color,
        fontSize: firstRun?.fontSize,
        fontFamily: firstRun?.fontFamily,
      };
      bandState.setFocus({
        storyTarget,
        lineIndex: lIdx + 1,
        marks,
        align: line.align || 'left',
        pageIndex,
      });
    });

    lineEl.addEventListener('input', () => {
      const newRuns = parseZoneDom(lineEl);
      const nextLines = [...story.lines];
      nextLines[lIdx] = { ...line, runs: newRuns };
      commitStory({ ...story, lines: nextLines });
    });

    lineEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const nextLines = [...story.lines];
        nextLines.splice(lIdx + 1, 0, { align: line.align || 'left', runs: [{ type: 'text', text: '' }] });
        commitStory({ ...story, lines: nextLines });
      } else if (e.key === 'Backspace' && (!lineEl.textContent || lineEl.textContent === '')) {
        e.preventDefault();
        const nextLines = [...story.lines];
        nextLines.splice(lIdx, 1);
        commitStory({ ...story, lines: nextLines });
      }
    });

    container.appendChild(lineEl);
  }

  return container;
}

