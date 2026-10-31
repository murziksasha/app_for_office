import { describe, expect, it } from 'vitest';
import { findInSheetData } from '../src/spreadsheet/findSheet';
import { findInPresentation } from '../src/slides/findSlides';
import { PresentationModel } from '../src/types';

describe('Find on sheet and slides', () => {
  it('finds a hit in column B of a spreadsheet', () => {
    // Row 0 has col 0 = 'ID', col 1 = 'TargetVal' (column B is index 1)
    const sheetData = [
      [{ v: 'Item 1' }, { v: 'TargetVal' }, { v: 'Item 3' }],
      [{ v: 'Item 4' }, { v: 'OtherVal' }, { v: 'Item 6' }],
    ];

    const matches = findInSheetData(sheetData, 'TargetVal');
    expect(matches.length).toBe(1);
    expect(matches[0].row).toBe(0);
    expect(matches[0].col).toBe(1); // Column B
    expect(matches[0].text).toBe('TargetVal');
  });

  it('matches a formula cell on its display text (m) rather than formula or raw value', () => {
    const sheetData = [
      [
        {
          f: '=SUM(A1:A2)',
          v: 1250,
          m: '$1,250.00', // Formatted display text
        },
      ],
    ];

    // Search for formatted display string with dollar sign and comma
    const matchesFormatted = findInSheetData(sheetData, '$1,250');
    expect(matchesFormatted.length).toBe(1);
    expect(matchesFormatted[0].row).toBe(0);
    expect(matchesFormatted[0].col).toBe(0);
    expect(matchesFormatted[0].text).toBe('$1,250.00');

    // Formula string is not the display text
    const formulaMatch = findInSheetData(sheetData, 'SUM');
    expect(formulaMatch.length).toBe(0);
  });

  it('finds a hit on slide 2', () => {
    const model: PresentationModel = {
      title: 'Presentation',
      slides: [
        {
          id: 'slide-1',
          elements: [{ id: 'el-1', type: 'text', x: 0, y: 0, width: 10, height: 10, text: 'First slide' }],
        },
        {
          id: 'slide-2',
          elements: [
            { id: 'el-2', type: 'text', x: 0, y: 0, width: 10, height: 10, text: 'Quarterly Revenue' },
          ],
        },
      ],
    };

    const matches = findInPresentation(model, 'Quarterly');
    expect(matches.length).toBe(1);
    expect(matches[0].slideIndex).toBe(1); // Slide 2
    expect(matches[0].slideId).toBe('slide-2');
    expect(matches[0].target).toBe('element');
    expect(matches[0].elementId).toBe('el-2');
  });

  it('finds a hit in speaker notes', () => {
    const model: PresentationModel = {
      title: 'Presentation',
      slides: [
        {
          id: 'slide-1',
          elements: [{ id: 'el-1', type: 'text', x: 0, y: 0, width: 10, height: 10, text: 'Slide content' }],
          notes: 'Remember to mention Q4 projections to the board.',
        },
      ],
    };

    const matches = findInPresentation(model, 'projections');
    expect(matches.length).toBe(1);
    expect(matches[0].slideIndex).toBe(0);
    expect(matches[0].target).toBe('notes');
    expect(matches[0].text).toContain('projections');
  });

  it('finds a hit in slide table cells', () => {
    const model: PresentationModel = {
      title: 'Presentation',
      slides: [
        {
          id: 'slide-1',
          elements: [
            {
              id: 'table-1',
              type: 'table',
              x: 0,
              y: 0,
              width: 50,
              height: 50,
              rows: [
                ['Header A', 'Header B'],
                ['Value 1', 'TableTarget'],
              ],
            },
          ],
        },
      ],
    };

    const matches = findInPresentation(model, 'TableTarget');
    expect(matches.length).toBe(1);
    expect(matches[0].target).toBe('tableCell');
    expect(matches[0].row).toBe(1);
    expect(matches[0].col).toBe(1);
  });
});

