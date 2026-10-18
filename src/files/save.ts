import { EditorState, SupportedFormat } from '../types';
import { saveToFileSystem } from './fileSystem';
import { documentToHtml } from '../document/model';
import { exportDocx } from '../document/docx/exporter';
import { exportOdt } from '../document/odt/exporter';
import { exportRtf } from '../document/rtf/exporter';
import { htmlToMarkdown, htmlToPlainText, wrapInHtmlDocument } from '../document/textMdHtml';
import { exportXlsx, exportCsvTsv } from '../spreadsheet/adapters';
import { exportPptx } from '../slides/pptxAdapter';

export async function saveEditorContent(
  state: EditorState,
  options: {
    format?: SupportedFormat;
    fileName?: string;
    saveAs?: boolean;
  } = {}
): Promise<{ success: boolean; updatedState?: EditorState }> {
  const format = options.format || state.format;
  let targetName = options.fileName || state.fileName;

  // Ensure file name has matching extension
  const currentExt = targetName.split('.').pop()?.toLowerCase();
  if (currentExt !== format) {
    targetName = `${targetName.replace(/\.[^/.]+$/, '')}.${format}`;
  }

  let blob: Blob;

  try {
    switch (state.kind) {
      case 'document': {
        // DocumentToHtml runs only inside save and export boundaries
        const html = state.documentContent ? documentToHtml(state.documentContent) : '<p></p>';
        if (format === 'docx') {
          blob = await exportDocx(html);
        } else if (format === 'odt') {
          blob = await exportOdt(html);
        } else if (format === 'rtf') {
          blob = await exportRtf(html);
        } else if (format === 'md') {
          blob = new Blob([htmlToMarkdown(html)], { type: 'text/markdown;charset=utf-8' });
        } else if (format === 'html') {
          blob = new Blob([wrapInHtmlDocument(html, targetName)], { type: 'text/html;charset=utf-8' });
        } else {
          // txt
          blob = new Blob([htmlToPlainText(html)], { type: 'text/plain;charset=utf-8' });
        }
        break;
      }

      case 'spreadsheet': {
        const sheets = state.spreadsheetData || [];
        if (format === 'xlsx') {
          blob = await exportXlsx(sheets);
        } else if (format === 'tsv') {
          blob = new Blob([sheets.length > 0 ? exportCsvTsv(sheets[0], true) : ''], {
            type: 'text/tab-separated-values;charset=utf-8',
          });
        } else {
          // csv
          blob = new Blob([sheets.length > 0 ? exportCsvTsv(sheets[0], false) : ''], {
            type: 'text/csv;charset=utf-8',
          });
        }
        break;
      }

      case 'presentation': {
        const pres = state.presentationData || { title: targetName, slides: [] };
        blob = await exportPptx(pres);
        break;
      }

      case 'pdf': {
        if (!state.pdfData) {
          throw new Error('No PDF data to save');
        }
        blob = new Blob([state.pdfData as any], { type: 'application/pdf' });
        break;
      }

      default:
        throw new Error(`Unsupported document kind: ${state.kind}`);
    }

    const handleToUse = options.saveAs ? undefined : state.fileHandle;
    const pathToUse = options.saveAs ? undefined : state.filePath;
    const saveResult = await saveToFileSystem(blob, targetName, format, handleToUse, pathToUse);

    if (!saveResult.success) {
      return { success: false };
    }

    const updatedState: EditorState = {
      ...state,
      fileName: saveResult.newFileName,
      format,
      fileHandle: saveResult.handle || (options.saveAs ? undefined : state.fileHandle),
      filePath: saveResult.path || (options.saveAs ? undefined : state.filePath),
      isDirty: false,
      lastSavedAt: new Date(),
    };

    return { success: true, updatedState };
  } catch (err) {
    console.error('Error saving file:', err);
    throw err;
  }
}
