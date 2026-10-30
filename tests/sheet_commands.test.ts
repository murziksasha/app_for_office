import { describe, expect, it } from 'vitest';
import type { WorkbookInstance } from '@fortune-sheet/react';
import {
  clearSheetSelection,
  deleteSheetAxis,
  insertSheetAxis,
  setSheetNumberFormat,
  setSheetStyle,
  toggleSheetMark,
  toggleSheetWrap,
} from '../src/spreadsheet/sheetCommands';

function fakeApi(selection?: { row: number[]; column: number[] }) {
  const calls: Array<{ name: string; args: unknown[] }> = [];
  const values: Record<string, unknown> = { bl: 0, tb: '0' };
  const api = {
    getSelection: () => (selection ? [selection] : undefined),
    getCellValue: (_row: number, _column: number, options?: { type?: string }) => values[options?.type || ''],
    setCellFormatByRange: (attr: string, value: unknown, range: unknown) => {
      calls.push({ name: 'setCellFormatByRange', args: [attr, value, range] });
      values[attr] = value;
    },
    insertRowOrColumn: (...args: unknown[]) => calls.push({ name: 'insertRowOrColumn', args }),
    deleteRowOrColumn: (...args: unknown[]) => calls.push({ name: 'deleteRowOrColumn', args }),
    clearCell: (...args: unknown[]) => calls.push({ name: 'clearCell', args }),
  };
  return { api: api as unknown as WorkbookInstance, calls, values };
}

describe('sheet ribbon commands', () => {
  it('does nothing when no cell is selected', () => {
    const { api, calls } = fakeApi();
    toggleSheetMark(api, 'bl');
    setSheetNumberFormat(api, '0.00', 'n');
    insertSheetAxis(api, 'row');
    expect(calls).toEqual([]);
  });

  it('toggles bold and wrap on the selection', () => {
    const range = { row: [1, 2], column: [0, 0] };
    const { api, calls, values } = fakeApi(range);
    toggleSheetMark(api, 'bl');
    toggleSheetWrap(api);
    expect(calls[0]).toEqual({ name: 'setCellFormatByRange', args: ['bl', 1, range] });
    expect(calls[1]).toEqual({ name: 'setCellFormatByRange', args: ['tb', '1', range] });
    expect(values.bl).toBe(1);
  });

  it('sets alignment, number format, and row edits from the selection edges', () => {
    const range = { row: [4, 6], column: [2, 3] };
    const { api, calls } = fakeApi(range);
    setSheetStyle(api, 'ht', 1);
    setSheetNumberFormat(api, '0%', 'n');
    insertSheetAxis(api, 'row');
    deleteSheetAxis(api, 'column');
    clearSheetSelection(api);
    expect(calls[0].args[0]).toBe('ht');
    expect(calls[0].args[1]).toBe(1);
    expect(calls[1].args).toEqual(['ct', { fa: '0%', t: 'n' }, range]);
    expect(calls[2]).toEqual({ name: 'insertRowOrColumn', args: ['row', 4, 1, 'lefttop'] });
    expect(calls[3]).toEqual({ name: 'deleteRowOrColumn', args: ['column', 2, 3] });
    expect(calls.filter((call) => call.name === 'clearCell')).toHaveLength(6);
  });
});
