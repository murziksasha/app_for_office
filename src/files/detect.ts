import JSZip from 'jszip';
import { DocumentKind, SupportedFormat } from '../types';

export interface FileDetectionResult {
  kind: DocumentKind;
  format: SupportedFormat;
  isLegacyBinary?: boolean;
  isMacroFile?: boolean;
  errorMessage?: string;
}

const EXTENSION_MAP: Record<string, { kind: DocumentKind; format: SupportedFormat }> = {
  // Document
  docx: { kind: 'document', format: 'docx' },
  odt: { kind: 'document', format: 'odt' },
  rtf: { kind: 'document', format: 'rtf' },
  txt: { kind: 'document', format: 'txt' },
  md: { kind: 'document', format: 'md' },
  markdown: { kind: 'document', format: 'md' },
  html: { kind: 'document', format: 'html' },
  htm: { kind: 'document', format: 'html' },

  // Spreadsheet
  xlsx: { kind: 'spreadsheet', format: 'xlsx' },
  csv: { kind: 'spreadsheet', format: 'csv' },
  tsv: { kind: 'spreadsheet', format: 'tsv' },

  // Presentation
  pptx: { kind: 'presentation', format: 'pptx' },

  // PDF
  pdf: { kind: 'pdf', format: 'pdf' },
};

/**
 * Checks for Microsoft Office 97-2003 OLE Compound Binary signature: D0 CF 11 E0 A1 B1 1A E1
 */
export function isOleBinary(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 8) return false;
  const bytes = new Uint8Array(buffer, 0, 8);
  return (
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1
  );
}

/**
 * Checks for PK zip header: 50 4B 03 04
 */
export function isZipBinary(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const bytes = new Uint8Array(buffer, 0, 4);
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/**
 * Detects format and kind from file name, extension, and binary header inspection.
 */
export async function detectFileType(
  fileName: string,
  buffer?: ArrayBuffer
): Promise<FileDetectionResult> {
  const parts = fileName.toLowerCase().split('.');
  const ext = parts.length > 1 ? parts.pop() || '' : '';

  // 1. Check legacy binary files
  if (ext === 'doc' || ext === 'xls' || ext === 'ppt') {
    return {
      kind: ext === 'doc' ? 'document' : ext === 'xls' ? 'spreadsheet' : 'presentation',
      format: (ext === 'doc' ? 'docx' : ext === 'xls' ? 'xlsx' : 'pptx') as SupportedFormat,
      isLegacyBinary: true,
      errorMessage: `Legacy Office binary format (.${ext}) is not supported. Please open this file in Microsoft Office or LibreOffice and save it as modern .${ext === 'doc' ? 'docx' : ext === 'xls' ? 'xlsx' : 'pptx'} or export as plain text.`,
    };
  }

  // 2. Check macro files (.docm, .xlsm, .pptm)
  if (ext === 'docm' || ext === 'xlsm' || ext === 'pptm') {
    const fallbackFormat = ext === 'docm' ? 'docx' : ext === 'xlsm' ? 'xlsx' : 'pptx';
    const fallbackKind = ext === 'docm' ? 'document' : ext === 'xlsm' ? 'spreadsheet' : 'presentation';
    return {
      kind: fallbackKind as DocumentKind,
      format: fallbackFormat as SupportedFormat,
      isMacroFile: true,
    };
  }

  // 3. Inspect binary if provided
  if (buffer) {
    if (isOleBinary(buffer)) {
      return {
        kind: 'document',
        format: 'docx',
        isLegacyBinary: true,
        errorMessage: `This file appears to be an older binary Office document (97-2003 format). Folio requires modern Open XML format (.docx, .xlsx, .pptx) or open standards (.odt, .csv, .md).`,
      };
    }

    if (isZipBinary(buffer)) {
      try {
        const zip = await JSZip.loadAsync(buffer);
        if (zip.file('word/document.xml')) {
          return { kind: 'document', format: 'docx' };
        }
        if (zip.file('xl/workbook.xml')) {
          return { kind: 'spreadsheet', format: 'xlsx' };
        }
        if (zip.file('ppt/presentation.xml')) {
          return { kind: 'presentation', format: 'pptx' };
        }
        if (zip.file('content.xml') && (zip.file('mimetype') || zip.file('styles.xml'))) {
          return { kind: 'document', format: 'odt' };
        }
      } catch {
        // Zip read failed, fall through to extension match
      }
    }

    // Check PDF header %PDF-
    if (buffer.byteLength >= 5) {
      const headerStr = String.fromCharCode(...new Uint8Array(buffer, 0, 5));
      if (headerStr === '%PDF-') {
        return { kind: 'pdf', format: 'pdf' };
      }
    }
  }

  // 4. Fallback to extension mapping
  if (EXTENSION_MAP[ext]) {
    return EXTENSION_MAP[ext];
  }

  // Default fallback
  return {
    kind: 'document',
    format: 'txt',
  };
}

