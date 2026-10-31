import { EditorState, ImportWarning, SupportedFormat } from '../types';
import { saveToFileSystem } from './fileSystem';
import { documentToHtml } from '../document/model';
import { pageSetupFromDoc } from '../document/pageSetup';
import { chromeFromDoc, hasChromeContent } from '../document/chrome';
import { exportDocx } from '../document/docx/exporter';
import { exportOdt } from '../document/odt/exporter';
import { exportRtf } from '../document/rtf/exporter';
import { htmlToMarkdown, htmlToPlainText, wrapInHtmlDocument } from '../document/textMdHtml';
import { exportXlsx, exportCsvTsv } from '../spreadsheet/adapters';
import { exportPptx } from '../slides/pptxAdapter';
import { getActiveSheet } from './session';

export async function saveEditorContent(
  state: EditorState,
  options: {
    format?: SupportedFormat;
    fileName?: string;
    saveAs?: boolean;
  } = {}
): Promise<{ success: boolean; updatedState?: EditorState; bytes?: Uint8Array }> {
  const format = options.format || state.format;
  let targetName = options.fileName || state.fileName;

  // Ensure file name has matching extension
  const currentExt = targetName.split('.').pop()?.toLowerCase();
  const isHtmlHtm = format === 'html' && (currentExt === 'html' || currentExt === 'htm');
  if (currentExt !== format && !isHtmlHtm) {
    targetName = `${targetName.replace(/\.[^/.]+$/, '')}.${format}`;
  }

  let blob: Blob;
  const additionalWarnings: ImportWarning[] = [];

  try {
    switch (state.kind) {
      case 'document': {
        // DocumentToHtml runs only inside save and export boundaries
        const html = state.documentContent ? documentToHtml(state.documentContent) : '<p></p>';
        const pageSetup = pageSetupFromDoc(state.documentContent);
        const chrome = chromeFromDoc(state.documentContent);
        const footnotes = (state.documentContent?.attrs?.footnotes as Array<{ id: string; text: string }>) || null;

        if (format === 'docx' || format === 'tmdx') {
          blob = await exportDocx(html, pageSetup, chrome, footnotes);
        } else {
          if (hasChromeContent(chrome)) {
            additionalWarnings.push({
              item: 'Headers & Footers',
              reason: `Header and footer are not supported in .${format} and were not saved.`,
            });
          }

          if (format === 'odt') {
            blob = await exportOdt(html, pageSetup, footnotes);
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
        }
        break;
      }

      case 'spreadsheet': {
        const sheets = state.spreadsheetData || [];
        const activeSheet = getActiveSheet(sheets) || {
          name: 'Sheet1',
          id: '1',
          status: 1,
          order: 0,
          row: 0,
          column: 0,
          data: [],
        };
        if (format === 'xlsx' || format === 'pmdx') {
          blob = await exportXlsx(sheets);
        } else if (format === 'tsv') {
          blob = new Blob([exportCsvTsv(activeSheet, true)], {
            type: 'text/tab-separated-values;charset=utf-8',
          });
        } else {
          // csv
          blob = new Blob([exportCsvTsv(activeSheet, false)], {
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

    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const handleToUse = options.saveAs ? undefined : state.fileHandle;
    const pathToUse = options.saveAs ? undefined : state.filePath;
    const saveResult = await saveToFileSystem(blob, targetName, format, handleToUse, pathToUse);

    if (!saveResult.success) {
      return { success: false };
    }

    let report = state.importReport;
    if (additionalWarnings.length > 0) {
      report = {
        fileName: saveResult.newFileName,
        format,
        importedAt: new Date().toISOString(),
        warnings: [...(report?.warnings || []), ...additionalWarnings],
        skippedFeatures: [...(report?.skippedFeatures || []), 'Headers & Footers'],
      };
    }

    const updatedState: EditorState = {
      ...state,
      fileName: saveResult.newFileName,
      format,
      fileHandle: saveResult.handle || (options.saveAs ? undefined : state.fileHandle),
      filePath: saveResult.path || (options.saveAs ? undefined : state.filePath),
      isDirty: false,
      lastSavedAt: new Date(),
      importReport: report,
    };

    return { success: true, updatedState, bytes };
  } catch (err) {
    console.error('Error saving file:', err);
    throw err;
  }
}
