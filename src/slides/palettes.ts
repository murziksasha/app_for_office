import { PresentationModel } from '../types';

export interface SlidePalette {
  name: 'paper' | 'ink' | 'teal';
  labelKey: string;
  background: string;
  text: string;
  accent: string;
  secondary: string;
}

export const SLIDE_PALETTES: Record<'paper' | 'ink' | 'teal', SlidePalette> = {
  paper: {
    name: 'paper',
    labelKey: 'ribbon.palettePaper',
    background: '#faf8f5',
    text: '#2c2825',
    accent: '#c85a32',
    secondary: '#e8e2d9',
  },
  ink: {
    name: 'ink',
    labelKey: 'ribbon.paletteInk',
    background: '#1e2022',
    text: '#f3f4f6',
    accent: '#60a5fa',
    secondary: '#374151',
  },
  teal: {
    name: 'teal',
    labelKey: 'ribbon.paletteTeal',
    background: '#f0fdfa',
    text: '#134e4a',
    accent: '#0d9488',
    secondary: '#ccfbf1',
  },
};

export function applyPalette(
  presentation: PresentationModel,
  paletteName: 'paper' | 'ink' | 'teal'
): PresentationModel {
  const palette = SLIDE_PALETTES[paletteName];
  if (!palette) return presentation;

  const slides = (presentation.slides || []).map((slide) => {
    const elements = slide.elements.map((el) => {
      const updated = { ...el };
      if (el.type === 'text') {
        updated.color = el.bold ? palette.text : (el.color === '#666666' ? palette.accent : palette.text);
      } else if (el.type === 'rect') {
        if (el.fill && el.fill !== 'transparent') {
          updated.fill = palette.secondary;
        }
        if (el.borderColor && el.borderColor !== 'transparent') {
          updated.borderColor = palette.accent;
        }
      }
      return updated;
    });

    return {
      ...slide,
      background: palette.background,
      elements,
    };
  });

  return {
    ...presentation,
    slides,
  };
}

