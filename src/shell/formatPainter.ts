import { useEffect, useState } from 'react';

export interface DocumentFormatPayload {
  marks: Array<{ type: string; attrs?: Record<string, any> }>;
  textAlign?: string;
  lineSpacing?: number | string;
}

export interface SheetFormatPayload {
  bl?: number | boolean;
  it?: number | boolean;
  un?: number | boolean;
  fc?: string;
  bg?: string;
  ht?: number;
  tb?: string | number;
  numberFormat?: { fa: string; t: string };
}

export interface FormatPainterState {
  armed: boolean;
  locked: boolean;
  docPayload: DocumentFormatPayload | null;
  sheetPayload: SheetFormatPayload | null;
}

export class FormatPainterManager {
  private state: FormatPainterState = {
    armed: false,
    locked: false,
    docPayload: null,
    sheetPayload: null,
  };
  private listeners = new Set<() => void>();

  getState(): FormatPainterState {
    return { ...this.state };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  arm(payload: { doc?: DocumentFormatPayload | null; sheet?: SheetFormatPayload | null }) {
    if (!this.state.armed) {
      // First click: arm
      this.state = {
        armed: true,
        locked: false,
        docPayload: payload.doc || null,
        sheetPayload: payload.sheet || null,
      };
    } else if (!this.state.locked) {
      // Second click: lock
      this.state = {
        ...this.state,
        locked: true,
      };
    } else {
      // Third click: disarm and unlock
      this.cancel();
      return;
    }
    this.notify();
  }

  cancel() {
    this.state = {
      armed: false,
      locked: false,
      docPayload: null,
      sheetPayload: null,
    };
    this.notify();
  }

  didApply(): boolean {
    if (!this.state.armed) return false;
    if (!this.state.locked) {
      this.state = {
        armed: false,
        locked: false,
        docPayload: null,
        sheetPayload: null,
      };
      this.notify();
      return false;
    }
    // Locked stays armed after apply!
    return true;
  }
}

export const formatPainter = new FormatPainterManager();

export function captureDocumentFormat(editor: any): DocumentFormatPayload | null {
  if (!editor || !editor.state) return null;
  const { $from } = editor.state.selection;
  const marks = $from.marks().map((m: any) => ({
    type: m.type.name,
    attrs: m.attrs && Object.keys(m.attrs).length > 0 ? { ...m.attrs } : undefined,
  }));
  const textAlign = $from.parent?.attrs?.textAlign || undefined;
  const lineSpacing = $from.parent?.attrs?.lineSpacing || undefined;

  return {
    marks,
    textAlign,
    lineSpacing,
  };
}

export function applyDocumentFormat(editor: any, payload: DocumentFormatPayload): void {
  if (!editor || !payload) return;
  const { from, to } = editor.state.selection;
  if (from === to) return;

  const chain = editor.chain().focus();
  chain.unsetAllMarks();

  for (const mark of payload.marks) {
    if (mark.type === 'bold') chain.setBold();
    else if (mark.type === 'italic') chain.setItalic();
    else if (mark.type === 'underline') chain.setUnderline();
    else if (mark.type === 'strike') chain.setStrike();
    else if (mark.type === 'textStyle' && mark.attrs?.color) chain.setColor(mark.attrs.color);
    else if (mark.type === 'highlight' && mark.attrs?.color) chain.setHighlight({ color: mark.attrs.color });
    else if (mark.attrs) chain.setMark(mark.type, mark.attrs);
    else chain.setMark(mark.type);
  }

  if (payload.textAlign) {
    chain.setTextAlign(payload.textAlign);
  }
  if (payload.lineSpacing && typeof chain.setLineSpacing === 'function') {
    chain.setLineSpacing(payload.lineSpacing);
  }

  chain.run();
}

export function captureSheetFormat(api: any): SheetFormatPayload | null {
  if (!api) return null;
  const sel = api.getSelection()?.[0];
  if (!sel?.row?.length || !sel.column?.length) return null;
  const r = Math.min(...sel.row);
  const c = Math.min(...sel.column);

  let cell: any = null;
  const sheet = api.getSheet?.();
  if (sheet?.data?.[r]?.[c]) {
    cell = sheet.data[r][c];
  } else if (api.getCellValue) {
    cell = api.getCellValue(r, c) || {};
  }
  if (!cell) return null;

  const payload: SheetFormatPayload = {};
  if (cell.bl !== undefined) payload.bl = cell.bl;
  if (cell.it !== undefined) payload.it = cell.it;
  if (cell.un !== undefined) payload.un = cell.un;
  if (cell.fc !== undefined) payload.fc = cell.fc;
  if (cell.bg !== undefined) payload.bg = cell.bg;
  if (cell.ht !== undefined) payload.ht = cell.ht;
  if (cell.tb !== undefined) payload.tb = cell.tb;
  if (cell.ct?.fa) {
    payload.numberFormat = { fa: cell.ct.fa, t: cell.ct.t || 'n' };
  }
  return payload;
}

export function applySheetFormat(api: any, payload: SheetFormatPayload): void {
  if (!api || !payload) return;
  const sel = api.getSelection()?.[0];
  if (!sel?.row?.length || !sel.column?.length) return;
  const range = { row: sel.row, column: sel.column };

  if (payload.bl !== undefined) api.setCellFormatByRange?.('bl', payload.bl ? 1 : 0, range);
  if (payload.it !== undefined) api.setCellFormatByRange?.('it', payload.it ? 1 : 0, range);
  if (payload.un !== undefined) api.setCellFormatByRange?.('un', payload.un ? 1 : 0, range);
  if (payload.fc !== undefined) api.setCellFormatByRange?.('fc', payload.fc, range);
  if (payload.bg !== undefined) api.setCellFormatByRange?.('bg', payload.bg, range);
  if (payload.ht !== undefined) api.setCellFormatByRange?.('ht', payload.ht, range);
  if (payload.tb !== undefined) api.setCellFormatByRange?.('tb', payload.tb, range);
  if (payload.numberFormat) {
    api.setCellFormatByRange?.('ct', payload.numberFormat, range);
  }
}

export function useFormatPainter(): FormatPainterState {
  const [state, setState] = useState<FormatPainterState>(() => formatPainter.getState());
  useEffect(() => {
    return formatPainter.subscribe(() => setState(formatPainter.getState()));
  }, []);
  return state;
}
