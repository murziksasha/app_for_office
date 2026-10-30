import type { WorkbookInstance } from '@fortune-sheet/react';
import type { CellStyle } from '@fortune-sheet/core';

type StyleAttr = keyof CellStyle;

function selection(api: WorkbookInstance) {
  const sel = api.getSelection()?.[0];
  if (!sel?.row?.length || !sel.column?.length) return null;
  return { row: sel.row, column: sel.column };
}

function focusCell(api: WorkbookInstance) {
  const range = selection(api);
  if (!range) return null;
  return { range, row: Math.min(...range.row), column: Math.min(...range.column) };
}

export function toggleSheetMark(api: WorkbookInstance, attr: 'bl' | 'it' | 'un') {
  const cell = focusCell(api);
  if (!cell) return;
  const current = api.getCellValue(cell.row, cell.column, { type: attr });
  api.setCellFormatByRange(attr, current ? 0 : 1, cell.range);
}

export function setSheetStyle(api: WorkbookInstance, attr: StyleAttr, value: CellStyle[StyleAttr]) {
  const cell = focusCell(api);
  if (!cell) return;
  api.setCellFormatByRange(attr, value, cell.range);
}

export function toggleSheetWrap(api: WorkbookInstance) {
  const cell = focusCell(api);
  if (!cell) return;
  const current = api.getCellValue(cell.row, cell.column, { type: 'tb' });
  api.setCellFormatByRange('tb', current === '1' || current === 1 ? '0' : '1', cell.range);
}

export function setSheetNumberFormat(api: WorkbookInstance, fa: string, t: string) {
  const cell = focusCell(api);
  if (!cell) return;
  api.setCellFormatByRange('ct', { fa, t }, cell.range);
}

export function insertSheetAxis(api: WorkbookInstance, type: 'row' | 'column') {
  const cell = focusCell(api);
  if (!cell) return;
  const index = type === 'row' ? Math.min(...cell.range.row) : Math.min(...cell.range.column);
  api.insertRowOrColumn(type, index, 1, 'lefttop');
}

export function deleteSheetAxis(api: WorkbookInstance, type: 'row' | 'column') {
  const cell = focusCell(api);
  if (!cell) return;
  const indexes = type === 'row' ? cell.range.row : cell.range.column;
  api.deleteRowOrColumn(type, Math.min(...indexes), Math.max(...indexes));
}

export function clearSheetSelection(api: WorkbookInstance) {
  const cell = focusCell(api);
  if (!cell) return;
  const r0 = Math.min(...cell.range.row);
  const r1 = Math.max(...cell.range.row);
  const c0 = Math.min(...cell.range.column);
  const c1 = Math.max(...cell.range.column);
  for (let row = r0; row <= r1; row += 1) {
    for (let column = c0; column <= c1; column += 1) {
      api.clearCell(row, column);
    }
  }
}

function bounds(range: { row: number[]; column: number[] }) {
  return {
    r0: Math.min(...range.row),
    r1: Math.max(...range.row),
    c0: Math.min(...range.column),
    c1: Math.max(...range.column),
  };
}

function columnName(index: number): string {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

type GridCell = {
  v?: unknown;
  m?: unknown;
  f?: string;
  mc?: { rs?: number };
  ct?: { t?: string; s?: { v?: string }[] };
} | null;

function inlineText(cell: GridCell): string | null {
  if (cell?.ct?.t !== 'inlineStr' || !cell.ct.s) return null;
  return cell.ct.s.map((part) => part.v ?? '').join('');
}

function gridOf(api: WorkbookInstance): GridCell[][] | null {
  const data = api.getSheet()?.data;
  return data ? (data as GridCell[][]) : null;
}

function filled(grid: GridCell[][], row: number, column: number) {
  const cell = grid[row]?.[column];
  if (!cell) return false;
  const inline = inlineText(cell);
  return (cell.v != null && cell.v !== '') || (cell.m != null && cell.m !== '') || cell.f != null || (inline != null && inline !== '');
}

function regionAround(grid: GridCell[][], row: number, column: number) {
  if (!filled(grid, row, column)) return { r0: row, r1: row, c0: column, c1: column };
  const seen = new Set<string>();
  const stack: [number, number][] = [[row, column]];
  let r0 = row;
  let r1 = row;
  let c0 = column;
  let c1 = column;
  while (stack.length) {
    const [r, c] = stack.pop() as [number, number];
    const key = `${r}_${c}`;
    if (seen.has(key)) continue;
    if (r < 0 || c < 0 || Math.abs(r - row) > 500 || Math.abs(c - column) > 100) continue;
    if (!filled(grid, r, c)) continue;
    seen.add(key);
    r0 = Math.min(r0, r);
    r1 = Math.max(r1, r);
    c0 = Math.min(c0, c);
    c1 = Math.max(c1, c);
    stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
  }
  return { r0, r1, c0, c1 };
}

function normalizedRange(range: { row: number[]; column: number[] }) {
  const { r0, r1, c0, c1 } = bounds(range);
  return { row: [r0, r1], column: [c0, c1] };
}

export function mergeSheetSelection(api: WorkbookInstance) {
  const cell = focusCell(api);
  if (!cell) return;
  api.mergeCells([normalizedRange(cell.range)], 'merge-all');
}

export function unmergeSheetSelection(api: WorkbookInstance) {
  const cell = focusCell(api);
  if (!cell) return;
  api.cancelMerge([normalizedRange(cell.range)]);
}

export function setSheetFill(api: WorkbookInstance, color: string) {
  const cell = focusCell(api);
  if (!cell) return;
  api.setCellFormatByRange('bg', color, normalizedRange(cell.range));
}

export function setSheetBorder(api: WorkbookInstance, borderType: 'border-all' | 'border-none') {
  const cell = focusCell(api);
  if (!cell) return;
  const { r0, r1, c0, c1 } = bounds(cell.range);
  (api.setCellFormat as (row: number, column: number, attr: string, value: unknown) => void)(r0, c0, 'bd', {
    rangeType: 'range',
    borderType,
    color: '#000000',
    style: '1',
    range: [{ row: [r0, r1], column: [c0, c1] }],
  });
}

export function freezeSheet(api: WorkbookInstance, type: 'row' | 'column') {
  api.freeze(type, { row: 0, column: 0 });
}

// updateSheet assigns `.data` on the object we pass in. A later strict-mode
// replay freezes that object, so a plain sheet copy throws and drops the edit.
function commitSheet(api: WorkbookInstance, sheet: NonNullable<ReturnType<WorkbookInstance['getSheet']>>) {
  const { celldata: _celldata, ...rest } = sheet;
  const next = { ...rest };
  let data = next.data;
  Object.defineProperty(next, 'data', {
    configurable: true,
    enumerable: true,
    get: () => data,
    set: (value) => { data = value; },
  });
  api.updateSheet([next]);
}

export function unfreezeSheet(api: WorkbookInstance) {
  const sheet = api.getSheet();
  if (!sheet?.frozen) return;
  const next = { ...sheet };
  delete next.frozen;
  commitSheet(api, next);
}

function sortValue(cell: GridCell): unknown {
  if (!cell) return null;
  const inline = inlineText(cell);
  if (inline != null && inline !== '') return inline;
  if (cell.v != null && cell.v !== '') return cell.v;
  if (cell.m != null && cell.m !== '') return cell.m;
  return null;
}

function compareSort(a: unknown, b: unknown, asc: boolean): number {
  const aEmpty = a == null || a === '';
  const bEmpty = b == null || b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  const aNum = typeof a === 'number' ? a : typeof a === 'string' && /^-?\d+(?:\.\d+)?$/.test(a.trim()) ? Number(a) : null;
  const bNum = typeof b === 'number' ? b : typeof b === 'string' && /^-?\d+(?:\.\d+)?$/.test(b.trim()) ? Number(b) : null;
  if (aNum != null && bNum != null) return asc ? aNum - bNum : bNum - aNum;
  const cmp = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  return asc ? cmp : -cmp;
}

export function sortSheetSelection(api: WorkbookInstance, asc: boolean) {
  const grid = gridOf(api);
  const cell = focusCell(api);
  if (!grid || !cell) return;
  const selected = bounds(cell.range);
  const single = selected.r0 === selected.r1 && selected.c0 === selected.c1;
  const range = single ? regionAround(grid, selected.r0, selected.c0) : selected;
  const key = single ? selected.c0 - range.c0 : 0;
  let start = range.r0;
  const first = sortValue(grid[start]?.[range.c0 + key] ?? null);
  const laterNumeric = grid.slice(start + 1, range.r1 + 1).some((row) => typeof sortValue(row?.[range.c0 + key] ?? null) === 'number');
  if (typeof first === 'string' && laterNumeric) start += 1;
  if (start >= range.r1) return;

  const rows: GridCell[][] = [];
  for (let r = start; r <= range.r1; r += 1) {
    const slice: GridCell[] = [];
    for (let c = range.c0; c <= range.c1; c += 1) {
      const value = grid[r]?.[c] ?? null;
      if (value?.mc) return;
      slice.push(value ? { ...value } : null);
    }
    rows.push(slice);
  }
  rows.sort((a, b) => compareSort(sortValue(a[key] ?? null), sortValue(b[key] ?? null), asc));
  api.setCellValuesByRange(rows, { row: [start, range.r1], column: [range.c0, range.c1] });
}

export function toggleSheetFilter(api: WorkbookInstance) {
  const sheet = api.getSheet();
  const grid = gridOf(api);
  const cell = focusCell(api);
  if (!sheet?.id || !grid) return;
  if (sheet.filter_select) {
    const next = { ...sheet };
    delete next.filter_select;
    delete next.filter;
    commitSheet(api, next);
    return;
  }
  if (!cell) return;
  const selected = bounds(cell.range);
  const single = selected.r0 === selected.r1 && selected.c0 === selected.c1;
  const range = single ? regionAround(grid, selected.r0, selected.c0) : selected;
  commitSheet(api, {
    ...sheet,
    filter_select: { row: [range.r0, range.r1], column: [range.c0, range.c1] },
  });
}

function numericValue(cell: GridCell): number | null {
  const inline = inlineText(cell);
  const value = inline != null && inline !== '' ? inline : cell?.v;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim())) return Number(value);
  return null;
}

function mirrorFormulaBar(text: string) {
  const input = document.getElementById('luckysheet-functionbox-cell');
  if (input) input.textContent = text;
}

function numericRun(grid: GridCell[][], row: number, column: number, dr: number, dc: number) {
  let endRow = row + dr;
  let endCol = column + dc;
  if (numericValue(grid[endRow]?.[endCol] ?? null) == null) return null;
  let startRow = endRow;
  let startCol = endCol;
  while (numericValue(grid[startRow + dr]?.[startCol + dc] ?? null) != null) {
    startRow += dr;
    startCol += dc;
  }
  return { startRow, startCol, endRow, endCol };
}

export function autoSumSheet(api: WorkbookInstance) {
  const grid = gridOf(api);
  const cell = focusCell(api);
  if (!grid || !cell) return;
  const { r0, r1, c0, c1 } = bounds(cell.range);
  if (r0 === r1 && c0 === c1) {
    const above = numericRun(grid, r0, c0, -1, 0);
    if (above) {
      const formula = `=SUM(${columnName(c0)}${above.startRow + 1}:${columnName(c0)}${above.endRow + 1})`;
      api.setCellValue(r0, c0, formula);
      mirrorFormulaBar(formula);
      return;
    }
    const left = numericRun(grid, r0, c0, 0, -1);
    if (left) {
      const formula = `=SUM(${columnName(left.startCol)}${r0 + 1}:${columnName(left.endCol)}${r0 + 1})`;
      api.setCellValue(r0, c0, formula);
      mirrorFormulaBar(formula);
    }
    return;
  }
  if (r0 === r1) {
    api.setCellValue(r0, c1 + 1, `=SUM(${columnName(c0)}${r0 + 1}:${columnName(c1)}${r0 + 1})`);
    return;
  }
  for (let column = c0; column <= c1; column += 1) {
    api.setCellValue(r1 + 1, column, `=SUM(${columnName(column)}${r0 + 1}:${columnName(column)}${r1 + 1})`);
  }
}
