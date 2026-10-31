export interface DataValidationRule {
  range: { row: [number, number]; column: [number, number] };
  list: string[];
}

export function isCellInRange(
  row: number,
  col: number,
  range: { row: [number, number]; column: [number, number] }
): boolean {
  const r0 = Math.min(...range.row);
  const r1 = Math.max(...range.row);
  const c0 = Math.min(...range.column);
  const c1 = Math.max(...range.column);
  return row >= r0 && row <= r1 && col >= c0 && col <= c1;
}

export function findValidationForCell(
  row: number,
  col: number,
  validations?: DataValidationRule[]
): DataValidationRule | undefined {
  if (!validations || validations.length === 0) return undefined;
  return validations.find((v) => isCellInRange(row, col, v.range));
}

export function isValidationValueValid(value: unknown, list: string[]): boolean {
  if (value == null || value === '') return true;
  const str = String(value).trim();
  return list.some((item) => item.trim().toLowerCase() === str.toLowerCase());
}

