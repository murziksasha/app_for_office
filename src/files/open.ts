import { detectFileType } from './detect';
import { addRecentFile } from './recent';
import { EditorState, SupportedFormat } from '../types';
import { importDocx } from '../document/docx/importer';
import { importOdt } from '../document/odt/importer';
import { importRtf } from '../document/rtf/importer';
import { plainTextToHtml, markdownToHtml } from '../document/textMdHtml';
import { htmlToDocument } from '../document/model';
import { importXlsx, importCsvTsv } from '../spreadsheet/adapters';
import { importPptx } from '../slides/pptxAdapter';

export async function loadFileToEditor(
  fileOrBuffer: File | ArrayBuffer,
  fileName: string,
  handle?: FileSystemFileHandle,
  path?: string
): Promise<EditorState> {
  const buffer = fileOrBuffer instanceof File ? await fileOrBuffer.arrayBuffer() : fileOrBuffer;

  const detection = await detectFileType(fileName, buffer);

  if (detection.isLegacyBinary) {
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
      if (detection.format === 'docx') {
        const { html, report } = await importDocx(buffer, fileName);
        editorState.documentContent = htmlToDocument(html);
        editorState.importReport = report;
      } else if (detection.format === 'odt') {
        const { html, report } = await importOdt(buffer, fileName);
        editorState.documentContent = htmlToDocument(html);
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
      if (detection.format === 'xlsx') {
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
      item: 'VBA Macros',
      reason: 'Embedded macro code was safely ignored and will not execute.',
    });
    editorState.importReport.skippedFeatures.push('VBA Macros');
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

  return editorState;
}

