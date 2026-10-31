import ExcelJS from 'exceljs';
import { ImportReport, ImportWarning } from '../types';
import type { ConditionalFormatRule } from './conditionalFormat';
import type { DataValidationRule } from './dataValidation';
import type { SheetPrintSetup } from './sheetPrint';

export interface FortuneCell {
  v?: any;
  m?: string;
  f?: string;
  bl?: number; // 1 for bold
  it?: number; // 1 for italic
  un?: number; // 1 for underline
  tb?: string; // '1' when text wraps
  fc?: string; // font color
  bg?: string; // bg color
  fs?: number; // font size
  ff?: string; // font family
  ht?: number; // 0 center, 1 left, 2 right
  vt?: number; // 0 middle, 1 top, 2 bottom
  ct?: { fa: string; t: string };
  mc?: { r: number; c: number; rs?: number; cs?: number };
}

export interface FortuneMerge {
  r: number;
  c: number;
  rs: number;
  cs: number;
}

export interface FortuneBorderSide {
  style: number;
  color: string;
}

export interface FortuneBorder {
  rangeType: 'range' | 'cell';
  borderType?: string;
  color?: string;
  style?: string;
  range?: { row: number[]; column: number[] }[];
  value?: {
    row_index: number;
    col_index: number;
    l?: FortuneBorderSide;
    r?: FortuneBorderSide;
    t?: FortuneBorderSide;
    b?: FortuneBorderSide;
  };
}

export type FortuneFreezeType = 'row' | 'column' | 'both' | 'rangeRow' | 'rangeColumn' | 'rangeBoth';

export interface FortuneSheetData {
  name: string;
  id: string;
  status: number;
  order: number;
  row: number;
  column: number;
  data: (FortuneCell | null)[][];
  color?: string;
  frozen?: {
    type: FortuneFreezeType;
    range?: { row_focus: number; column_focus: number };
  };
  filter_select?: { row: number[]; column: number[] };
  conditionalFormats?: ConditionalFormatRule[];
  conditionalBase?: Record<string, string | undefined>;
  dataValidations?: DataValidationRule[];
  printSetup?: SheetPrintSetup;
  config?: {
    columnlen?: Record<string, number>;
    rowlen?: Record<string, number>;
    merge?: Record<string, FortuneMerge>;
    borderInfo?: FortuneBorder[];
    rowhidden?: Record<string, number>;
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

function columnIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseA1Range(ref: string): { r1: number; c1: number; r2: number; c2: number } | null {
  const clean = ref.replace(/\$/g, '').split('!').pop() || '';
  const match = clean.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!match) return null;
  return {
    c1: columnIndex(match[1]),
    r1: Number(match[2]) - 1,
    c2: columnIndex(match[3]),
    r2: Number(match[4]) - 1,
  };
}

function ensureGrid(data: (FortuneCell | null)[][], rows: number, cols: number) {
  const width = Math.max(cols, data[0]?.length || 0, 1);
  while (data.length < rows) {
    data.push(Array.from({ length: width }, () => null));
  }
  for (const row of data) {
    while (row.length < cols) row.push(null);
  }
}

const EXCEL_BORDER_STYLE: Record<string, number> = {
  thin: 1,
  hair: 2,
  dotted: 3,
  dashed: 4,
  dashDot: 5,
  dashDotDot: 6,
  double: 7,
  medium: 8,
  mediumDashed: 9,
  mediumDashDot: 10,
  mediumDashDotDot: 11,
  slantDashDot: 12,
  thick: 13,
};

const FORTUNE_BORDER_STYLE: Record<number, ExcelJS.BorderStyle> = {
  1: 'thin',
  2: 'hair',
  3: 'dotted',
  4: 'dashed',
  5: 'dashDot',
  6: 'dashDotDot',
  7: 'double',
  8: 'medium',
  9: 'mediumDashed',
  10: 'mediumDashDot',
  11: 'mediumDashDotDot',
  12: 'slantDashDot',
  13: 'thick',
};

function borderSide(side?: Partial<ExcelJS.Border>): FortuneBorderSide | undefined {
  if (!side?.style) return undefined;
  return {
    style: EXCEL_BORDER_STYLE[side.style] || 1,
    color: argbToHex(side.color?.argb) || '#000000',
  };
}

function excelSide(side?: FortuneBorderSide): Partial<ExcelJS.Border> | undefined {
  if (!side) return undefined;
  return {
    style: FORTUNE_BORDER_STYLE[side.style] || 'thin',
    color: { argb: hexToArgb(side.color) || 'FF000000' },
  };
}

function freezeFromView(view: Partial<ExcelJS.WorksheetView> | undefined): FortuneSheetData['frozen'] | undefined {
  if (!view || view.state !== 'frozen') return undefined;
  const x = view.xSplit || 0;
  const y = view.ySplit || 0;
  if (x > 0 && y > 0) {
    return { type: 'rangeBoth', range: { row_focus: y - 1, column_focus: x - 1 } };
  }
  if (y > 0) return { type: 'rangeRow', range: { row_focus: y - 1, column_focus: 0 } };
  if (x > 0) return { type: 'rangeColumn', range: { row_focus: 0, column_focus: x - 1 } };
  return undefined;
}

function freezeSplits(frozen?: FortuneSheetData['frozen']): { x: number; y: number } | null {
  if (!frozen) return null;
  const rowFocus = frozen.range?.row_focus ?? 0;
  const colFocus = frozen.range?.column_focus ?? 0;
  if (frozen.type === 'row' || frozen.type === 'rangeRow') return { x: 0, y: rowFocus + 1 };
  if (frozen.type === 'column' || frozen.type === 'rangeColumn') return { x: colFocus + 1, y: 0 };
  if (frozen.type === 'both' || frozen.type === 'rangeBoth') return { x: colFocus + 1, y: rowFocus + 1 };
  return null;
}

function readAutoFilter(worksheet: ExcelJS.Worksheet): FortuneSheetData['filter_select'] | undefined {
  const filter = worksheet.autoFilter;
  if (!filter) return undefined;
  if (typeof filter === 'string') {
    const parsed = parseA1Range(filter);
    if (!parsed) return undefined;
    return { row: [parsed.r1, parsed.r2], column: [parsed.c1, parsed.c2] };
  }
  const from = filter.from;
  const to = filter.to;
  if (!from || !to) return undefined;
  if (typeof from === 'string' || typeof to === 'string') {
    const parsed = parseA1Range(`${typeof from === 'string' ? from : ''}:${typeof to === 'string' ? to : ''}`);
    return parsed ? { row: [parsed.r1, parsed.r2], column: [parsed.c1, parsed.c2] } : undefined;
  }
  return {
    row: [from.row - 1, to.row - 1],
    column: [from.column - 1, to.column - 1],
  };
}

let knownFunctions: Set<string> | null = null;

async function formulaNames(): Promise<Set<string>> {
  if (knownFunctions) return knownFunctions;
  const mod = await import('@formulajs/formulajs');
  const bag = (mod.default && typeof mod.default === 'object' ? mod.default : mod) as Record<string, unknown>;
  knownFunctions = new Set(Object.keys(bag).filter((name) => name !== 'default').map((name) => name.toUpperCase()));
  return knownFunctions;
}

function unknownFormulaNames(formula: string, known: Set<string>): string[] {
  const found: string[] = [];
  const pattern = /([A-Za-z_][A-Za-z0-9_.]*)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(formula))) {
    const name = match[1].toUpperCase();
    if (!known.has(name) && !found.includes(name)) found.push(name);
  }
  return found;
}

function noteSkipped(skippedFeatures: string[], warnings: ImportWarning[], item: string, reason: string) {
  if (skippedFeatures.includes(item)) return;
  skippedFeatures.push(item);
  warnings.push({ item, reason });
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
  const packed = new TextDecoder('latin1').decode(buffer);
  const known = await formulaNames();
  const unknownFns = new Set<string>();

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
    const rowlen: Record<string, number> = {};
    const borderInfo: FortuneBorder[] = [];

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

      if (row.height) rowlen[String(rIdx)] = Math.round(row.height * (96 / 72));

      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
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

        if (fortuneCell.f) {
          for (const name of unknownFormulaNames(fortuneCell.f, known)) unknownFns.add(name);
        }

        // Font styling
        if (cell.font) {
          if (cell.font.bold) fortuneCell.bl = 1;
          if (cell.font.italic) fortuneCell.it = 1;
          if (cell.font.underline && cell.font.underline !== 'none') fortuneCell.un = 1;
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
          if (cell.alignment.wrapText) fortuneCell.tb = '1';
        }

        const left = borderSide(cell.border?.left);
        const right = borderSide(cell.border?.right);
        const top = borderSide(cell.border?.top);
        const bottom = borderSide(cell.border?.bottom);
        if (left || right || top || bottom) {
          borderInfo.push({
            rangeType: 'cell',
            value: {
              row_index: rIdx,
              col_index: cIdx,
              l: left,
              r: right,
              t: top,
              b: bottom,
            },
          });
        }

        if (cell.numFmt) {
          fortuneCell.ct = { fa: cell.numFmt, t: typeof fortuneCell.v === 'number' ? 'n' : 's' };
        }

        const hasCell = Object.keys(fortuneCell).length > 0;
        if (hasCell) data[rIdx][cIdx] = fortuneCell;
      });
    });

    const merge: Record<string, FortuneMerge> = {};
    for (const range of worksheet.model.merges || []) {
      const parsed = parseA1Range(range);
      if (!parsed) continue;
      const rs = parsed.r2 - parsed.r1 + 1;
      const cs = parsed.c2 - parsed.c1 + 1;
      if (rs < 1 || cs < 1 || (rs === 1 && cs === 1)) continue;
      ensureGrid(data, parsed.r2 + 1, parsed.c2 + 1);
      const master = data[parsed.r1][parsed.c1] || {};
      master.mc = { r: parsed.r1, c: parsed.c1, rs, cs };
      data[parsed.r1][parsed.c1] = master;
      for (let r = parsed.r1; r <= parsed.r2; r += 1) {
        for (let c = parsed.c1; c <= parsed.c2; c += 1) {
          if (r === parsed.r1 && c === parsed.c1) continue;
          data[r][c] = { mc: { r: parsed.r1, c: parsed.c1 } };
        }
      }
      merge[`${parsed.r1}_${parsed.c1}`] = { r: parsed.r1, c: parsed.c1, rs, cs };
    }

    const filterSelect = readAutoFilter(worksheet);
    if (filterSelect) {
      ensureGrid(data, filterSelect.row[1] + 1, filterSelect.column[1] + 1);
    }

    const conditionalFormats: ConditionalFormatRule[] = [];
    if (Array.isArray((worksheet as any).conditionalFormattings)) {
      for (const cf of (worksheet as any).conditionalFormattings) {
        const parsed = parseA1Range(cf.ref || '');
        if (parsed && Array.isArray(cf.rules)) {
          for (let ri = 0; ri < cf.rules.length; ri++) {
            const rule = cf.rules[ri];
            if (rule.operator === 'greaterThan' || rule.operator === 'lessThan') {
              const val = rule.formulae?.[0] != null ? Number(String(rule.formulae[0]).replace(/^"|"$/g, '')) : 0;
              const fillArgb = rule.style?.fill?.bgColor?.argb || rule.style?.fill?.fgColor?.argb;
              conditionalFormats.push({
                id: `cf_${sheetIndex}_${ri}`,
                range: { row: [parsed.r1, parsed.r2], column: [parsed.c1, parsed.c2] },
                kind: rule.operator === 'greaterThan' ? 'greater' : 'less',
                value: val,
                colors: [argbToHex(fillArgb) || '#f87171'],
              });
            }
          }
        }
      }
    }

    const dataValidations: DataValidationRule[] = [];
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        if (cell.dataValidation && cell.dataValidation.type === 'list' && cell.dataValidation.formulae?.length) {
          const raw = String(cell.dataValidation.formulae[0]).replace(/^"|"$/g, '');
          const items = raw.split(',').map((s) => s.trim()).filter(Boolean);
          if (items.length > 0) {
            dataValidations.push({
              range: {
                row: [rowNumber - 1, rowNumber - 1],
                column: [colNumber - 1, colNumber - 1],
              },
              list: items,
            });
          }
        }
      });
    });

    sheets.push({
      name: worksheet.name || `Sheet${sheetIndex + 1}`,
      id: `sheet_${id || sheetIndex + 1}`,
      status: sheetIndex === 0 ? 1 : 0,
      order: sheetIndex,
      row: Math.max(rowCount, data.length),
      column: Math.max(colCount, data[0]?.length || 0),
      data,
      color: worksheet.properties?.tabColor?.argb ? argbToHex(worksheet.properties.tabColor.argb) : undefined,
      frozen: freezeFromView(worksheet.views?.[0]),
      filter_select: filterSelect,
      conditionalFormats: conditionalFormats.length ? conditionalFormats : undefined,
      dataValidations: dataValidations.length ? dataValidations : undefined,
      config: {
        columnlen,
        rowlen: Object.keys(rowlen).length ? rowlen : undefined,
        merge: Object.keys(merge).length ? merge : undefined,
        borderInfo: borderInfo.length ? borderInfo : undefined,
      },
    });

    sheetIndex++;
  });

  if (sheets.length === 0) {
    // Empty default sheet
    sheets.push(createEmptySheet('Sheet1'));
  }

  for (const name of unknownFns) {
    warnings.push({ item: name, reason: 'This formula function is not calculated' });
  }

  // Detect skipped features in workbook
  const rawXmls = (workbook as any).model;
  if (rawXmls?.pivotTables?.length || packed.includes('xl/pivotTables/')) {
    noteSkipped(skippedFeatures, warnings, 'Pivot Tables', 'Pivot tables are not interactive in this version');
  }
  if (packed.includes('xl/charts/')) {
    noteSkipped(skippedFeatures, warnings, 'Charts', 'Charts are not shown in this version');
  }
  if (packed.includes('vbaProject.bin')) {
    noteSkipped(skippedFeatures, warnings, 'Macros', 'Macros are not run. The sheet body is imported without them.');
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

type ExcelSides = Partial<Pick<ExcelJS.Borders, 'top' | 'left' | 'bottom' | 'right'>>;

function styleNumber(style?: string): number {
  const n = Number(style);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function collectBorders(info: FortuneBorder[] | undefined): Map<string, ExcelSides> {
  const painted = new Map<string, ExcelSides>();
  for (const item of info || []) {
    const ranges = item.rangeType === 'cell' && item.value
      ? [{ r0: item.value.row_index, r1: item.value.row_index, c0: item.value.col_index, c1: item.value.col_index }]
      : (item.range || []).map((range) => ({
        r0: Math.min(...range.row),
        r1: Math.max(...range.row),
        c0: Math.min(...range.column),
        c1: Math.max(...range.column),
      }));
    for (const range of ranges) {
      for (let r = range.r0; r <= range.r1; r += 1) {
        for (let c = range.c0; c <= range.c1; c += 1) {
          const key = `${r}_${c}`;
          const current = painted.get(key) || {};
          if (item.borderType === 'border-none') {
            painted.set(key, {});
            continue;
          }
          if (item.rangeType === 'cell' && item.value) {
            const top = excelSide(item.value.t);
            const left = excelSide(item.value.l);
            const bottom = excelSide(item.value.b);
            const right = excelSide(item.value.r);
            if (top) current.top = top;
            if (left) current.left = left;
            if (bottom) current.bottom = bottom;
            if (right) current.right = right;
          } else {
            const side = excelSide({ style: styleNumber(item.style), color: item.color || '#000000' });
            if (side) {
              current.top = side;
              current.left = side;
              current.bottom = side;
              current.right = side;
            }
          }
          painted.set(key, current);
        }
      }
    }
  }
  return painted;
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

    if (sheet.config?.rowlen) {
      Object.entries(sheet.config.rowlen).forEach(([rowIdx, heightPx]) => {
        ws.getRow(parseInt(rowIdx, 10) + 1).height = Math.max(heightPx * (72 / 96), 1);
      });
    }

    const borders = collectBorders(sheet.config?.borderInfo);
    const rowCount = sheet.data?.length || 0;
    for (let r = 0; r < rowCount; r++) {
      const row = sheet.data[r];
      if (!row) continue;
      const excelRow = ws.getRow(r + 1);

      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        const edge = borders.get(`${r}_${c}`);
        if (!cell && !edge) continue;
        if (cell?.mc && cell.mc.rs == null) continue;

        const excelCell = excelRow.getCell(c + 1);

        if (cell?.f) {
          // Strip leading '=' if present for ExcelJS formula
          const formulaStr = cell.f.startsWith('=') ? cell.f.slice(1) : cell.f;
          excelCell.value = {
            formula: formulaStr,
            result: cell.v !== undefined ? cell.v : undefined,
          };
        } else if (cell?.v !== undefined && cell.v !== null) {
          excelCell.value = cell.v;
        }

        // Formatting
        if (cell?.bl || cell?.it || cell?.un || cell?.fc || cell?.fs || cell?.ff) {
          excelCell.font = {
            bold: !!cell.bl,
            italic: !!cell.it,
            underline: cell.un ? true : undefined,
            size: cell.fs || 11,
            name: cell.ff || 'Calibri',
            color: cell.fc ? { argb: hexToArgb(cell.fc) } : undefined,
          };
        }

        if (cell?.bg) {
          excelCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: hexToArgb(cell.bg) },
          };
        }

        const wrap = cell?.tb === '1';
        if (cell?.ht !== undefined || cell?.vt !== undefined || wrap) {
          excelCell.alignment = {
            horizontal: cell?.ht === 0 ? 'center' : cell?.ht === 1 ? 'left' : cell?.ht === 2 ? 'right' : undefined,
            vertical: cell?.vt === 0 ? 'middle' : cell?.vt === 1 ? 'top' : cell?.vt === 2 ? 'bottom' : undefined,
            wrapText: wrap || undefined,
          };
        }

        if (cell?.ct?.fa) {
          excelCell.numFmt = cell.ct.fa;
        }

        if (edge && (edge.top || edge.left || edge.bottom || edge.right)) {
          excelCell.border = edge;
        }
      }
    }

    for (const merge of Object.values(sheet.config?.merge || {})) {
      if (merge.rs < 1 || merge.cs < 1 || (merge.rs === 1 && merge.cs === 1)) continue;
      ws.mergeCells(merge.r + 1, merge.c + 1, merge.r + merge.rs, merge.c + merge.cs);
    }

    const splits = freezeSplits(sheet.frozen);
    if (splits && (splits.x > 0 || splits.y > 0)) {
      ws.views = [{ state: 'frozen', xSplit: splits.x, ySplit: splits.y }];
    }

    const filter = sheet.filter_select;
    if (filter?.row?.length === 2 && filter.column?.length === 2) {
      const r0 = Math.min(...filter.row);
      const r1 = Math.max(...filter.row);
      const c0 = Math.min(...filter.column);
      const c1 = Math.max(...filter.column);
      ws.autoFilter = `${columnName(c0)}${r0 + 1}:${columnName(c1)}${r1 + 1}`;
    }

    if (sheet.color) {
      try {
        const argb = hexToArgb(sheet.color);
        if (argb) {
          ws.properties.tabColor = { argb };
        }
      } catch {
        // Fallback
      }
    }

    if (sheet.conditionalFormats && Array.isArray(sheet.conditionalFormats)) {
      for (const cf of sheet.conditionalFormats) {
        const r0 = Math.min(...cf.range.row);
        const r1 = Math.max(...cf.range.row);
        const c0 = Math.min(...cf.range.column);
        const c1 = Math.max(...cf.range.column);
        const ref = `${columnName(c0)}${r0 + 1}:${columnName(c1)}${r1 + 1}`;
        if (cf.kind === 'greater' || cf.kind === 'less') {
          const operator = cf.kind === 'greater' ? 'greaterThan' : 'lessThan';
          const fill = cf.colors[0] || '#f87171';
          const argb = hexToArgb(fill) || 'FFFF0000';
          try {
            if (typeof (ws as any).addConditionalFormatting === 'function') {
              (ws as any).addConditionalFormatting({
                ref,
                rules: [
                  {
                    type: 'cellIs',
                    operator,
                    formulae: [String(cf.value ?? 0)],
                    style: {
                      fill: {
                        type: 'pattern',
                        pattern: 'solid',
                        bgColor: { argb },
                      },
                    },
                  },
                ],
              });
            }
          } catch {
            // ExcelJS fallback
          }
        }
      }
    }

    if (sheet.dataValidations && Array.isArray(sheet.dataValidations)) {
      for (const dv of sheet.dataValidations) {
        const r0 = Math.min(...dv.range.row);
        const r1 = Math.max(...dv.range.row);
        const c0 = Math.min(...dv.range.column);
        const c1 = Math.max(...dv.range.column);
        const listFormula = `"${dv.list.join(',')}"`;
        for (let r = r0; r <= r1; r++) {
          for (let c = c0; c <= c1; c++) {
            try {
              const cell = ws.getCell(`${columnName(c)}${r + 1}`);
              cell.dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [listFormula],
              };
            } catch {
              // fallback
            }
          }
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

