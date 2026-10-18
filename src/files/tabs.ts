import { DocumentKind, DraftItem, EditorState, SupportedFormat } from '../types';
import { defaultDocumentModel } from '../document/model';
import { createEmptySheet } from '../spreadsheet/adapters';
import { createEmptySlide } from '../slides/pptxAdapter';
import { contentHash, nextFileName } from './session';

export function editorPayload(
  state: Pick<EditorState, 'kind' | 'documentContent' | 'spreadsheetData' | 'presentationData'>
): unknown {
  if (state.kind === 'document') return state.documentContent ?? null;
  if (state.kind === 'spreadsheet') return state.spreadsheetData ?? null;
  if (state.kind === 'presentation') return state.presentationData ?? null;
  return null;
}

export function newTabId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function stampClean(state: EditorState, id = state.id || newTabId()): EditorState {
  if (state.kind === 'pdf') {
    return { ...state, id, cleanHash: 'pdf', contentHash: 'pdf', isDirty: false };
  }
  const hash = contentHash(editorPayload(state));
  return { ...state, id, cleanHash: hash, contentHash: hash, isDirty: false };
}

export function applyEdit(state: EditorState, partial: Partial<EditorState>): EditorState {
  const next = { ...state, ...partial };
  if (next.kind === 'pdf') return { ...next, isDirty: false };
  const hash = contentHash(editorPayload(next));
  return { ...next, contentHash: hash, isDirty: hash !== (next.cleanHash || '') };
}

export function blankTab(kind: DocumentKind, openNames: string[]): EditorState {
  const fileName = nextFileName(kind === 'pdf' ? 'document' : kind, openNames);
  const format: SupportedFormat = kind === 'spreadsheet' ? 'xlsx' : kind === 'presentation' ? 'pptx' : 'docx';
  const base: EditorState = {
    kind: kind === 'pdf' ? 'document' : kind,
    fileName,
    format,
    isDirty: false,
    documentContent: kind === 'document' || kind === 'pdf' ? defaultDocumentModel : undefined,
    spreadsheetData: kind === 'spreadsheet' ? [createEmptySheet('Sheet1')] : undefined,
    presentationData:
      kind === 'presentation'
        ? { title: fileName.replace(/\.pptx$/i, ''), slides: [createEmptySlide(1)] }
        : undefined,
  };
  return stampClean(base);
}

export function tabFromDraft(draft: DraftItem): EditorState {
  const base: EditorState = {
    id: draft.id || newTabId(),
    kind: draft.kind,
    fileName: draft.name,
    format: draft.format,
    filePath: draft.path,
    isDirty: true,
    cleanHash: draft.cleanHash || '',
    diskStamp: draft.diskStamp,
    documentContent: draft.kind === 'document' ? draft.content : undefined,
    spreadsheetData: draft.kind === 'spreadsheet' ? draft.content : undefined,
    presentationData: draft.kind === 'presentation' ? draft.content : undefined,
  };
  const hash = base.kind === 'pdf' ? 'pdf' : contentHash(editorPayload(base));
  const dirty = !draft.cleanHash || hash !== draft.cleanHash;
  return { ...base, contentHash: hash, isDirty: dirty };
}

export function draftContent(state: EditorState): unknown {
  return editorPayload(state);
}
