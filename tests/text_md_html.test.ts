import { describe, it, expect } from 'vitest';
import {
  plainTextToHtml,
  htmlToPlainText,
  markdownToHtml,
  htmlToMarkdown,
  wrapInHtmlDocument,
} from '../src/document/textMdHtml';
import { sanitizeHtml } from '../src/document/sanitize';

describe('Text, Markdown, and HTML pipelines', () => {
  it('converts plain text to paragraphs and back', () => {
    const rawText = 'First paragraph with some details.\n\nSecond paragraph here.';
    const html = plainTextToHtml(rawText);
    expect(html).toContain('<p>First paragraph with some details.</p>');
    expect(html).toContain('<p>Second paragraph here.</p>');

    const backToText = htmlToPlainText(html);
    expect(backToText).toContain('First paragraph with some details.');
    expect(backToText).toContain('Second paragraph here.');
  });

  it('renders markdown to sanitized HTML', () => {
    const md = '# Header 1\n\n**Bold** text and [a link](https://example.com)';
    const html = markdownToHtml(md);
    expect(html).toContain('<h1>Header 1</h1>');
    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('<a href="https://example.com">a link</a>');
  });

  it('converts HTML to markdown using turndown with tables', () => {
    const html = '<h1>Heading</h1><p>A paragraph with <strong>bold</strong> words.</p>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('# Heading');
    expect(md).toContain('**bold**');
  });

  it('wraps HTML in standalone document template', () => {
    const body = '<p>Body text</p>';
    const doc = wrapInHtmlDocument(body, 'My Doc');
    expect(doc).toContain('<!DOCTYPE html>');
    expect(doc).toContain('<title>My Doc</title>');
    expect(doc).toContain('<p>Body text</p>');
  });

  it('DOMPurify sanitizes dangerous script tags and event handlers', () => {
    const dangerous = '<p>Safe</p><script>alert("xss")</script><img src="x" onerror="evil()" />';
    const sanitized = sanitizeHtml(dangerous);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('onerror');
    expect(sanitized).toContain('<p>Safe</p>');
  });
});

