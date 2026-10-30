import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import PptxGenJS from 'pptxgenjs';
import { importPptx, exportPptx, createEmptySlide } from '../src/slides/pptxAdapter';
import { PresentationModel } from '../src/types';
import { clampBox, moveBox, resizeBox } from '../src/slides/geometry';
import { VIDEO_MSG, bytesToBase64, sniffMp4, toPptxVideoData } from '../src/slides/videoFile';

function mp4Bytes(codec: 'avc1' | 'hvc1'): Uint8Array {
  const brands = codec === 'avc1' ? ['isom', 'mp41', 'avc1'] : ['isom', 'mp41', 'hvc1'];
  const size = 8 + 4 + 4 + (brands.length - 1) * 4;
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, size);
  bytes.set([0x66, 0x74, 0x79, 0x70], 4); // ftyp
  const writeBrand = (offset: number, brand: string) => {
    bytes.set(Array.from(brand, (ch) => ch.charCodeAt(0)), offset);
  };
  writeBrand(8, brands[0]);
  view.setUint32(12, 0);
  brands.slice(1).forEach((brand, index) => writeBrand(16 + index * 4, brand));
  return bytes;
}

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

  it('moves and resizes a box without leaving the slide', () => {
    const start = { x: 10, y: 10, width: 30, height: 20 };
    expect(moveBox(start, 5, -3, 8, 8)).toEqual({ x: 15, y: 7, width: 30, height: 20 });
    expect(moveBox(start, -40, 0, 8, 8).x).toBe(0);
    const resized = resizeBox(start, 'se', 10, 5, 8, 8);
    expect(resized).toEqual({ x: 10, y: 10, width: 40, height: 25 });
    const shrunk = resizeBox(start, 'w', 100, 0, 8, 8);
    expect(shrunk.width).toBe(8);
    expect(shrunk.x).toBeGreaterThanOrEqual(0);
    expect(clampBox({ x: -5, y: 90, width: 2, height: 40 }, 8, 8).width).toBe(8);
  });

  it('sniffs mp4 and H.264 separately from other brands', () => {
    expect(sniffMp4(mp4Bytes('avc1'), 'clip.mp4')).toEqual({ isMp4: true, h264: true });
    expect(sniffMp4(mp4Bytes('hvc1'), 'clip.mp4')).toEqual({ isMp4: true, h264: false });
    expect(sniffMp4(mp4Bytes('avc1'), 'clip.mov').isMp4).toBe(false);
    expect(toPptxVideoData('data:video/mp4;base64,AAAA')).toBe('video/mp4;base64,AAAA');
  });

  it('round-trips an mp4 and keeps only the first mp4 on a slide', async () => {
    const h264 = bytesToBase64(mp4Bytes('avc1'));
    const hevc = bytesToBase64(mp4Bytes('hvc1'));
    const testPres: PresentationModel = {
      title: 'Video Deck',
      slides: [
        {
          id: 'slide_1',
          background: '#ffffff',
          elements: [
            {
              id: 'vid_1',
              type: 'video',
              x: 12,
              y: 18,
              width: 40,
              height: 30,
              src: `data:video/mp4;base64,${h264}`,
            },
          ],
        },
      ],
    };

    const blob = await exportPptx(testPres);
    const { presentation, report } = await importPptx(await blob.arrayBuffer(), 'video.pptx');
    const video = presentation.slides[0].elements.find((el) => el.type === 'video');
    expect(video).toBeDefined();
    expect(video?.x).toBeGreaterThan(0);
    expect(video?.src).toContain(h264);
    expect(report.warnings.some((warning) => warning.reason === VIDEO_MSG.otherPrograms)).toBe(false);

    const pptx = new PptxGenJS();
    const slide = pptx.addSlide();
    slide.addMedia({ type: 'video', data: `video/mp4;base64,${h264}`, x: 0.5, y: 0.5, w: 4, h: 2 });
    slide.addMedia({ type: 'video', data: `video/mp4;base64,${hevc}`, x: 5, y: 0.5, w: 4, h: 2 });
    slide.addMedia({ type: 'video', data: `video/quicktime;base64,${h264}`, x: 0.5, y: 3, w: 3, h: 2 });
    const packed = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer;
    const imported = await importPptx(packed, 'mixed.pptx');
    const videos = imported.presentation.slides[0].elements.filter((el) => el.type === 'video');
    expect(videos).toHaveLength(1);
    expect(videos[0].src).toContain(h264);
    expect(imported.report.warnings.some((warning) => warning.reason === VIDEO_MSG.extraOnSlide)).toBe(true);
    expect(imported.report.warnings.some((warning) => warning.reason === VIDEO_MSG.skippedNonMp4)).toBe(true);
  });
  it('builds a package with PptxGenJS that is 4:3 and contains an oval, a 2x2 table, and notes; asserts import and a second round-trip', async () => {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_4x3';
    const slide = pptx.addSlide();
    slide.addNotes('Speaker notes for slide 1');
    slide.addShape(pptx.ShapeType.ellipse, {
      x: 1,
      y: 1,
      w: 3,
      h: 2,
      fill: { color: 'FF0000' },
      line: { color: '00FF00', width: 2 },
    });
    slide.addTable([[{ text: 'Header 1' }, { text: 'Header 2' }], [{ text: 'Cell 1' }, { text: 'Cell 2' }]], {
      x: 1,
      y: 3.5,
      w: 5,
      h: 2,
      autoPage: false,
    });

    const buffer = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer;
    const { presentation, report } = await importPptx(buffer, 'test_4x3.pptx');

    expect(presentation.slideSize).toBe('4:3');
    expect(presentation.slides.length).toBe(1);
    const slide1 = presentation.slides[0];
    expect(slide1.notes).toBe('Speaker notes for slide 1');

    const oval = slide1.elements.find((el) => el.type === 'rect' && el.shape === 'ellipse');
    expect(oval).toBeDefined();
    expect(oval?.fill?.toLowerCase()).toBe('#ff0000');
    expect(oval?.borderColor?.toLowerCase()).toBe('#00ff00');

    const table = slide1.elements.find((el) => el.type === 'table');
    expect(table).toBeDefined();
    expect(table?.rows).toEqual([['Header 1', 'Header 2'], ['Cell 1', 'Cell 2']]);

    // Second round-trip
    const blob2 = await exportPptx(presentation);
    const buffer2 = await blob2.arrayBuffer();
    const { presentation: pres2 } = await importPptx(buffer2, 'roundtrip.pptx');

    expect(pres2.slideSize).toBe('4:3');
    expect(pres2.slides[0].notes).toBe('Speaker notes for slide 1');

    const oval2 = pres2.slides[0].elements.find((el) => el.type === 'rect' && el.shape === 'ellipse');
    expect(oval2).toBeDefined();
    expect(oval2?.fill?.toLowerCase()).toBe('#ff0000');
    expect(oval2?.borderColor?.toLowerCase()).toBe('#00ff00');

    const table2 = pres2.slides[0].elements.find((el) => el.type === 'table');
    expect(table2).toBeDefined();
    expect(table2?.rows).toEqual([['Header 1', 'Header 2'], ['Cell 1', 'Cell 2']]);
  });

  it('imports shapes with text, roundRect, triangle, and line presets', async () => {
    const testPres: PresentationModel = {
      title: 'Shapes Deck',
      slideSize: '16:10',
      slides: [
        {
          id: 'slide_1',
          background: '#ffffff',
          elements: [
            {
              id: 'sh_1',
              type: 'rect',
              shape: 'roundRect',
              x: 10,
              y: 10,
              width: 25,
              height: 20,
              fill: '#d6f3ef',
              borderColor: '#0f766e',
              borderWidth: 2,
              text: 'Rounded Box',
              bold: true,
            },
            {
              id: 'sh_2',
              type: 'rect',
              shape: 'triangle',
              x: 40,
              y: 10,
              width: 20,
              height: 20,
              fill: '#ffeedd',
            },
            {
              id: 'sh_3',
              type: 'rect',
              shape: 'line',
              x: 10,
              y: 40,
              width: 50,
              height: 2,
              borderColor: '#0f766e',
            },
          ],
        },
      ],
    };

    const blob = await exportPptx(testPres);
    const { presentation } = await importPptx(await blob.arrayBuffer(), 'shapes.pptx');

    expect(presentation.slideSize).toBe('16:10');
    const elements = presentation.slides[0].elements;
    const round = elements.find((e) => e.type === 'rect' && e.shape === 'roundRect');
    expect(round).toBeDefined();
    expect(round?.text).toBe('Rounded Box');
    expect(round?.bold).toBe(true);

    const tri = elements.find((e) => e.type === 'rect' && e.shape === 'triangle');
    expect(tri).toBeDefined();

    const line = elements.find((e) => e.type === 'rect' && e.shape === 'line');
    expect(line).toBeDefined();
  });
});
