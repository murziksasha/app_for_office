import { describe, it, expect } from 'vitest';
import {
  calculateFitWidthScale,
  calculateSheetPageRowSlices,
  defaultPrintSetup,
  SheetPrintSetup,
} from '../src/spreadsheet/sheetPrint';

describe('Spreadsheet Print Setup Math', () => {
  it('defaultPrintSetup initializes with all false flags', () => {
    expect(defaultPrintSetup).toEqual({
      fitWidth: false,
      repeatHeaderRow: false,
      gridlines: false,
    });
  });

  describe('calculateFitWidthScale', () => {
    it('returns 1.0 when fitWidth is false regardless of widths', () => {
      expect(calculateFitWidthScale(1000, 500, false)).toBe(1.0);
      expect(calculateFitWidthScale(200, 500, false)).toBe(1.0);
    });

    it('scales down wide columns when fitWidth is true', () => {
      expect(calculateFitWidthScale(1000, 500, true)).toBeCloseTo(0.5, 3);
      expect(calculateFitWidthScale(800, 400, true)).toBeCloseTo(0.5, 3);
      expect(calculateFitWidthScale(600, 400, true)).toBeCloseTo(0.6667, 3);
    });

    it('caps scaling at 1.0 when columns are narrower than page width', () => {
      expect(calculateFitWidthScale(300, 500, true)).toBe(1.0);
      expect(calculateFitWidthScale(500, 500, true)).toBe(1.0);
    });

    it('handles zero or negative widths safely', () => {
      expect(calculateFitWidthScale(0, 500, true)).toBe(1.0);
      expect(calculateFitWidthScale(500, 0, true)).toBe(1.0);
    });
  });

  describe('calculateSheetPageRowSlices (repeatHeaderRow calculation)', () => {
    it('paginates sequentially when repeatHeaderRow is false', () => {
      const slices = calculateSheetPageRowSlices(10, 4, false);
      expect(slices).toEqual([
        { pageIndex: 0, startRow: 0, endRow: 3 },
        { pageIndex: 1, startRow: 4, endRow: 7 },
        { pageIndex: 2, startRow: 8, endRow: 9 },
      ]);
    });

    it('repeats header row 0 at the top of each page when repeatHeaderRow is true', () => {
      const slices = calculateSheetPageRowSlices(10, 4, true);
      expect(slices).toEqual([
        { pageIndex: 0, headerRow: 0, startRow: 1, endRow: 3 },
        { pageIndex: 1, headerRow: 0, startRow: 4, endRow: 6 },
        { pageIndex: 2, headerRow: 0, startRow: 7, endRow: 9 },
      ]);
    });

    it('handles single row or empty rows edge cases', () => {
      expect(calculateSheetPageRowSlices(0, 5, true)).toEqual([]);
      expect(calculateSheetPageRowSlices(1, 5, true)).toEqual([
        { pageIndex: 0, startRow: 0, endRow: 0 },
      ]);
    });

    it('handles total rows fitting exactly on one page with repeatHeaderRow', () => {
      const slices = calculateSheetPageRowSlices(4, 5, true);
      expect(slices).toEqual([
        { pageIndex: 0, headerRow: 0, startRow: 1, endRow: 3 },
      ]);
    });
  });
});

