export interface SheetMatch {
  row: number;
  col: number;
  text: string;
  value?: any;
}

export interface SheetFindOptions {
  matchCase?: boolean;
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getCellDisplayText(cell: any): string {
  if (cell == null) return '';
  if (cell.m !== undefined && cell.m !== null) return String(cell.m);
  if (cell.v !== undefined && cell.v !== null) return String(cell.v);
  return '';
}

export function findInSheetData(
  data: any[][],
  query: string,
  options?: SheetFindOptions
): SheetMatch[] {
  if (!query || !data || !Array.isArray(data)) return [];
  const escaped = escapeRegex(query);
  const flags = options?.matchCase ? '' : 'i';
  const regex = new RegExp(escaped, flags);
  const matches: SheetMatch[] = [];

  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row || !Array.isArray(row)) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      const text = getCellDisplayText(cell);
      if (text && regex.test(text)) {
        matches.push({
          row: r,
          col: c,
          text,
          value: cell?.v,
        });
      }
    }
  }

  return matches;
}

export function findNextIndex(total: number, currentIndex: number): number {
  if (total <= 0) return -1;
  if (currentIndex < 0) return 0;
  return (currentIndex + 1) % total;
}

export function findPreviousIndex(total: number, currentIndex: number): number {
  if (total <= 0) return -1;
  if (currentIndex < 0) return total - 1;
  return (currentIndex - 1 + total) % total;
}

