import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { exportDocx } from '../src/document/docx/exporter';
import { importDocx } from '../src/document/docx/importer';
import { exportOdt } from '../src/document/odt/exporter';
import { importOdt } from '../src/document/odt/importer';
import { defaultDocumentModel, documentExtensions } from '../src/document/model';
import {
  applyPageSetup,
  clampPageSetup,
  DEFAULT_PAGE_SETUP,
  formatMargin,
  mmToPx,
  mmToTwip,
  pageSetupFromDoc,
  parseMargin,
  twipToMm,
} from '../src/document/pageSetup';
import { applyEdit, blankTab, stampClean, tabFromDraft } from '../src/files/tabs';

describe('page setup', () => {
  it('clamps margins so the text column stays usable', () => {
    const setup = clampPageSetup({
      size: 'a4',
      marginTop: 200,
      marginBottom: 200,
      marginLeft: 0,
      marginRight: 300,
    });
    expect(setup.size).toBe('a4');
    expect(setup.marginTop + setup.marginBottom).toBeLessThanOrEqual(297 - 40 + 0.05);
    expect(setup.marginLeft + setup.marginRight).toBeLessThanOrEqual(210 - 40 + 0.05);
    expect(setup.marginLeft).toBe(0);
  });

  it('converts millimeters, twips, and pixels', () => {
    expect(mmToTwip(25.4)).toBe(1440);
    expect(twipToMm(1440)).toBeCloseTo(25.4, 5);
    expect(mmToPx(25.4)).toBeCloseTo(96, 5);
    expect(formatMargin(25.4, 'en')).toBe('1.00');
    expect(formatMargin(25.4, 'uk')).toBe('2.5');
    expect(parseMargin('1.00', 'en')).toBeCloseTo(25.4, 5);
    expect(parseMargin('2,5', 'uk')).toBeCloseTo(25, 5);
  });

  it('round-trips page margins through docx', async () => {
    const setup = clampPageSetup({
      ...DEFAULT_PAGE_SETUP,
      size: 'a4',
      marginLeft: 31.8,
      marginRight: 19.1,
      marginTop: 25.4,
      marginBottom: 12.7,
    });
    const blob = await exportDocx('<p>Margin text</p>', setup);
    const { html, pageSetup, report } = await importDocx(await blob.arrayBuffer(), 'margins.docx');
    expect(html).toContain('Margin text');
    expect(pageSetup?.size).toBe('a4');
    expect(pageSetup?.marginLeft).toBeCloseTo(31.8, 1);
    expect(pageSetup?.marginRight).toBeCloseTo(19.1, 1);
    expect(pageSetup?.marginBottom).toBeCloseTo(12.7, 1);
    expect(report.warnings.some((warning) => warning.item === 'Page size')).toBe(false);
  });

  it('round-trips page margins through odt', async () => {
    const setup = clampPageSetup({
      ...DEFAULT_PAGE_SETUP,
      size: 'a4',
      marginLeft: 31.8,
      marginTop: 19,
    });
    const blob = await exportOdt('<p>Odt margin</p>', setup);
    const { html, pageSetup } = await importOdt(await blob.arrayBuffer(), 'margins.odt');
    expect(html).toContain('Odt margin');
    expect(pageSetup?.size).toBe('a4');
    expect(pageSetup?.marginLeft).toBeCloseTo(31.8, 1);
    expect(pageSetup?.marginTop).toBeCloseTo(19, 1);
  });

  it('opens an old draft at the default margins', () => {
    const tab = tabFromDraft({
      id: 'd',
      name: 'Notes.docx',
      kind: 'document',
      format: 'docx',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      updatedAt: 1,
    });
    expect(pageSetupFromDoc(tab.documentContent).marginTop).toBe(25.4);
    expect(tab.documentContent?.type).toBe('doc');
  });

  it('marks a margin edit dirty', () => {
    const tab = stampClean(blankTab('document', []));
    const next = applyEdit(tab, {
      documentContent: applyPageSetup(tab.documentContent!, {
        ...pageSetupFromDoc(tab.documentContent),
        marginLeft: 40,
      }),
    });
    expect(next.isDirty).toBe(true);
    expect(pageSetupFromDoc(next.documentContent).marginLeft).toBe(40);
  });

  it('undoes a margin change', () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: documentExtensions,
      content: defaultDocumentModel,
    });
    editor.commands.setPageSetup({ marginLeft: 40 });
    expect(pageSetupFromDoc(editor.getJSON()).marginLeft).toBe(40);
    expect(editor.commands.undo()).toBe(true);
    expect(pageSetupFromDoc(editor.getJSON()).marginLeft).toBe(25.4);
    editor.destroy();
  });

  it('swaps dimensions and clamps correctly in landscape orientation', () => {
    const setup = clampPageSetup({
      size: 'a4',
      orientation: 'landscape',
      columns: 2,
      marginTop: 20,
      marginBottom: 20,
      marginLeft: 25,
      marginRight: 25,
    });
    expect(setup.size).toBe('a4');
    expect(setup.orientation).toBe('landscape');
    expect(setup.columns).toBe(2);
    // In A4 landscape: width is 297, height is 210
    expect(setup.marginTop + setup.marginBottom).toBeLessThanOrEqual(210 - 40 + 0.05);
    expect(setup.marginLeft + setup.marginRight).toBeLessThanOrEqual(297 - 40 + 0.05);
  });

  it('round-trips landscape orientation and columns in docx', async () => {
    const setup = clampPageSetup({
      size: 'letter',
      orientation: 'landscape',
      columns: 2,
      marginLeft: 25.4,
      marginRight: 25.4,
      marginTop: 25.4,
      marginBottom: 25.4,
    });
    const blob = await exportDocx('<p>Landscape two-column body text</p>', setup);
    const { html, pageSetup } = await importDocx(await blob.arrayBuffer(), 'landscape.docx');
    expect(html).toContain('Landscape two-column body text');
    expect(pageSetup?.size).toBe('letter');
    expect(pageSetup?.orientation).toBe('landscape');
    expect(pageSetup?.columns).toBe(2);
  });

  it('round-trips landscape orientation and columns in odt', async () => {
    const setup = clampPageSetup({
      size: 'letter',
      orientation: 'landscape',
      columns: 2,
      marginLeft: 25.4,
      marginRight: 25.4,
      marginTop: 25.4,
      marginBottom: 25.4,
    });
    const blob = await exportOdt('<p>ODT landscape two-column content</p>', setup);
    const { html, pageSetup } = await importOdt(await blob.arrayBuffer(), 'landscape.odt');
    expect(html).toContain('ODT landscape two-column content');
    expect(pageSetup?.size).toBe('letter');
    expect(pageSetup?.orientation).toBe('landscape');
    expect(pageSetup?.columns).toBe(2);
  });
});
