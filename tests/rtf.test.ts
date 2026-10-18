import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { exportRtf } from '../src/document/rtf/exporter';
import { importRtf } from '../src/document/rtf/importer';

describe('RTF Importer and Exporter', () => {
  it('parses sample.rtf fixture including unicode and formatting', () => {
    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/sample.rtf');
    const rtfContent = fs.readFileSync(fixturePath, 'utf-8');
    const { html, report } = importRtf(rtfContent, 'sample.rtf');

    expect(html).toContain('Welcome to Folio');
    expect(html).toContain('<strong>');
    expect(html).toContain('<em>');
    expect(html).toContain('RTF document');
    expect(html).toContain('<u>');
    expect(html).toContain('underline');
    expect(html).toContain('—'); // Em dash decoded from \u8212?
    expect(report.format).toBe('rtf');
  });

  it('exports HTML to RTF and decodes it back', async () => {
    const inputHtml = '<h1>Heading</h1><p>Test with <strong>bold</strong> and <em>italics</em>.</p>';
    const blob = await exportRtf(inputHtml);
    const rtfText = await blob.text();

    expect(rtfText).toContain('{\\rtf1');
    expect(rtfText).toContain('\\b ');
    expect(rtfText).toContain('\\i ');

    const { html } = importRtf(rtfText, 'roundtrip.rtf');
    expect(html).toContain('Heading');
    expect(html).toContain('Test with');
    expect(html).toContain('bold');
  });
});
