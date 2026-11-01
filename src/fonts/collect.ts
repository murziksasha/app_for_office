import type { JSONContent } from '@tiptap/core';
import { chromeFromDoc } from '../document/chrome';
import type { EditorState } from '../types';
import { canonicalFamilyName, DEFAULT_DOCUMENT_FONT, DEFAULT_PRESENTATION_FONT, DEFAULT_SPREADSHEET_FONT } from './names';
import { resolveFontFamily } from './registry';

function add(names: Set<string>, value: unknown) {
  const name = canonicalFamilyName(typeof value === 'string' ? value : '');
  if (name) names.add(name);
}

function walkDoc(node: JSONContent | undefined, names: Set<string>) {
  if (!node) return;
  const marks = (node as { marks?: Array<{ type?: string; attrs?: { fontFamily?: string } }> }).marks;
  for (const mark of marks || []) {
    if (mark.type === 'textStyle') add(names, mark.attrs?.fontFamily);
  }
  for (const child of node.content || []) walkDoc(child, names);
}

function addChrome(doc: JSONContent | undefined, names: Set<string>) {
  const chrome = chromeFromDoc(doc);
  const stories = [chrome.header, chrome.footer, chrome.firstHeader, chrome.firstFooter];
  for (const story of stories) {
    if (!story) continue;
    const zones = [story.line0.left, story.line0.center, story.line0.right, ...story.lines];
    for (const zone of zones) {
      for (const run of zone.runs || []) {
        if (run.type !== 'image') add(names, run.fontFamily);
      }
    }
  }
}

export function familiesInState(state: Pick<EditorState, 'kind' | 'documentContent' | 'spreadsheetData' | 'presentationData'> | null | undefined): string[] {
  const names = new Set<string>();
  if (!state) return [];
  if (state.kind === 'document') {
    walkDoc(state.documentContent, names);
    addChrome(state.documentContent, names);
  } else if (state.kind === 'spreadsheet') {
    for (const sheet of state.spreadsheetData || []) {
      for (const row of sheet?.data || []) {
        for (const cell of row || []) {
          if (cell && typeof cell.ff === 'string') add(names, cell.ff);
        }
      }
    }
  } else if (state.kind === 'presentation') {
    for (const slide of state.presentationData?.slides || []) {
      for (const element of slide.elements || []) add(names, element.fontFamily);
    }
  }
  return [...names];
}

export function missingFontNames(names: string[]): string[] {
  return names.filter((name) => !resolveFontFamily(name));
}

export function defaultFontFor(kind: EditorState['kind'] | undefined): string {
  if (kind === 'document') return DEFAULT_DOCUMENT_FONT;
  if (kind === 'presentation') return DEFAULT_PRESENTATION_FONT;
  return DEFAULT_SPREADSHEET_FONT;
}
