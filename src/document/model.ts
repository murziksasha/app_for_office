import { generateJSON, generateHTML, JSONContent, AnyExtension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Superscript } from '@tiptap/extension-superscript';
import { Subscript } from '@tiptap/extension-subscript';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { FontFamily } from '@tiptap/extension-font-family';
import { CharacterCount } from '@tiptap/extension-character-count';
import { Placeholder } from '@tiptap/extension-placeholder';
import { FontSize } from './extensions/fontSize';
import { Indent } from './extensions/indent';
import { LineSpacing } from './extensions/lineSpacing';
import { StyleName } from './extensions/styleName';
import { TableOfContentsExtension } from './extensions/toc';
import { FootnoteRef } from './extensions/footnote';
import { PageBreak } from './extensions/pageBreak';
import { FolioDocument } from './extensions/folioDocument';
import { PageGaps } from './extensions/pageGaps';
import { SpellCheck } from './spell/spellPlugin';
import { applyPageSetup, DEFAULT_PAGE_SETUP } from './pageSetup';
import { applyDocChrome, createEmptyChrome } from './chrome';
import { sanitizeHtml } from './sanitize';

export type DocumentModel = JSONContent;

export const defaultDocumentModel: DocumentModel = {
  type: 'doc',
  attrs: {
    pageSetup: { ...DEFAULT_PAGE_SETUP },
    chrome: { ...createEmptyChrome() },
    footnotes: [],
  },
  content: [{ type: 'paragraph' }],
};

export const documentExtensions: AnyExtension[] = [
  FolioDocument,
  StarterKit.configure({
    document: false,
    heading: { levels: [1, 2, 3, 4, 5, 6] },
    link: false,
    underline: false,
  }),
  Underline,
  Superscript,
  Subscript,
  Table.configure({
    resizable: true,
  }),
  TableRow,
  TableHeader,
  TableCell,
  Image.configure({
    inline: true,
    allowBase64: true,
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      class: 'folio-link',
    },
  }),
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
  FontFamily,
  CharacterCount,
  Placeholder.configure({
    placeholder: 'Type your document here...',
  }),
  FontSize,
  Indent,
  LineSpacing,
  StyleName,
  TableOfContentsExtension,
  FootnoteRef,
  PageBreak,
  PageGaps,
  SpellCheck,
];

/**
 * Sanitizes incoming HTML using DOMPurify, then generates Tiptap JSON.
 * Importers feed sanitized HTML into this function to produce the in-app document model.
 */
export function htmlToDocument(rawHtml: string): DocumentModel {
  if (!rawHtml || typeof rawHtml !== 'string' || rawHtml.trim() === '') {
    return defaultDocumentModel;
  }

  // Sanitize first to drop scripts and dangerous tags
  const sanitized = sanitizeHtml(rawHtml);
  if (!sanitized || sanitized.trim() === '') {
    return defaultDocumentModel;
  }

  try {
    const json = generateJSON(sanitized, documentExtensions);
    if (!json || !json.content || json.content.length === 0) {
      return defaultDocumentModel;
    }
    return applyDocChrome(applyPageSetup(json));
  } catch (err) {
    console.warn('Failed to parse HTML to document JSON, returning default model:', err);
    return defaultDocumentModel;
  }
}

/**
 * Converts stored Tiptap JSON into an HTML string.
 * This runs ONLY inside save and export boundaries.
 */
export function documentToHtml(doc: DocumentModel): string {
  if (!doc || !doc.type) {
    return '<p></p>';
  }

  try {
    return generateHTML(doc, documentExtensions);
  } catch (err) {
    console.warn('Failed to generate HTML from document model:', err);
    return '<p></p>';
  }
}
