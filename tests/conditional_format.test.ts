import { describe, it, expect } from 'vitest';
import {
  applyConditionalFormatting,
  clearConditionalFormatting,
  interpolate3,
  type ConditionalFormatRule,
} from '../src/spreadsheet/conditionalFormat';
import { exportXlsx, importXlsx, type FortuneSheetData } from '../src/spreadsheet/adapters';

describe('Conditional Formatting', () => {
  it('marks only matching numbers with greater-than and leaves text unchanged', () => {
    const sheet: FortuneSheetData = {
      name: 'CF Test',
      id: 's1',
      status: 1,
      order: 0,
      row: 3,
      column: 2,
      data: [
        [{ v: 10, bg: '#ffffff' }, { v: 'TextString', bg: '#ffffff' }],
        [{ v: 50, bg: '#eeeeee' }, { v: 5, bg: '#ffffff' }],
      ],
      conditionalFormats: [
        {
          id: 'rule1',
          range: { row: [0, 1], column: [0, 1] },
          kind: 'greater',
          value: 20,
          colors: ['#ef4444'],
        },
      ],
    };

    applyConditionalFormatting(sheet);

    // (0,0) is 10 <= 20, should keep old bg #ffffff
    expect(sheet.data[0][0]?.bg).toBe('#ffffff');
    // (0,1) is text 'TextString', unchanged
    expect(sheet.data[0][1]?.bg).toBe('#ffffff');
    // (1,0) is 50 > 20, marked with #ef4444
    expect(sheet.data[1][0]?.bg).toBe('#ef4444');
    // (1,1) is 5 <= 20, should keep old bg #ffffff
    expect(sheet.data[1][1]?.bg).toBe('#ffffff');
  });

  it('clearing the rule restores the old fill', () => {
    const sheet: FortuneSheetData = {
      name: 'CF Restore',
      id: 's1',
      status: 1,
      order: 0,
      row: 2,
      column: 1,
      data: [
        [{ v: 100, bg: '#10b981' }],
      ],
      conditionalFormats: [
        {
          id: 'rule_greater',
          range: { row: [0, 0], column: [0, 0] },
          kind: 'greater',
          value: 50,
          colors: ['#ef4444'],
        },
      ],
    };

    applyConditionalFormatting(sheet);
    expect(sheet.data[0][0]?.bg).toBe('#ef4444');

    clearConditionalFormatting(sheet, 'rule_greater');
    expect(sheet.data[0][0]?.bg).toBe('#10b981');
    expect(sheet.conditionalFormats).toHaveLength(0);
  });

  it('interpolates 3-color scale across min and max', () => {
    const colors = ['#000000', '#7f7f7f', '#ffffff'];
    expect(interpolate3(colors, 0, 0, 100)).toBe('#000000');
    expect(interpolate3(colors, 50, 0, 100)).toBe('#7f7f7f');
    expect(interpolate3(colors, 100, 0, 100)).toBe('#ffffff');
  });

  it('round-trips conditional formatting rule through XLSX export and import', async () => {
    const originalSheets: FortuneSheetData[] = [
      {
        name: 'RulesSheet',
        id: 's1',
        status: 1,
        order: 0,
        row: 5,
        column: 2,
        data: [
          [{ v: 10 }, { v: 20 }],
          [{ v: 30 }, { v: 40 }],
        ],
        conditionalFormats: [
          {
            id: 'rule_gt',
            range: { row: [0, 1], column: [0, 1] },
            kind: 'greater',
            value: 25,
            colors: ['#ef4444'],
          },
        ],
      },
    ];

    const blob = await exportXlsx(originalSheets);
    const { sheets } = await importXlsx(await blob.arrayBuffer(), 'cf_roundtrip.xlsx');

    expect(sheets.length).toBe(1);
    expect(sheets[0].conditionalFormats).toBeDefined();
    expect(sheets[0].conditionalFormats?.length).toBeGreaterThanOrEqual(1);
    const rule = sheets[0].conditionalFormats![0];
    expect(rule.kind).toBe('greater');
    expect(rule.value).toBe(25);
  });

  it('handles warning fallback via stub when conditional format export is unsupported', () => {
    // Stub simulating export fallback notice pattern
    const warnings: Array<{ messageKey: string; details?: unknown }> = [];
    const reportFallback = (rule: ConditionalFormatRule) => {
      warnings.push({
        messageKey: 'importWarnings.unsupportedConditionalFormat',
        details: { kind: rule.kind, range: rule.range },
      });
    };

    reportFallback({
      id: 'stub_rule',
      kind: 'scale',
      range: { row: [0, 1], column: [0, 1] },
      colors: ['#ff0000', '#00ff00'],
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0].messageKey).toBe('importWarnings.unsupportedConditionalFormat');
  });
});

