import { detectFileType } from './detect';
import { addRecentFile } from './recent';
import { EditorState, SupportedFormat } from '../types';
import { importDocx } from '../document/docx/importer';
import { importOdt } from '../document/odt/importer';
import { importRtf } from '../document/rtf/importer';
import { plainTextToHtml, markdownToHtml } from '../document/textMdHtml';
import { htmlToDocument } from '../document/model';
import { applyPageSetup, type PageSetup } from '../document/pageSetup';
import { applyDocChrome, type DocumentChrome } from '../document/chrome';
import { importXlsx, importCsvTsv } from '../spreadsheet/adapters';
import { importPptx } from '../slides/pptxAdapter';
import { t } from '../i18n/instance';
import { stampClean } from './tabs';

function documentWithSetup(
  html: string,
  pageSetup?: PageSetup | null,
  chrome?: DocumentChrome | null,
  footnotes?: Array<{ id: string; text: string }> | null
) {
  let doc = htmlToDocument(html);
  if (pageSetup) doc = applyPageSetup(doc, pageSetup);
  if (chrome) doc = applyDocChrome(doc, chrome);
  if (footnotes && footnotes.length) {
    doc.attrs = { ...(doc.attrs || {}), footnotes };
  }
  return doc;
}

export function legacySoftMakerFormat(fileName: string): 'tmdx' | 'pmdx' | 'prdx' | null {
  const base = fileName.split(/[\\/]/).pop() || fileName;
  const dot = base.lastIndexOf('.');
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
  if (ext === 'tmd') return 'tmdx';
  if (ext === 'pmd') return 'pmdx';
  if (ext === 'prd') return 'prdx';
  return null;
}

/** Older SoftMaker packages become a dirty copy under the modern extension, with no save path. */
export function presentLegacyPackage(state: EditorState, originalName: string): EditorState {
  const format = legacySoftMakerFormat(originalName);
  if (!format) return state;
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  return {
    ...state,
    fileName: `${baseName}.${format}`,
    format,
    filePath: undefined,
    fileHandle: undefined,
    isDirty: true,
    cleanHash: '',
  };
}

/** Stamp the opened editor clean, then restore the dirty pathless copy for an older SoftMaker package. */
export function finishOpenedTab(loaded: EditorState, originalName: string): EditorState {
  return presentLegacyPackage(stampClean(loaded), originalName);
}

export async function loadFileToEditor(
  fileOrBuffer: File | ArrayBuffer,
  fileName: string,
  handle?: FileSystemFileHandle,
  path?: string
): Promise<EditorState> {
  const buffer = fileOrBuffer instanceof File ? await fileOrBuffer.arrayBuffer() : fileOrBuffer;

  const detection = await detectFileType(fileName, buffer);

  if (detection.errorMessage || detection.isLegacyBinary) {
    throw new Error(
      detection.errorMessage ||
        'Legacy Office binary format (.doc, .xls, .ppt) cannot be opened directly. Please save the file as modern .docx, .xlsx, or .pptx.'
    );
  }

  const editorState: EditorState = {
    kind: detection.kind,
    fileName,
    format: detection.format,
    fileHandle: handle,
    filePath: path,
    isDirty: false,
    lastSavedAt: new Date(),
  };

  const textDecoder = new TextDecoder('utf-8');

  switch (detection.kind) {
    case 'document': {
      if (detection.format === 'docx' || detection.format === 'tmdx') {
        const { html, report, pageSetup, chrome, footnotes } = await importDocx(buffer, fileName);
        editorState.documentContent = documentWithSetup(html, pageSetup, chrome, footnotes);
        editorState.importReport = report;
      } else if (detection.format === 'odt') {
        const { html, report, pageSetup, footnotes } = await importOdt(buffer, fileName);
        editorState.documentContent = documentWithSetup(html, pageSetup, null, footnotes);
        editorState.importReport = report;
      } else if (detection.format === 'rtf') {
        const text = textDecoder.decode(buffer);
        const { html, report } = importRtf(text, fileName);
        editorState.documentContent = htmlToDocument(html);
        editorState.importReport = report;
      } else if (detection.format === 'md') {
        const text = textDecoder.decode(buffer);
        editorState.documentContent = htmlToDocument(markdownToHtml(text));
      } else if (detection.format === 'html') {
        const text = textDecoder.decode(buffer);
        editorState.documentContent = htmlToDocument(text);
      } else {
        // Plain text
        const text = textDecoder.decode(buffer);
        editorState.documentContent = htmlToDocument(plainTextToHtml(text));
      }
      break;
    }

    case 'spreadsheet': {
      if (detection.format === 'xlsx' || detection.format === 'pmdx') {
        const { sheets, report } = await importXlsx(buffer, fileName);
        editorState.spreadsheetData = sheets;
        editorState.importReport = report;
      } else if (detection.format === 'csv') {
        const text = textDecoder.decode(buffer);
        const { sheets, report } = importCsvTsv(text, fileName, false);
        editorState.spreadsheetData = sheets;
        editorState.importReport = report;
      } else {
        // tsv
        const text = textDecoder.decode(buffer);
        const { sheets, report } = importCsvTsv(text, fileName, true);
        editorState.spreadsheetData = sheets;
        editorState.importReport = report;
      }
      break;
    }

    case 'presentation': {
      const { presentation, report } = await importPptx(buffer, fileName);
      editorState.presentationData = presentation;
      editorState.importReport = report;
      break;
    }

    case 'pdf': {
      editorState.pdfData = new Uint8Array(buffer);
      break;
    }
  }

  if (detection.isMacroFile) {
    if (!editorState.importReport) {
      editorState.importReport = {
        fileName,
        format: detection.format,
        importedAt: new Date().toISOString(),
        warnings: [],
        skippedFeatures: [],
      };
    }
    editorState.importReport.warnings.push({
      item: t('dialog.vbaItem'),
      reason: t('dialog.vbaReason'),
    });
    editorState.importReport.skippedFeatures.push(t('dialog.vbaItem'));
  }

  // Register in recent files
  await addRecentFile({
    id: `file_${path || fileName}_${Date.now()}`,
    name: fileName,
    kind: detection.kind,
    format: detection.format,
    handle,
    path,
  });

  return presentLegacyPackage(editorState, fileName);
}
