import { getHeadings, type HeadingItem } from './outline';
import { computeDocumentPagination, getPageAtPosition, type TraversableDoc } from './pagination';
import { pageSetupFromDoc, type PageSetup } from './pageSetup';

export interface TocItem {
  level: number;
  text: string;
  page: number;
  pos: number;
}

/**
 * Computes table of contents entries for a document by walking headings 1-3
 * and determining their page numbers via pagination.ts.
 */
export function generateTocItems(
  doc: any,
  setup?: PageSetup | null,
  getNodeHeight: (offset: number, node: any) => number = () => 0
): TocItem[] {
  if (!doc) return [];
  const headings = getHeadings(doc);
  if (headings.length === 0) return [];

  const committedSetup = setup || pageSetupFromDoc(doc);
  const pagination = computeDocumentPagination(doc as TraversableDoc, committedSetup, getNodeHeight);

  return headings.map((h) => ({
    level: h.level,
    text: h.text,
    page: getPageAtPosition(pagination.gapPositions, h.pos),
    pos: h.pos,
  }));
}

