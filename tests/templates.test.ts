import { describe, it, expect } from 'vitest';
import {
  TEMPLATES,
  getTemplateById,
  getTemplatesByKind,
  getLocalizedTemplates,
} from '../src/templates';
import type { JSONContent } from '@tiptap/core';
import type { Sheet } from '@fortune-sheet/core';
import type { PresentationModel } from '../src/types';

describe('Local templates', () => {
  it('ships 2 templates per kind (6 total)', () => {
    expect(TEMPLATES).toHaveLength(6);

    const docTemplates = getTemplatesByKind('document');
    expect(docTemplates).toHaveLength(2);
    expect(docTemplates.map((t) => t.id)).toEqual(['doc-report', 'doc-resume']);

    const sheetTemplates = getTemplatesByKind('spreadsheet');
    expect(sheetTemplates).toHaveLength(2);
    expect(sheetTemplates.map((t) => t.id)).toEqual(['sheet-budget', 'sheet-invoice']);

    const presTemplates = getTemplatesByKind('presentation');
    expect(presTemplates).toHaveLength(2);
    expect(presTemplates.map((t) => t.id)).toEqual(['pres-pitch', 'pres-report']);
  });

  it('generates report document template with executive summary and table', () => {
    const tmpl = getTemplateById('doc-report');
    expect(tmpl).toBeDefined();

    const content = tmpl?.getContent() as JSONContent;
    expect(content.type).toBe('doc');
    const nodes = content.content || [];

    // Heading 1
    expect(nodes[0]).toMatchObject({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Project Status Report' }],
    });

    // Heading 2
    expect(nodes[1]).toMatchObject({
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Executive Summary' }],
    });

    // Table
    const tableNode = nodes.find((n) => n.type === 'table');
    expect(tableNode).toBeDefined();
    expect(tableNode?.content?.length).toBeGreaterThanOrEqual(3);
  });

  it('generates resume document template with experience and bullet points', () => {
    const tmpl = getTemplateById('doc-resume');
    expect(tmpl).toBeDefined();

    const content = tmpl?.getContent() as JSONContent;
    const nodes = content.content || [];

    // Title / Name
    expect(nodes[0]).toMatchObject({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Alex Johnson' }],
    });

    // Bullet list
    const bulletList = nodes.find((n) => n.type === 'bulletList');
    expect(bulletList).toBeDefined();
    expect(bulletList?.content?.length).toBeGreaterThanOrEqual(2);
  });

  it('generates budget spreadsheet template with formulas', () => {
    const tmpl = getTemplateById('sheet-budget');
    expect(tmpl).toBeDefined();

    const sheets = tmpl?.getContent() as Sheet[];
    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe('Monthly Budget');

    const data = sheets[0].data || [];
    // Header
    expect(data[0][0]?.v).toBe('Category');
    expect(data[0][3]?.v).toBe('Difference ($)');

    // Row 1 calculation formula
    expect(data[1][3]?.f).toBe('=B2-C2');
  });

  it('generates invoice spreadsheet template with multiplication formula', () => {
    const tmpl = getTemplateById('sheet-invoice');
    expect(tmpl).toBeDefined();

    const sheets = tmpl?.getContent() as Sheet[];
    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe('Invoice');

    const data = sheets[0].data || [];
    // Find row with calculation
    const calcCell = data[4]?.[3];
    expect(calcCell?.f).toBe('=B5*C5');
  });

  it('generates presentation templates (pitch and business review) with 3 slides each', () => {
    const pitchTmpl = getTemplateById('pres-pitch');
    expect(pitchTmpl).toBeDefined();
    const pitchData = pitchTmpl?.getContent() as PresentationModel;
    expect(pitchData.slides).toHaveLength(3);
    expect(pitchData.slides[0].elements[0].text).toBe('Project Folio');

    const reviewTmpl = getTemplateById('pres-report');
    expect(reviewTmpl).toBeDefined();
    const reviewData = reviewTmpl?.getContent() as PresentationModel;
    expect(reviewData.slides).toHaveLength(3);
    expect(reviewData.slides[0].elements[0].text).toBe('Quarterly Business Review');
  });

  it('returns localized templates with non-empty titles and descriptions', () => {
    const list = getLocalizedTemplates();
    expect(list).toHaveLength(6);
    for (const item of list) {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.description).toBeTruthy();
    }
  });
});

