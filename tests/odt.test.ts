import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { exportOdt } from '../src/document/odt/exporter';
import { importOdt } from '../src/document/odt/importer';

describe('ODT Importer and Exporter', () => {
  it('exports minimal valid ODT package with uncompressed mimetype', async () => {
    const inputHtml = '<h1>OpenDocument Title</h1><p>Testing <strong>bold</strong> text in ODT.</p>';
    const blob = await exportOdt(inputHtml);
    expect(blob.size).toBeGreaterThan(100);

    const buffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    // Verify ODF package spec
    expect(zip.file('mimetype')).not.toBeNull();
    const mimetypeText = await zip.file('mimetype')!.async('text');
    expect(mimetypeText).toBe('application/vnd.oasis.opendocument.text');

    expect(zip.file('content.xml')).not.toBeNull();
    expect(zip.file('styles.xml')).not.toBeNull();
    expect(zip.file('META-INF/manifest.xml')).not.toBeNull();
  });

  it('imports pre-generated sample.odt fixture', async () => {
    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/sample.odt');
    const buffer = fs.readFileSync(fixturePath);
    const { html, report } = await importOdt(buffer.buffer as ArrayBuffer, 'sample.odt');

    expect(html).toContain('Project Scope');
    expect(html).toContain('OpenDocument');
    expect(report.format).toBe('odt');
  });

  it('round-trips HTML through export and import', async () => {
    const inputHtml = '<h1>Heading Test</h1><p>Simple <em>italic</em> run.</p>';
    const blob = await exportOdt(inputHtml);
    const buffer = await blob.arrayBuffer();
    const { html } = await importOdt(buffer, 'roundtrip.odt');

    expect(html).toContain('Heading Test');
    expect(html).toContain('Simple');
  });
});

