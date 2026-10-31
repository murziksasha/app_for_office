import { describe, expect, it } from 'vitest';
import type { WorkbookInstance } from '@fortune-sheet/react';
import {
  clearSheetSelection,
  deleteSheetAxis,
  fillSheetSelection,
  freezeAtSelectionMath,
  insertSheetAxis,
  selectionStats,
  setSheetNumberFormat,
  setSheetStyle,
  toggleSheetMark,
  toggleSheetWrap,
  validateSheetName,
} from '../src/spreadsheet/sheetCommands';

function fakeApi(selection?: { row: number[]; column: number[] }, initialCells?: Record<string, unknown>) {
  const calls: Array<{ name: string; args: unknown[] }> = [];
  const values: Record<string, unknown> = { bl: 0, tb: '0' };
  const cells: Record<string, unknown> = { ...(initialCells || {}) };
  const api = {
    getSelection: () => (selection ? [selection] : undefined),
    getCellValue: (row: number, column: number, options?: { type?: string }) => {
      if (options?.type) return values[options.type];
      return cells[`${row}_${column}`];
    },
    setCellValue: (row: number, column: number, value: unknown) => {
      calls.push({ name: 'setCellValue', args: [row, column, value] });
      cells[`${row}_${column}`] = value;
    },
    setCellFormatByRange: (attr: string, value: unknown, range: unknown) => {
      calls.push({ name: 'setCellFormatByRange', args: [attr, value, range] });
      values[attr] = value;
    },
    insertRowOrColumn: (...args: unknown[]) => calls.push({ name: 'insertRowOrColumn', args }),
    deleteRowOrColumn: (...args: unknown[]) => calls.push({ name: 'deleteRowOrColumn', args }),
    clearCell: (...args: unknown[]) => calls.push({ name: 'clearCell', args }),
  };
  return { api: api as unknown as WorkbookInstance, calls, values, cells };
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

  describe('selectionStats', () => {
    it('returns null when no cell or single cell is selected', () => {
      const { api: apiNoSel } = fakeApi();
      expect(selectionStats(apiNoSel)).toBeNull();

      const { api: apiSingle } = fakeApi({ row: [2, 2], column: [3, 3] });
      expect(selectionStats(apiSingle)).toBeNull();
    });

    it('covers empty cells, numbers, and text ignored by Sum', () => {
      // 3 rows, 2 columns = 6 cells
      // (0,0)=10, (0,1)="ignored text"
      // (1,0)=null, (1,1)=20
      // (2,0)="",   (2,1)=30
      const grid: Record<string, unknown> = {
        '0_0': 10,
        '0_1': 'ignored text',
        '1_0': null,
        '1_1': 20,
        '2_0': '',
        '2_1': 30,
      };

      const range = { row: [0, 2], column: [0, 1] };
      const api = {
        getSelection: () => [range],
        getCellValue: (r: number, c: number) => grid[`${r}_${c}`],
      } as unknown as WorkbookInstance;

      const stats = selectionStats(api);
      expect(stats).not.toBeNull();
      expect(stats?.cellCount).toBe(6);
      expect(stats?.count).toBe(4); // 10, 'ignored text', 20, 30
      expect(stats?.sum).toBe(60); // 10 + 20 + 30
      expect(stats?.average).toBe(20); // 60 / 3
    });
  });

  describe('fillSheetSelection', () => {
    it('repeats first cell in copy mode across the selection', () => {
      const range = { row: [0, 2], column: [0, 1] };
      const { api, cells } = fakeApi(range, { '0_0': 'SeedText' });
      fillSheetSelection(api, 'copy');
      expect(cells['0_0']).toBe('SeedText');
      expect(cells['0_1']).toBe('SeedText');
      expect(cells['1_0']).toBe('SeedText');
      expect(cells['1_1']).toBe('SeedText');
      expect(cells['2_0']).toBe('SeedText');
      expect(cells['2_1']).toBe('SeedText');
    });

    it('increments 1–3 series with step 2', () => {
      const range = { row: [0, 3], column: [0, 0] };
      const { api, cells } = fakeApi(range, { '0_0': 1, '1_0': 3 });
      fillSheetSelection(api, 'series');
      expect(cells['0_0']).toBe(1);
      expect(cells['1_0']).toBe(3);
      expect(cells['2_0']).toBe(5);
      expect(cells['3_0']).toBe(7);
    });

    it('increments single seed number with step 1', () => {
      const range = { row: [0, 2], column: [0, 0] };
      const { api, cells } = fakeApi(range, { '0_0': 10 });
      fillSheetSelection(api, 'series');
      expect(cells['0_0']).toBe(10);
      expect(cells['1_0']).toBe(11);
      expect(cells['2_0']).toBe(12);
    });

    it('increments a date series with single seed and with two seeds', () => {
      // Single seed (step 1 day)
      const range1 = { row: [0, 2], column: [0, 0] };
      const { api: api1, cells: cells1 } = fakeApi(range1, { '0_0': '2026-01-01' });
      fillSheetSelection(api1, 'series');
      expect(cells1['0_0']).toBe('2026-01-01');
      expect(cells1['1_0']).toBe('2026-01-02');
      expect(cells1['2_0']).toBe('2026-01-03');

      // Two seeds (step 2 days)
      const range2 = { row: [0, 3], column: [0, 0] };
      const { api: api2, cells: cells2 } = fakeApi(range2, { '0_0': '2026-01-01', '1_0': '2026-01-03' });
      fillSheetSelection(api2, 'series');
      expect(cells2['0_0']).toBe('2026-01-01');
      expect(cells2['1_0']).toBe('2026-01-03');
      expect(cells2['2_0']).toBe('2026-01-05');
      expect(cells2['3_0']).toBe('2026-01-07');
    });

    it('increments horizontal series across columns', () => {
      const range = { row: [0, 0], column: [0, 2] };
      const { api, cells } = fakeApi(range, { '0_0': 1 });
      fillSheetSelection(api, 'series');
      expect(cells['0_0']).toBe(1);
      expect(cells['0_1']).toBe(2);
      expect(cells['0_2']).toBe(3);
    });
  });

  describe('freezeAtSelectionMath', () => {
    it('returns null for top-left cell (0, 0)', () => {
      expect(freezeAtSelectionMath(0, 0)).toBeNull();
    });

    it('calculates rangeRow for row > 0, col = 0', () => {
      expect(freezeAtSelectionMath(2, 0)).toEqual({
        type: 'rangeRow',
        range: { row_focus: 1, column_focus: 0 },
      });
    });

    it('calculates rangeColumn for row = 0, col > 0', () => {
      expect(freezeAtSelectionMath(0, 3)).toEqual({
        type: 'rangeColumn',
        range: { row_focus: 0, column_focus: 2 },
      });
    });

    it('calculates rangeBoth for row > 0, col > 0', () => {
      expect(freezeAtSelectionMath(2, 3)).toEqual({
        type: 'rangeBoth',
        range: { row_focus: 1, column_focus: 2 },
      });
    });
  });

  describe('validateSheetName', () => {
    it('rejects an empty or whitespace name', () => {
      expect(validateSheetName('', ['Sheet1', 'Sheet2'])).toEqual({ valid: false, error: 'empty' });
      expect(validateSheetName('   ', ['Sheet1', 'Sheet2'])).toEqual({ valid: false, error: 'empty' });
    });

    it('rejects a duplicate name case-insensitively', () => {
      expect(validateSheetName('Sheet2', ['Sheet1', 'Sheet2'], 'Sheet1')).toEqual({ valid: false, error: 'duplicate' });
      expect(validateSheetName('sheet2', ['Sheet1', 'Sheet2'], 'Sheet1')).toEqual({ valid: false, error: 'duplicate' });
    });

    it('allows keeping current name or a unique new name', () => {
      expect(validateSheetName('Sheet1', ['Sheet1', 'Sheet2'], 'Sheet1')).toEqual({ valid: true });
      expect(validateSheetName('Expenses', ['Sheet1', 'Sheet2'], 'Sheet1')).toEqual({ valid: true });
    });
  });
});
