import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
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

  it('preserves thousands number format across xlsx export and import', async () => {
    const originalSheets = [
      {
        name: 'Numbers',
        id: 's1',
        status: 1,
        order: 0,
        row: 10,
        column: 5,
        data: [
          [{ v: 1234567, ct: { fa: '#,##0', t: 'n' } }],
        ],
      },
    ];

    const blob = await exportXlsx(originalSheets);
    const { sheets } = await importXlsx(await blob.arrayBuffer(), 'thousands.xlsx');

    expect(sheets[0].data[0][0]?.v).toBe(1234567);
    expect(sheets[0].data[0][0]?.ct?.fa).toBe('#,##0');
  });

  it('preserves sheet color and tab order across xlsx export and import', async () => {
    const originalSheets = [
      {
        name: 'First',
        id: 's1',
        status: 1,
        order: 0,
        row: 10,
        column: 5,
        color: '#10b981',
        data: [[{ v: 'A' }]],
      },
      {
        name: 'Second',
        id: 's2',
        status: 0,
        order: 1,
        row: 10,
        column: 5,
        color: '#ef4444',
        data: [[{ v: 'B' }]],
      },
    ];

    const blob = await exportXlsx(originalSheets);
    const { sheets } = await importXlsx(await blob.arrayBuffer(), 'colors.xlsx');

    expect(sheets.length).toBe(2);
    expect(sheets[0].name).toBe('First');
    expect(sheets[0].color?.toLowerCase()).toBe('#10b981');
    expect(sheets[1].name).toBe('Second');
    expect(sheets[1].color?.toLowerCase()).toBe('#ef4444');
  });

  it('round-trips merge, freeze, border, wrap, underline, autofilter, and SUM', async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Budget');
    ws.getCell('A1').value = 'Item';
    ws.getCell('A1').font = { bold: true, underline: true };
    ws.mergeCells('A1:B1');
    ws.getCell('A2').value = 'Hosting';
    ws.getCell('A2').alignment = { wrapText: true };
    ws.getCell('A2').border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
    ws.getRow(2).height = 30;
    ws.getCell('B2').value = 50;
    ws.getCell('B3').value = 12;
    ws.getCell('B4').value = { formula: 'SUM(B2:B3)', result: 62 };
    ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];
    ws.autoFilter = 'A1:B4';

    const raw = await workbook.xlsx.writeBuffer();
    const { sheets } = await importXlsx(raw, 'layout.xlsx');

    expect(sheets[0].config?.merge?.['0_0']).toMatchObject({ r: 0, c: 0, rs: 1, cs: 2 });
    expect(sheets[0].data[0][0]?.un).toBe(1);
    expect(sheets[0].data[0][1]?.mc).toEqual({ r: 0, c: 0 });
    expect(sheets[0].data[1][0]?.tb).toBe('1');
    expect(sheets[0].config?.borderInfo?.[0]?.value?.t?.style).toBe(1);
    expect(sheets[0].config?.rowlen?.['1']).toBe(40);
    expect(sheets[0].frozen).toEqual({ type: 'rangeRow', range: { row_focus: 0, column_focus: 0 } });
    expect(sheets[0].filter_select).toEqual({ row: [0, 3], column: [0, 1] });
    expect(sheets[0].data[3][1]?.f).toBe('=SUM(B2:B3)');

    const blob = await exportXlsx(sheets);
    const again = await importXlsx(await blob.arrayBuffer(), 'again.xlsx');
    expect(again.sheets[0].config?.merge?.['0_0']).toMatchObject({ r: 0, c: 0, rs: 1, cs: 2 });
    expect(again.sheets[0].frozen?.type).toBe('rangeRow');
    expect(again.sheets[0].filter_select).toEqual({ row: [0, 3], column: [0, 1] });
    expect(again.sheets[0].data[1][0]?.tb).toBe('1');
    expect(again.sheets[0].data[0][0]?.un).toBe(1);
    expect(again.sheets[0].data[3][1]?.f).toBe('=SUM(B2:B3)');
    expect(again.sheets[0].config?.borderInfo?.some((border) => border.value?.l)).toBe(true);
    expect(again.sheets[0].config?.rowlen?.['1']).toBe(40);
  });

  it('reports charts, macros, and unknown functions', async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Sheet1');
    ws.getCell('A1').value = { formula: 'NOTAFUNCTION(A2)', result: 1 };
    const raw = await workbook.xlsx.writeBuffer();
    const zip = await JSZip.loadAsync(raw);
    zip.file('xl/charts/chart1.xml', '<chart/>');
    zip.file('xl/vbaProject.bin', 'not-a-macro');
    const packed = await zip.generateAsync({ type: 'arraybuffer' });
    const { sheets, report } = await importXlsx(packed, 'extras.xlsx');

    expect(report.skippedFeatures).toEqual(expect.arrayContaining(['Charts', 'Macros']));
    expect(report.warnings.some((warning) => warning.item === 'NOTAFUNCTION')).toBe(true);
    expect(sheets[0].data[0][0]?.f).toBe('=NOTAFUNCTION(A2)');
    expect(JSON.stringify(sheets)).not.toContain('vbaProject');
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

