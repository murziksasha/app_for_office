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
