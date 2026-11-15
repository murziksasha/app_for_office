import { mmToPx, PAGE_MM, PageSetup } from './pageSetup';

export interface PaginationResult {
  gapPositions: number[];
  totalPages: number;
  heights: number[];
  innerPx: number;
}

export interface TraversableDoc {
  forEach: (cb: (node: any, offset: number) => void) => void;
}

/**
 * Computes pagination gap positions and total pages for a document.
 * A page break node starts a new page unconditionally.
 * Flowing blocks accumulate height until exceeding inner content height of the pageSetup.
 */
export function computeDocumentPagination(
  doc: TraversableDoc,
  setup: PageSetup,
  getNodeHeight: (offset: number, node: any) => number = () => 0
): PaginationResult {
  const basePage = PAGE_MM[setup.size] || PAGE_MM.letter;
  const isLandscape = setup.orientation === 'landscape';
  const pageHeight = isLandscape ? basePage.width : basePage.height;
  const innerPx = Math.max(1, mmToPx(pageHeight - setup.marginTop - setup.marginBottom));

  const gapPositions: number[] = [];
  const heights: number[] = [];
  let used = 0;

  doc.forEach((node, offset) => {
    const isPageBreak = node?.type?.name === 'pageBreak' || node?.type === 'pageBreak';
    const nodeSize = node?.nodeSize ?? (node?.text?.length ?? 1) + 2;
    const pos = isPageBreak ? offset + nodeSize : offset;

    if (isPageBreak) {
      gapPositions.push(pos);
      heights.push(-1);
      used = 0;
      return;
    }

    const height = getNodeHeight(offset, node);
    heights.push(Math.round(height));

    if (used > 0 && used + height > innerPx + 0.5) {
      gapPositions.push(pos);
      used = height;
    } else {
      used += height;
    }
  });

  return {
    gapPositions,
    totalPages: gapPositions.length + 1,
    heights,
    innerPx,
  };
}

/**
 * Returns the 1-based page index containing the given caret position.
 */
export function getPageAtPosition(gapPositions: number[], pos: number): number {
  let page = 1;
  for (const gapPos of gapPositions) {
    if (pos >= gapPos) {
      page++;
    } else {
      break;
    }
  }
  return page;
}
