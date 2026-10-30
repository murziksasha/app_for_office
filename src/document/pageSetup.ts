import type { JSONContent } from '@tiptap/core';

export type PageSizeName = 'letter' | 'a4';

export interface PageSetup {
  size: PageSizeName;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
}

export const DEFAULT_PAGE_SETUP: PageSetup = {
  size: 'letter',
  marginTop: 25.4,
  marginRight: 25.4,
  marginBottom: 25.4,
  marginLeft: 25.4,
};

export const PAGE_MM: Record<PageSizeName, { width: number; height: number }> = {
  letter: { width: 215.9, height: 279.4 },
  a4: { width: 210, height: 297 },
};

const MIN_CONTENT_MM = 40;

export function mmToPx(mm: number): number {
  return (mm / 25.4) * 96;
}

export function mmToPt(mm: number): number {
  return (mm / 25.4) * 72;
}

export function mmToTwip(mm: number): number {
  return Math.round((mm * 1440) / 25.4);
}

export function twipToMm(twip: number): number {
  return (twip * 25.4) / 1440;
}

export function roundMm(mm: number): number {
  return Math.round(mm * 10) / 10;
}

function finite(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function clampPageSetup(input: Partial<PageSetup> | null | undefined): PageSetup {
  const size: PageSizeName = input?.size === 'a4' ? 'a4' : 'letter';
  const page = PAGE_MM[size];
  let top = Math.max(0, finite(input?.marginTop, DEFAULT_PAGE_SETUP.marginTop));
  let right = Math.max(0, finite(input?.marginRight, DEFAULT_PAGE_SETUP.marginRight));
  let bottom = Math.max(0, finite(input?.marginBottom, DEFAULT_PAGE_SETUP.marginBottom));
  let left = Math.max(0, finite(input?.marginLeft, DEFAULT_PAGE_SETUP.marginLeft));

  const maxVertical = page.height - MIN_CONTENT_MM;
  if (top + bottom > maxVertical) {
    const scale = maxVertical / (top + bottom || 1);
    top *= scale;
    bottom *= scale;
  }
  const maxHorizontal = page.width - MIN_CONTENT_MM;
  if (left + right > maxHorizontal) {
    const scale = maxHorizontal / (left + right || 1);
    left *= scale;
    right *= scale;
  }

  return {
    size,
    marginTop: roundMm(top),
    marginRight: roundMm(right),
    marginBottom: roundMm(bottom),
    marginLeft: roundMm(left),
  };
}

export function readPageSetup(value: unknown): PageSetup {
  if (!value || typeof value !== 'object') return clampPageSetup(DEFAULT_PAGE_SETUP);
  return clampPageSetup(value as Partial<PageSetup>);
}

export function pageSetupFromDoc(doc: JSONContent | null | undefined): PageSetup {
  return readPageSetup(doc?.attrs?.pageSetup);
}

/** Apply one edit. A single margin is capped against the opposite side so the other thumb stays put. */
export function mergePageSetup(current: PageSetup, partial: Partial<PageSetup>): PageSetup {
  const size: PageSizeName = partial.size === 'a4' ? 'a4' : partial.size === 'letter' ? 'letter' : current.size;
  const page = PAGE_MM[size];
  const maxH = page.width - MIN_CONTENT_MM;
  const maxV = page.height - MIN_CONTENT_MM;
  const cap = (value: number, other: number, max: number) => roundMm(Math.min(Math.max(0, value), Math.max(0, max - other)));
  const next: PageSetup = {
    size,
    marginTop: current.marginTop,
    marginRight: current.marginRight,
    marginBottom: current.marginBottom,
    marginLeft: current.marginLeft,
  };
  if (partial.marginLeft != null) next.marginLeft = cap(finite(partial.marginLeft, current.marginLeft), next.marginRight, maxH);
  if (partial.marginRight != null) next.marginRight = cap(finite(partial.marginRight, current.marginRight), next.marginLeft, maxH);
  if (partial.marginTop != null) next.marginTop = cap(finite(partial.marginTop, current.marginTop), next.marginBottom, maxV);
  if (partial.marginBottom != null) next.marginBottom = cap(finite(partial.marginBottom, current.marginBottom), next.marginTop, maxV);
  if (partial.size != null && partial.size !== current.size) return clampPageSetup(next);
  return next;
}

export function samePageSetup(a: PageSetup, b: PageSetup): boolean {
  return (
    a.size === b.size &&
    a.marginTop === b.marginTop &&
    a.marginRight === b.marginRight &&
    a.marginBottom === b.marginBottom &&
    a.marginLeft === b.marginLeft
  );
}

export function applyPageSetup(doc: JSONContent, setup?: PageSetup | null): JSONContent {
  const pageSetup = setup ? clampPageSetup(setup) : readPageSetup(doc.attrs?.pageSetup);
  return { ...doc, attrs: { ...(doc.attrs || {}), pageSetup } };
}

export function marginUnit(lang: string): 'in' | 'cm' {
  return lang.toLowerCase().startsWith('uk') ? 'cm' : 'in';
}

export function formatMargin(mm: number, lang: string): string {
  return marginUnit(lang) === 'cm' ? (mm / 10).toFixed(1) : (mm / 25.4).toFixed(2);
}

export function parseMargin(text: string, lang: string): number | null {
  const n = Number(String(text).trim().replace(',', '.').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n)) return null;
  return marginUnit(lang) === 'cm' ? n * 10 : n * 25.4;
}

export function lengthToMm(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value * 10;
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*(mm|cm|in|pt)?$/i);
  if (!match) return null;
  const n = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  const unit = (match[2] || 'cm').toLowerCase();
  if (unit === 'mm') return n;
  if (unit === 'cm') return n * 10;
  if (unit === 'in') return n * 25.4;
  return (n * 25.4) / 72;
}

interface TwipSection {
  width?: number | null;
  height?: number | null;
  top?: number | null;
  right?: number | null;
  bottom?: number | null;
  left?: number | null;
}

function optionalTwip(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function pageSetupFromTwips(input: TwipSection): { setup: PageSetup; adjusted: boolean } {
  let size: PageSizeName = 'letter';
  let adjusted = false;
  if (input.width != null && input.height != null) {
    const widthMm = twipToMm(input.width);
    const heightMm = twipToMm(input.height);
    const landscape = widthMm > heightMm + 1;
    const w = landscape ? heightMm : widthMm;
    const h = landscape ? widthMm : heightMm;
    const letterDist = Math.abs(w - PAGE_MM.letter.width) + Math.abs(h - PAGE_MM.letter.height);
    const a4Dist = Math.abs(w - PAGE_MM.a4.width) + Math.abs(h - PAGE_MM.a4.height);
    size = letterDist <= a4Dist ? 'letter' : 'a4';
    const target = PAGE_MM[size];
    adjusted = landscape || Math.abs(w - target.width) > 2 || Math.abs(h - target.height) > 2;
  }
  const setup = clampPageSetup({
    size,
    marginTop: input.top == null ? DEFAULT_PAGE_SETUP.marginTop : twipToMm(input.top),
    marginRight: input.right == null ? DEFAULT_PAGE_SETUP.marginRight : twipToMm(input.right),
    marginBottom: input.bottom == null ? DEFAULT_PAGE_SETUP.marginBottom : twipToMm(input.bottom),
    marginLeft: input.left == null ? DEFAULT_PAGE_SETUP.marginLeft : twipToMm(input.left),
  });
  return { setup, adjusted };
}

export function readDocxSection(body: unknown): { setup: PageSetup; adjusted: boolean } | null {
  if (!body || typeof body !== 'object') return null;
  const sect = (body as { sectPr?: Record<string, unknown> }).sectPr;
  if (!sect || typeof sect !== 'object') return null;
  const pgSz = (sect.pgSz || {}) as Record<string, unknown>;
  const pgMar = (sect.pgMar || {}) as Record<string, unknown>;
  const width = optionalTwip(pgSz['@_w']);
  const height = optionalTwip(pgSz['@_h']);
  const top = optionalTwip(pgMar['@_top']);
  const right = optionalTwip(pgMar['@_right']);
  const bottom = optionalTwip(pgMar['@_bottom']);
  const left = optionalTwip(pgMar['@_left']);
  if (width == null && height == null && top == null && right == null && bottom == null && left == null) return null;
  return pageSetupFromTwips({ width, height, top, right, bottom, left });
}

function pageLayoutsOf(node: unknown): Record<string, unknown>[] {
  if (!node || typeof node !== 'object') return [];
  const record = node as Record<string, unknown>;
  const auto = record['automatic-styles'];
  const raw =
    record['page-layout'] ||
    (auto && typeof auto === 'object' ? (auto as Record<string, unknown>)['page-layout'] : undefined);
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]) as Record<string, unknown>[];
}

export function readOdtPageSetup(root: unknown): { setup: PageSetup; adjusted: boolean } | null {
  if (!root || typeof root !== 'object') return null;
  const record = root as Record<string, unknown>;
  const layouts = [
    ...pageLayoutsOf(record),
    ...pageLayoutsOf(record['document-styles']),
    ...pageLayoutsOf(record['document-content']),
    ...pageLayoutsOf(record['automatic-styles']),
  ];
  for (const layout of layouts) {
    const props = layout['page-layout-properties'];
    if (!props || typeof props !== 'object') continue;
    const attrs = props as Record<string, unknown>;
    const width = lengthToMm(attrs['@_page-width']);
    const height = lengthToMm(attrs['@_page-height']);
    const top = lengthToMm(attrs['@_margin-top']);
    const right = lengthToMm(attrs['@_margin-right']);
    const bottom = lengthToMm(attrs['@_margin-bottom']);
    const left = lengthToMm(attrs['@_margin-left']);
    if (width == null && height == null && top == null && right == null && bottom == null && left == null) continue;
    let size: PageSizeName = 'letter';
    let adjusted = false;
    if (width != null && height != null) {
      const landscape = width > height + 1;
      const w = landscape ? height : width;
      const h = landscape ? width : height;
      const letterDist = Math.abs(w - PAGE_MM.letter.width) + Math.abs(h - PAGE_MM.letter.height);
      const a4Dist = Math.abs(w - PAGE_MM.a4.width) + Math.abs(h - PAGE_MM.a4.height);
      size = letterDist <= a4Dist ? 'letter' : 'a4';
      const target = PAGE_MM[size];
      adjusted = landscape || Math.abs(w - target.width) > 2 || Math.abs(h - target.height) > 2;
    }
    return {
      adjusted,
      setup: clampPageSetup({
        size,
        marginTop: top ?? DEFAULT_PAGE_SETUP.marginTop,
        marginRight: right ?? DEFAULT_PAGE_SETUP.marginRight,
        marginBottom: bottom ?? DEFAULT_PAGE_SETUP.marginBottom,
        marginLeft: left ?? DEFAULT_PAGE_SETUP.marginLeft,
      }),
    };
  }
  return null;
}

export function pageSizeLabel(size: PageSizeName): string {
  return size === 'a4' ? 'A4' : 'Letter';
}
