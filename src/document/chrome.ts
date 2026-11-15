import type { JSONContent } from '@tiptap/core';

export type ChromeFieldType = 'page' | 'pageOfTotal';

export type ChromeStoryTarget = 'header' | 'footer' | 'firstHeader' | 'firstFooter';

export interface ChromeMarks {
  fontFamily?: string;
  fontSize?: number; // in pt
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string; // hex color e.g. '#1e293b'
}

export interface ChromeTextRun extends ChromeMarks {
  type: 'text';
  text: string;
}

export interface ChromeFieldRun extends ChromeMarks {
  type: 'field';
  field: ChromeFieldType;
}

export interface ChromeImageRun {
  type: 'image';
  src: string; // data URL or path
  alt?: string;
  width?: number; // in px
  height?: number; // in px
}

export type ChromeRun = ChromeTextRun | ChromeFieldRun | ChromeImageRun;

export interface ChromeZone {
  align?: 'left' | 'center' | 'right';
  runs: ChromeRun[];
}

export interface ChromeLine0 {
  left: ChromeZone;
  center: ChromeZone;
  right: ChromeZone;
}

export interface ChromeParagraph {
  align?: 'left' | 'center' | 'right';
  runs: ChromeRun[];
}

export interface ChromeStory {
  line0: ChromeLine0;
  lines: ChromeParagraph[];
}

export interface DocumentChrome {
  differentFirstPage: boolean;
  header: ChromeStory;
  footer: ChromeStory;
  firstHeader?: ChromeStory;
  firstFooter?: ChromeStory;
}

export function createEmptyStory(): ChromeStory {
  return {
    line0: {
      left: { align: 'left', runs: [] },
      center: { align: 'center', runs: [] },
      right: { align: 'right', runs: [] },
    },
    lines: [],
  };
}

export function createEmptyChrome(): DocumentChrome {
  return {
    differentFirstPage: false,
    header: createEmptyStory(),
    footer: createEmptyStory(),
    firstHeader: createEmptyStory(),
    firstFooter: createEmptyStory(),
  };
}

function cleanRun(r: unknown): ChromeRun | null {
  if (!r || typeof r !== 'object') return null;
  const run = r as Record<string, unknown>;
  if (run.type === 'image') {
    if (typeof run.src !== 'string' || !run.src) return null;
    return {
      type: 'image',
      src: run.src,
      alt: typeof run.alt === 'string' ? run.alt : undefined,
      width: typeof run.width === 'number' && Number.isFinite(run.width) ? run.width : undefined,
      height: typeof run.height === 'number' && Number.isFinite(run.height) ? run.height : undefined,
    };
  }
  if (run.type === 'field') {
    const field: ChromeFieldType = run.field === 'pageOfTotal' ? 'pageOfTotal' : 'page';
    return {
      type: 'field',
      field,
      fontFamily: typeof run.fontFamily === 'string' ? run.fontFamily : undefined,
      fontSize: typeof run.fontSize === 'number' && Number.isFinite(run.fontSize) ? run.fontSize : undefined,
      bold: Boolean(run.bold),
      italic: Boolean(run.italic),
      underline: Boolean(run.underline),
      color: typeof run.color === 'string' ? run.color : undefined,
    };
  }
  // Default to text run
  const text = typeof run.text === 'string' ? run.text : '';
  return {
    type: 'text',
    text,
    fontFamily: typeof run.fontFamily === 'string' ? run.fontFamily : undefined,
    fontSize: typeof run.fontSize === 'number' && Number.isFinite(run.fontSize) ? run.fontSize : undefined,
    bold: Boolean(run.bold),
    italic: Boolean(run.italic),
    underline: Boolean(run.underline),
    color: typeof run.color === 'string' ? run.color : undefined,
  };
}

function cleanZone(z: unknown, defaultAlign: 'left' | 'center' | 'right'): ChromeZone {
  if (!z || typeof z !== 'object') return { align: defaultAlign, runs: [] };
  const zone = z as Record<string, unknown>;
  const align = (zone.align === 'center' || zone.align === 'right' || zone.align === 'left') ? zone.align : defaultAlign;
  const rawRuns = Array.isArray(zone.runs) ? zone.runs : [];
  const runs: ChromeRun[] = [];
  for (const r of rawRuns) {
    const cr = cleanRun(r);
    if (cr) runs.push(cr);
  }
  return { align, runs };
}

export function cleanStory(s: unknown): ChromeStory {
  if (!s || typeof s !== 'object') return createEmptyStory();
  const story = s as Record<string, unknown>;
  const line0Raw = story.line0 as Record<string, unknown> | undefined;
  const left = cleanZone(line0Raw?.left, 'left');
  const center = cleanZone(line0Raw?.center, 'center');
  const right = cleanZone(line0Raw?.right, 'right');

  const rawLines = Array.isArray(story.lines) ? story.lines : [];
  const lines: ChromeParagraph[] = [];
  for (const p of rawLines) {
    if (!p || typeof p !== 'object') continue;
    const para = p as Record<string, unknown>;
    const align = (para.align === 'center' || para.align === 'right' || para.align === 'left') ? para.align : 'left';
    const rawRuns = Array.isArray(para.runs) ? para.runs : [];
    const runs: ChromeRun[] = [];
    for (const r of rawRuns) {
      const cr = cleanRun(r);
      if (cr) runs.push(cr);
    }
    lines.push({ align, runs });
  }

  return {
    line0: { left, center, right },
    lines,
  };
}

export function readDocChrome(raw: unknown): DocumentChrome {
  if (!raw || typeof raw !== 'object') return createEmptyChrome();
  const c = raw as Record<string, unknown>;
  const differentFirstPage = Boolean(c.differentFirstPage);
  const header = cleanStory(c.header);
  const footer = cleanStory(c.footer);
  const firstHeader = c.firstHeader ? cleanStory(c.firstHeader) : createEmptyStory();
  const firstFooter = c.firstFooter ? cleanStory(c.firstFooter) : createEmptyStory();

  return {
    differentFirstPage,
    header,
    footer,
    firstHeader,
    firstFooter,
  };
}

export function isStoryEmpty(story?: ChromeStory | null): boolean {
  if (!story) return true;
  const l0 = story.line0;
  const noL0 =
    (!l0.left.runs || l0.left.runs.length === 0) &&
    (!l0.center.runs || l0.center.runs.length === 0) &&
    (!l0.right.runs || l0.right.runs.length === 0);
  if (!noL0) return false;
  if (!story.lines || story.lines.length === 0) return true;
  return story.lines.every((p) => !p.runs || p.runs.length === 0);
}

export function hasChromeContent(chrome?: DocumentChrome | null): boolean {
  if (!chrome) return false;
  if (!isStoryEmpty(chrome.header)) return true;
  if (!isStoryEmpty(chrome.footer)) return true;
  if (chrome.differentFirstPage) {
    if (!isStoryEmpty(chrome.firstHeader)) return true;
    if (!isStoryEmpty(chrome.firstFooter)) return true;
  }
  return false;
}

export function resolveStoryForPage(
  chrome: DocumentChrome,
  type: 'header' | 'footer',
  pageIndex: number
): ChromeStory {
  if (pageIndex === 1 && chrome.differentFirstPage) {
    if (type === 'header') return chrome.firstHeader || chrome.header;
    return chrome.firstFooter || chrome.footer;
  }
  return type === 'header' ? chrome.header : chrome.footer;
}

export function sameDocChrome(a: DocumentChrome, b: DocumentChrome): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function chromeFromDoc(doc?: { attrs?: Record<string, any> } | null): DocumentChrome {
  return readDocChrome(doc?.attrs?.chrome);
}

export function applyDocChrome(doc: JSONContent, chrome?: DocumentChrome | null): JSONContent {
  const clean = chrome ? readDocChrome(chrome) : readDocChrome(doc.attrs?.chrome);
  return { ...doc, attrs: { ...(doc.attrs || {}), chrome: clean } };
}

export function formatFieldRun(field: ChromeFieldType, pageIndex: number, totalPages: number): string {
  if (field === 'page') return String(pageIndex);
  return `Page ${pageIndex} of ${Math.max(1, totalPages)}`;
}
