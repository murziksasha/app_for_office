import type { FortuneSheetData, FortuneCell } from './adapters';

export type ConditionalFormatKind = 'greater' | 'less' | 'scale';

export interface ConditionalFormatRule {
  id: string;
  range: { row: [number, number]; column: [number, number] };
  kind: ConditionalFormatKind;
  value?: number;
  colors: string[];
}

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  return [r, g, b];
}

function toHex([r, g, b]: [number, number, number]): string {
  const hR = Math.max(0, Math.min(255, Math.round(r))).toString(16).padStart(2, '0');
  const hG = Math.max(0, Math.min(255, Math.round(g))).toString(16).padStart(2, '0');
  const hB = Math.max(0, Math.min(255, Math.round(b))).toString(16).padStart(2, '0');
  return `#${hR}${hG}${hB}`;
}

function lerpColor(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = parseHex(c1);
  const [r2, g2, b2] = parseHex(c2);
  const clamped = Math.max(0, Math.min(1, t));
  return toHex([
    r1 + (r2 - r1) * clamped,
    g1 + (g2 - g1) * clamped,
    b1 + (b2 - b1) * clamped,
  ]);
}

export function interpolate3(colors: string[], value: number, min: number, max: number): string {
  if (colors.length === 0) return '#ffffff';
  if (colors.length === 1 || min >= max) return colors[0];
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  if (colors.length === 2) {
    return lerpColor(colors[0], colors[1], t);
  }
  // 3 colors: [minColor, midColor, maxColor]
  if (t <= 0.5) {
    return lerpColor(colors[0], colors[1], t / 0.5);
  }
  return lerpColor(colors[1], colors[2], (t - 0.5) / 0.5);
}

function getNumericValue(cell: FortuneCell | null): number | null {
  if (!cell) return null;
  if (typeof cell.v === 'number' && !Number.isNaN(cell.v)) return cell.v;
  if (typeof cell.v === 'string' && /^-?\d+(?:\.\d+)?$/.test(cell.v.trim())) {
    return Number(cell.v.trim());
  }
  return null;
}

export function applyConditionalFormatting(sheet: FortuneSheetData): FortuneSheetData {
  if (!sheet.conditionalFormats || sheet.conditionalFormats.length === 0) {
    return sheet;
  }

  const base: Record<string, string | undefined> = { ...(sheet.conditionalBase || {}) };

  for (const rule of sheet.conditionalFormats) {
    const r0 = Math.min(...rule.range.row);
    const r1 = Math.max(...rule.range.row);
    const c0 = Math.min(...rule.range.column);
    const c1 = Math.max(...rule.range.column);

    if (rule.kind === 'scale') {
      const numbers: number[] = [];
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const num = getNumericValue(sheet.data[r]?.[c] ?? null);
          if (num !== null) numbers.push(num);
        }
      }

      if (numbers.length > 0) {
        const min = Math.min(...numbers);
        const max = Math.max(...numbers);
        for (let r = r0; r <= r1; r++) {
          for (let c = c0; c <= c1; c++) {
            const cell = sheet.data[r]?.[c];
            const num = getNumericValue(cell ?? null);
            if (num !== null && cell) {
              const key = `${r}_${c}`;
              if (!(key in base)) {
                base[key] = cell.bg;
              }
              cell.bg = interpolate3(rule.colors, num, min, max);
            }
          }
        }
      }
    } else {
      const targetVal = rule.value ?? 0;
      const fill = rule.colors[0] || '#f87171';

      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const cell = sheet.data[r]?.[c];
          const num = getNumericValue(cell ?? null);
          const key = `${r}_${c}`;

          if (num !== null && cell) {
            const match = rule.kind === 'greater' ? num > targetVal : num < targetVal;
            if (match) {
              if (!(key in base)) {
                base[key] = cell.bg;
              }
              cell.bg = fill;
            } else if (key in base) {
              cell.bg = base[key];
            }
          }
        }
      }
    }
  }

  sheet.conditionalBase = base;
  return sheet;
}

export function clearConditionalFormatting(sheet: FortuneSheetData, ruleId?: string): FortuneSheetData {
  if (!sheet.conditionalFormats) return sheet;

  const rulesToClear = ruleId
    ? sheet.conditionalFormats.filter((r) => r.id === ruleId)
    : [...sheet.conditionalFormats];

  const base = sheet.conditionalBase || {};

  for (const rule of rulesToClear) {
    const r0 = Math.min(...rule.range.row);
    const r1 = Math.max(...rule.range.row);
    const c0 = Math.min(...rule.range.column);
    const c1 = Math.max(...rule.range.column);

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const key = `${r}_${c}`;
        const cell = sheet.data[r]?.[c];
        if (cell && key in base) {
          if (base[key] !== undefined) {
            cell.bg = base[key];
          } else {
            delete cell.bg;
          }
          delete base[key];
        }
      }
    }
  }

  sheet.conditionalFormats = ruleId
    ? sheet.conditionalFormats.filter((r) => r.id !== ruleId)
    : [];
  sheet.conditionalBase = base;

  return sheet;
}

