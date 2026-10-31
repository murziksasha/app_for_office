export interface SheetPrintSetup {
  fitWidth: boolean;
  repeatHeaderRow: boolean;
  gridlines: boolean;
}

export const defaultPrintSetup: SheetPrintSetup = {
  fitWidth: false,
  repeatHeaderRow: false,
  gridlines: false,
};

/**
 * Calculates scaling factor for fitting spreadsheet columns to page width.
 * If fitWidth is false, returns 1.0 (unscaled).
 * If fitWidth is true and totalColsWidth > availableWidth, scales down to fit availableWidth.
 * Scaling never exceeds 1.0 (will not upscale narrow sheets).
 */
export function calculateFitWidthScale(
  totalColsWidth: number,
  availableWidth: number,
  fitWidth: boolean
): number {
  if (!fitWidth) return 1.0;
  if (totalColsWidth <= 0 || availableWidth <= 0) return 1.0;
  return Math.min(1.0, availableWidth / totalColsWidth);
}

export interface SheetPageSlice {
  pageIndex: number;
  headerRow?: number;
  startRow: number;
  endRow: number;
}

/**
 * Calculates page row slices for printing / PDF export.
 * When repeatHeaderRow is true:
 * - Row 0 is the header row.
 * - Page 0 has header row 0 followed by data rows up to rowsPerPage.
 * - Page 1+ repeats header row 0 at the top, leaving (rowsPerPage - 1) slots for data rows.
 */
export function calculateSheetPageRowSlices(
  totalRows: number,
  rowsPerPage: number,
  repeatHeaderRow: boolean
): SheetPageSlice[] {
  if (totalRows <= 0) return [];
  if (rowsPerPage <= 0) rowsPerPage = 1;

  const slices: SheetPageSlice[] = [];

  if (!repeatHeaderRow || totalRows <= 1) {
    let current = 0;
    let pageIdx = 0;
    while (current < totalRows) {
      const end = Math.min(totalRows - 1, current + rowsPerPage - 1);
      slices.push({
        pageIndex: pageIdx++,
        startRow: current,
        endRow: end,
      });
      current = end + 1;
    }
    return slices;
  }

  const firstPageDataCapacity = Math.max(1, rowsPerPage - 1);
  const page0End = Math.min(totalRows - 1, 1 + firstPageDataCapacity - 1);
  slices.push({
    pageIndex: 0,
    headerRow: 0,
    startRow: 1,
    endRow: Math.max(0, page0End),
  });

  let current = page0End + 1;
  let pageIdx = 1;
  const subsequentCapacity = Math.max(1, rowsPerPage - 1);

  while (current < totalRows) {
    const end = Math.min(totalRows - 1, current + subsequentCapacity - 1);
    slices.push({
      pageIndex: pageIdx++,
      headerRow: 0,
      startRow: current,
      endRow: end,
    });
    current = end + 1;
  }

  return slices;
}

