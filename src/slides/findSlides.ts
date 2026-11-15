import { PresentationModel, Slide } from '../types';

export interface SlideMatch {
  slideIndex: number;
  slideId: string;
  target: 'element' | 'tableCell' | 'notes';
  elementId?: string;
  row?: number;
  col?: number;
  text: string;
}

export interface SlideFindOptions {
  matchCase?: boolean;
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findInPresentation(
  model: PresentationModel | Slide[],
  query: string,
  options?: SlideFindOptions
): SlideMatch[] {
  if (!query || !model) return [];
  const slides = Array.isArray(model) ? model : model.slides;
  if (!slides || !Array.isArray(slides)) return [];

  const escaped = escapeRegex(query);
  const flags = options?.matchCase ? '' : 'i';
  const regex = new RegExp(escaped, flags);
  const matches: SlideMatch[] = [];

  for (let sIdx = 0; sIdx < slides.length; sIdx++) {
    const slide = slides[sIdx];
    if (!slide) continue;

    // Search elements
    if (slide.elements && Array.isArray(slide.elements)) {
      for (const el of slide.elements) {
        if (el.text && regex.test(el.text)) {
          matches.push({
            slideIndex: sIdx,
            slideId: slide.id,
            target: 'element',
            elementId: el.id,
            text: el.text,
          });
        }

        if (el.type === 'table' && el.rows && Array.isArray(el.rows)) {
          for (let r = 0; r < el.rows.length; r++) {
            const row = el.rows[r];
            if (!row || !Array.isArray(row)) continue;
            for (let c = 0; c < row.length; c++) {
              const cellText = row[c];
              if (cellText && regex.test(cellText)) {
                matches.push({
                  slideIndex: sIdx,
                  slideId: slide.id,
                  target: 'tableCell',
                  elementId: el.id,
                  row: r,
                  col: c,
                  text: cellText,
                });
              }
            }
          }
        }
      }
    }

    // Search speaker notes
    if (slide.notes && regex.test(slide.notes)) {
      matches.push({
        slideIndex: sIdx,
        slideId: slide.id,
        target: 'notes',
        text: slide.notes,
      });
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

