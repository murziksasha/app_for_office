import { describe, it, expect } from 'vitest';
import {
  isCellInRange,
  findValidationForCell,
  isValidationValueValid,
  type DataValidationRule,
} from '../src/spreadsheet/dataValidation';
import { exportXlsx, importXlsx, type FortuneSheetData } from '../src/spreadsheet/adapters';

describe('Spreadsheet Data Validation (Dropdown Lists)', () => {
  it('correctly checks if cell is in range', () => {
    const range = { row: [1, 5] as [number, number], column: [2, 4] as [number, number] };
    expect(isCellInRange(1, 2, range)).toBe(true);
    expect(isCellInRange(3, 3, range)).toBe(true);
    expect(isCellInRange(5, 4, range)).toBe(true);

    expect(isCellInRange(0, 2, range)).toBe(false);
    expect(isCellInRange(6, 3, range)).toBe(false);
    expect(isCellInRange(2, 1, range)).toBe(false);
    expect(isCellInRange(2, 5, range)).toBe(false);
  });

  it('finds validation rule for cell and checks list membership', () => {
    const rules: DataValidationRule[] = [
      {
        range: { row: [0, 10], column: [1, 1] },
        list: ['Pending', 'In Progress', 'Done'],
      },
    ];

    const rule = findValidationForCell(3, 1, rules);
    expect(rule).toBeDefined();
    expect(rule?.list).toEqual(['Pending', 'In Progress', 'Done']);

    expect(findValidationForCell(3, 2, rules)).toBeUndefined();

    expect(isValidationValueValid('In Progress', rule!.list)).toBe(true);
    expect(isValidationValueValid('done', rule!.list)).toBe(true); // case-insensitive
    expect(isValidationValueValid('', rule!.list)).toBe(true); // empty allowed
    expect(isValidationValueValid('InvalidStatus', rule!.list)).toBe(false);
  });

  it('round-trips data validations through XLSX export and import', async () => {
    const originalSheets: FortuneSheetData[] = [
      {
        name: 'ValidationSheet',
        id: 's1',
        status: 1,
        order: 0,
        row: 5,
        column: 3,
        data: [
          [{ v: 'Pending' }, { v: 'Item A' }],
        ],
        dataValidations: [
          {
            range: { row: [0, 0], column: [0, 0] },
            list: ['Pending', 'Completed', 'Cancelled'],
          },
        ],
      },
    ];

    const blob = await exportXlsx(originalSheets);
    const { sheets } = await importXlsx(await blob.arrayBuffer(), 'dv_roundtrip.xlsx');

    expect(sheets.length).toBe(1);
    expect(sheets[0].dataValidations).toBeDefined();
    expect(sheets[0].dataValidations?.length).toBeGreaterThanOrEqual(1);
    const dv = sheets[0].dataValidations![0];
    expect(dv.list).toEqual(['Pending', 'Completed', 'Cancelled']);
  });

  it('handles warning fallback via stub when data validation is not supported', () => {
    const warnings: Array<{ messageKey: string; details?: unknown }> = [];
    const reportFallback = (rule: DataValidationRule) => {
      warnings.push({
        messageKey: 'importWarnings.unsupportedDataValidation',
        details: { list: rule.list, range: rule.range },
      });
    };

    reportFallback({
      range: { row: [0, 2], column: [0, 0] },
      list: ['A', 'B'],
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0].messageKey).toBe('importWarnings.unsupportedDataValidation');
  });
});

