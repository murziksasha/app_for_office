import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  importXlsx,
  exportXlsx,
  importCsvTsv,
  exportCsvTsv,
  parseDelimitedText,
  serializeDelimitedText,
} from '../src/spreadsheet/adapters';

describe('Spreadsheet Adapters (XLSX, CSV, TSV)', () => {
  it('reads pre-generated sample.xlsx fixture', async () => {
    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/sample.xlsx');
    const buffer = fs.readFileSync(fixturePath);
    const { sheets, report } = await importXlsx(buffer.buffer as ArrayBuffer, 'sample.xlsx');

    expect(sheets.length).toBe(1);
    expect(sheets[0].name).toBe('Financials');
    expect(sheets[0].data[0][0]?.v).toBe('Category');
    expect(sheets[0].data[1][0]?.v).toBe('Revenue');
    expect(sheets[0].data[1][1]?.v).toBe(10000);
    expect(sheets[0].data[1][3]?.f).toBe('=SUM(B2:C2)');
    expect(report.format).toBe('xlsx');
  });

  it('round-trips sheets data via exportXlsx and importXlsx', async () => {
    const originalSheets = [
      {
        name: 'Budget',
        id: 's1',
        status: 1,
        order: 0,
        row: 20,
        column: 10,
        data: [
          [{ v: 'Item', bl: 1 }, { v: 'Cost', bl: 1 }],
          [{ v: 'Hosting' }, { v: 50 }],
          [{ v: 'Domain' }, { v: 12 }],
        ],
      },
    ];

    const blob = await exportXlsx(originalSheets);
    expect(blob.size).toBeGreaterThan(100);

    const buffer = await blob.arrayBuffer();
    const { sheets } = await importXlsx(buffer, 'roundtrip.xlsx');

    expect(sheets[0].name).toBe('Budget');
    expect(sheets[0].data[0][0]?.v).toBe('Item');
    expect(sheets[0].data[1][1]?.v).toBe(50);
  });

  it('correctly parses and serializes CSV with quotes and commas', () => {
    const csv = 'City,"Population, 2024",Country\r\n"New York, NY","8,335,897","United States"\r\nLondon,8982000,"UK"';
    const grid = parseDelimitedText(csv, ',');
    expect(grid.length).toBe(3);
    expect(grid[0]).toEqual(['City', 'Population, 2024', 'Country']);
    expect(grid[1][0]).toBe('New York, NY');
    expect(grid[1][1]).toBe('8,335,897');

    const serialized = serializeDelimitedText(grid, ',');
    expect(serialized).toContain('"Population, 2024"');
    expect(serialized).toContain('"New York, NY"');
  });

  it('imports and exports CSV and TSV into FortuneSheet structure', () => {
    const csvContent = 'A,B,C\r\n10,20,30\r\n40,50,60';
    const { sheets } = importCsvTsv(csvContent, 'data.csv', false);

    expect(sheets[0].data[0][0]?.v).toBe('A');
    expect(sheets[0].data[1][0]?.v).toBe(10);
    expect(sheets[0].data[1][1]?.v).toBe(20);

    const exported = exportCsvTsv(sheets[0], false);
    expect(exported).toContain('A,B,C');
    expect(exported).toContain('10,20,30');
  });
});

