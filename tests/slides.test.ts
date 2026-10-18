import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { importPptx, exportPptx, createEmptySlide } from '../src/slides/pptxAdapter';
import { PresentationModel } from '../src/types';

describe('Slides / PPTX Importer and Exporter', () => {
  it('reads pre-generated sample.pptx fixture', async () => {
    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/sample.pptx');
    const buffer = fs.readFileSync(fixturePath);
    const { presentation, report } = await importPptx(buffer.buffer as ArrayBuffer, 'sample.pptx');

    expect(presentation.slides.length).toBeGreaterThanOrEqual(1);
    const slide1 = presentation.slides[0];
    const textElem = slide1.elements.find((e) => e.text?.includes('Presentation Deck'));
    expect(textElem).toBeDefined();
    expect(textElem?.bold).toBe(true);
    expect(report.format).toBe('pptx');
  });

  it('creates empty slides with default layout', () => {
    const slide = createEmptySlide(1);
    expect(slide.elements.length).toBe(2);
    expect(slide.elements[0].text).toContain('Title of Presentation');
  });

  it('round-trips presentation model through exportPptx and importPptx', async () => {
    const testPres: PresentationModel = {
      title: 'Demo Deck',
      slides: [
        {
          id: 'slide_1',
          title: 'Opening',
          background: '#ffffff',
          elements: [
            {
              id: 'txt_1',
              type: 'text',
              x: 10,
              y: 20,
              width: 80,
              height: 20,
              text: 'Modern Office App',
              fontSize: 28,
              bold: true,
            },
          ],
        },
      ],
    };

    const blob = await exportPptx(testPres);
    expect(blob.size).toBeGreaterThan(100);

    const buffer = await blob.arrayBuffer();
    const { presentation } = await importPptx(buffer, 'demo.pptx');

    expect(presentation.slides.length).toBe(1);
    expect(presentation.slides[0].elements[0].text).toContain('Modern Office App');
  });
});

