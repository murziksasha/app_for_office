import { describe, it, expect } from 'vitest';
import { applyPalette, SLIDE_PALETTES } from '../src/slides/palettes';
import { PresentationModel } from '../src/types';

describe('Slide palettes', () => {
  const sampleDeck: PresentationModel = {
    title: 'Test Deck',
    slides: [
      {
        id: 's1',
        title: 'Slide 1',
        background: '#ffffff',
        elements: [
          {
            id: 'e1',
            type: 'text',
            x: 10,
            y: 10,
            width: 80,
            height: 20,
            text: 'Heading',
            fontSize: 32,
            bold: true,
            color: '#000000',
          },
          {
            id: 'e2',
            type: 'rect',
            x: 10,
            y: 40,
            width: 40,
            height: 30,
            fill: '#eeeeee',
            borderColor: '#333333',
          },
        ],
      },
    ],
  };

  it('applies Paper palette with warm off-white and earth tones', () => {
    const updated = applyPalette(sampleDeck, 'paper');
    expect(updated.slides[0].background).toBe(SLIDE_PALETTES.paper.background);
    expect(updated.slides[0].elements[0].color).toBe(SLIDE_PALETTES.paper.text);
    expect(updated.slides[0].elements[1].fill).toBe(SLIDE_PALETTES.paper.secondary);
  });

  it('applies Ink palette with dark slate and crisp light text', () => {
    const updated = applyPalette(sampleDeck, 'ink');
    expect(updated.slides[0].background).toBe(SLIDE_PALETTES.ink.background);
    expect(updated.slides[0].elements[0].color).toBe(SLIDE_PALETTES.ink.text);
    expect(updated.slides[0].elements[1].fill).toBe(SLIDE_PALETTES.ink.secondary);
  });

  it('applies Teal palette with fresh light teal background and deep teal text', () => {
    const updated = applyPalette(sampleDeck, 'teal');
    expect(updated.slides[0].background).toBe(SLIDE_PALETTES.teal.background);
    expect(updated.slides[0].elements[0].color).toBe(SLIDE_PALETTES.teal.text);
    expect(updated.slides[0].elements[1].fill).toBe(SLIDE_PALETTES.teal.secondary);
  });

  it('leaves deck untouched when unknown palette is passed', () => {
    const updated = applyPalette(sampleDeck, 'unknown' as any);
    expect(updated).toBe(sampleDeck);
  });
});

