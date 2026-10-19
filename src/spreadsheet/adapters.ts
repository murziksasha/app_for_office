import ExcelJS from 'exceljs';
import { ImportReport, ImportWarning } from '../types';

export interface FortuneCell {
  v?: any;
  m?: string;
  f?: string;
  bl?: number; // 1 for bold
  it?: number; // 1 for italic
  fc?: string; // font color
  bg?: string; // bg color
  fs?: number; // font size
  ff?: string; // font family
  ht?: number; // 0 center, 1 left, 2 right
  vt?: number; // 0 middle, 1 top, 2 bottom
  ct?: { fa: string; t: string };
}

export interface FortuneSheetData {
  name: string;
  id: string;
  status: number;
  order: number;
  row: number;
  column: number;
  data: (FortuneCell | null)[][];
  config?: {
    columnlen?: Record<string, number>;
    rowlen?: Record<string, number>;
    merge?: Record<string, any>;
  };
}

/**
 * Converts ARGB hex (e.g. 'FFFF0000') to standard CSS hex ('#FF0000')
 */
function argbToHex(argb?: string): string | undefined {
  if (!argb) return undefined;
  if (argb.length === 8) {
    return `#${argb.slice(2)}`;
  }
  if (argb.startsWith('#')) return argb;
  return `#${argb}`;
}

/**
 * Converts standard CSS hex ('#FF0000') to ExcelJS ARGB ('FFFF0000')
 */
function hexToArgb(hex?: string): string | undefined {
  if (!hex) return undefined;
  const clean = hex.replace('#', '');
  if (clean.length === 6) return `FF${clean.toUpperCase()}`;
  return clean.toUpperCase();
}

/**
 * Imports an XLSX buffer into FortuneSheet data format.
 */
export async function importXlsx(
  buffer: ArrayBuffer,
  fileName: string
): Promise<{ sheets: FortuneSheetData[]; report: ImportReport }> {
  const warnings: ImportWarning[] = [];
  const skippedFeatures: string[] = [];

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheets: FortuneSheetData[] = [];
  let sheetIndex = 0;

  workbook.eachSheet((worksheet, id) => {
    const rowCount = Math.max(worksheet.rowCount || 0, 50);
    const colCount = Math.max(worksheet.columnCount || 0, 26);

    // Initialize blank grid
    const data: (FortuneCell | null)[][] = [];
    for (let r = 0; r < rowCount; r++) {
      const rowArr: (FortuneCell | null)[] = [];
      for (let c = 0; c < colCount; c++) {
        rowArr.push(null);
      }
      data.push(rowArr);
    }

    const columnlen: Record<string, number> = {};

    // Capture column widths
    (worksheet.columns || []).forEach((col, idx) => {
      if (col.width) {
        columnlen[String(idx)] = Math.round(col.width * 8);
      }
    });

    // Populate cell data
    worksheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
      const rIdx = rowNum - 1;
      if (rIdx >= rowCount) return;

      row.eachCell({ includeEmpty: false }, (cell, colNum) => {
        const cIdx = colNum - 1;
        if (cIdx >= colCount) return;

        const fortuneCell: FortuneCell = {};
        const val = cell.value;

        if (val !== null && val !== undefined) {
          if (typeof val === 'object') {
            if ('formula' in val) {
              fortuneCell.f = `=${val.formula}`;
              fortuneCell.v = val.result !== undefined ? val.result : '';
              fortuneCell.m = String(fortuneCell.v);
            } else if ('richText' in val && Array.isArray((val as any).richText)) {
              fortuneCell.v = (val as any).richText.map((rt: any) => rt.text).join('');
              fortuneCell.m = String(fortuneCell.v);
            } else if (val instanceof Date) {
              fortuneCell.v = val.toISOString().split('T')[0];
              fortuneCell.m = String(fortuneCell.v);
            } else {
              fortuneCell.v = String(val);
              fortuneCell.m = String(val);
            }
          } else {
            fortuneCell.v = val;
            fortuneCell.m = String(val);
          }
        }

        // Font styling
        if (cell.font) {
          if (cell.font.bold) fortuneCell.bl = 1;
          if (cell.font.italic) fortuneCell.it = 1;
          if (cell.font.size) fortuneCell.fs = cell.font.size;
          if (cell.font.color && cell.font.color.argb) {
            fortuneCell.fc = argbToHex(cell.font.color.argb);
          }
          if (cell.font.name) fortuneCell.ff = cell.font.name;
        }

        // Fill / background styling
        if (cell.fill && cell.fill.type === 'pattern' && (cell.fill as any).fgColor?.argb) {
          fortuneCell.bg = argbToHex((cell.fill as any).fgColor.argb);
        }

        // Alignment
        if (cell.alignment) {
          if (cell.alignment.horizontal === 'center') fortuneCell.ht = 0;
          else if (cell.alignment.horizontal === 'left') fortuneCell.ht = 1;
          else if (cell.alignment.horizontal === 'right') fortuneCell.ht = 2;

          if (cell.alignment.vertical === 'middle') fortuneCell.vt = 0;
          else if (cell.alignment.vertical === 'top') fortuneCell.vt = 1;
          else if (cell.alignment.vertical === 'bottom') fortuneCell.vt = 2;
        }

        if (cell.numFmt) {
          fortuneCell.ct = { fa: cell.numFmt, t: typeof fortuneCell.v === 'number' ? 'n' : 's' };
        }

        data[rIdx][cIdx] = fortuneCell;
      });
    });

    sheets.push({
      name: worksheet.name || `Sheet${sheetIndex + 1}`,
      id: `sheet_${id || sheetIndex + 1}`,
      status: sheetIndex === 0 ? 1 : 0,
      order: sheetIndex,
      row: rowCount,
      column: colCount,
      data,
      config: {
        columnlen,
      },
    });

    sheetIndex++;
  });

  if (sheets.length === 0) {
    // Empty default sheet
    sheets.push(createEmptySheet('Sheet1'));
  }

  // Detect skipped features in workbook
  const rawXmls = (workbook as any).model;
  if (rawXmls?.pivotTables?.length) {
    skippedFeatures.push('Pivot Tables');
    warnings.push({ item: 'Pivot Tables', reason: 'Pivot tables are not interactive in this version' });
  }

  return {
    sheets,
    report: {
      fileName,
      format: 'xlsx',
      importedAt: new Date().toISOString(),
      warnings,
      skippedFeatures,
    },
  };
}

/**
 * Exports FortuneSheet data to an XLSX blob.
 */
export async function exportXlsx(sheets: FortuneSheetData[]): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();

  sheets.forEach((sheet) => {
    const ws = workbook.addWorksheet(sheet.name || 'Sheet1');

    // Column widths
    if (sheet.config?.columnlen) {
      Object.entries(sheet.config.columnlen).forEach(([colIdx, widthPx]) => {
        const col = ws.getColumn(parseInt(colIdx, 10) + 1);
        col.width = Math.max(Math.round(widthPx / 8), 8);
      });
    }

    const rowCount = sheet.data?.length || 0;
    for (let r = 0; r < rowCount; r++) {
      const row = sheet.data[r];
      if (!row) continue;
      const excelRow = ws.getRow(r + 1);

      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (!cell) continue;

        const excelCell = excelRow.getCell(c + 1);

        if (cell.f) {
          // Strip leading '=' if present for ExcelJS formula
          const formulaStr = cell.f.startsWith('=') ? cell.f.slice(1) : cell.f;
          excelCell.value = {
            formula: formulaStr,
            result: cell.v !== undefined ? cell.v : undefined,
          };
        } else if (cell.v !== undefined && cell.v !== null) {
          excelCell.value = cell.v;
        }

        // Formatting
        if (cell.bl || cell.it || cell.fc || cell.fs || cell.ff) {
          excelCell.font = {
            bold: !!cell.bl,
            italic: !!cell.it,
            size: cell.fs || 11,
            name: cell.ff || 'Calibri',
            color: cell.fc ? { argb: hexToArgb(cell.fc) } : undefined,
          };
        }

        if (cell.bg) {
          excelCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: hexToArgb(cell.bg) },
          };
        }

        if (cell.ht !== undefined || cell.vt !== undefined) {
          excelCell.alignment = {
            horizontal: cell.ht === 0 ? 'center' : cell.ht === 1 ? 'left' : cell.ht === 2 ? 'right' : undefined,
            vertical: cell.vt === 0 ? 'middle' : cell.vt === 1 ? 'top' : cell.vt === 2 ? 'bottom' : undefined,
          };
        }

        if (cell.ct?.fa) {
          excelCell.numFmt = cell.ct.fa;
        }
      }
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Creates a blank sheet template.
 */
export function createEmptySheet(name = 'Sheet1'): FortuneSheetData {
  const row = 60;
  const column = 26;
  const data: (FortuneCell | null)[][] = [];
  for (let r = 0; r < row; r++) {
    const rowArr: (FortuneCell | null)[] = [];
    for (let c = 0; c < column; c++) {
      rowArr.push(null);
    }
    data.push(rowArr);
  }
  return {
    name,
    id: `sheet_${Date.now()}`,
    status: 1,
    order: 0,
    row,
    column,
    data,
  };
}

/**
 * RFC 4180 CSV / TSV parser supporting quotes and newlines within fields.
 */
export function parseDelimitedText(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i += 2;
        continue;
      }
      insideQuotes = !insideQuotes;
      i++;
      continue;
    }

    if (!insideQuotes && char === delimiter) {
      currentRow.push(currentField);
      currentField = '';
      i++;
      continue;
    }

    if (!insideQuotes && (char === '\r' || char === '\n')) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentField);
      currentField = '';
      if (currentRow.length > 0 || rows.length > 0) {
        rows.push(currentRow);
      }
      currentRow = [];
      i++;
      continue;
    }

    currentField += char;
    i++;
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Serializes a 2D string grid into RFC 4180 CSV / TSV string.
 */
export function serializeDelimitedText(grid: string[][], delimiter = ','): string {
  return grid
    .map((row) =>
      row
        .map((field) => {
          const str = field ?? '';
          if (str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(delimiter)
    )
    .join('\r\n');
}

/**
 * Imports CSV/TSV into FortuneSheet format.
 */
export function importCsvTsv(
  content: string,
  fileName: string,
  isTsv = false
): { sheets: FortuneSheetData[]; report: ImportReport } {
  const delimiter = isTsv ? '\t' : ',';
  const grid = parseDelimitedText(content, delimiter);

  const rowCount = Math.max(grid.length + 10, 50);
  const maxCols = grid.reduce((max, r) => Math.max(max, r.length), 0);
  const colCount = Math.max(maxCols + 5, 26);

  const data: (FortuneCell | null)[][] = [];
  for (let r = 0; r < rowCount; r++) {
    const rowArr: (FortuneCell | null)[] = [];
    const sourceRow = grid[r];
    for (let c = 0; c < colCount; c++) {
      if (sourceRow && c < sourceRow.length && sourceRow[c] !== '') {
        const val = sourceRow[c];
        const num = Number(val);
        const isNum = !isNaN(num) && val.trim() !== '';
        rowArr.push({
          v: isNum ? num : val,
          m: val,
        });
      } else {
        rowArr.push(null);
      }
    }
    data.push(rowArr);
  }

  const sheetName = fileName.replace(/\.[^/.]+$/, '') || 'Sheet1';
  return {
    sheets: [
      {
        name: sheetName,
        id: 'sheet_1',
        status: 1,
        order: 0,
        row: rowCount,
        column: colCount,
        data,
      },
    ],
    report: {
      fileName,
      format: isTsv ? 'tsv' : 'csv',
      importedAt: new Date().toISOString(),
      warnings: [],
      skippedFeatures: [],
    },
  };
}

/**
 * Exports active FortuneSheet data to CSV or TSV string.
 */
export function exportCsvTsv(sheet: FortuneSheetData, isTsv = false): string {
  const delimiter = isTsv ? '\t' : ',';
  const grid: string[][] = [];

  const rowCount = sheet.data?.length || 0;
  // Find highest row and col with data
  let lastRow = 0;
  let lastCol = 0;

  for (let r = 0; r < rowCount; r++) {
    const row = sheet.data[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell && (cell.v !== undefined || cell.m !== undefined)) {
        if (r > lastRow) lastRow = r;
        if (c > lastCol) lastCol = c;
      }
    }
  }

  for (let r = 0; r <= lastRow; r++) {
    const row = sheet.data[r];
    const rowValues: string[] = [];
    for (let c = 0; c <= lastCol; c++) {
      const cell = row ? row[c] : null;
      const str = cell ? (cell.m !== undefined ? cell.m : cell.v !== undefined ? String(cell.v) : '') : '';
      rowValues.push(str);
    }
    grid.push(rowValues);
  }

  return serializeDelimitedText(grid, delimiter);
}

