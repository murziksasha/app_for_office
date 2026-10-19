import type { JSONContent } from '@tiptap/core';

export type DocumentKind = 'document' | 'spreadsheet' | 'presentation' | 'pdf';

export type SupportedFormat =
  | 'docx'
  | 'odt'
  | 'rtf'
  | 'txt'
  | 'md'
  | 'html'
  | 'xlsx'
  | 'csv'
  | 'tsv'
  | 'pptx'
  | 'pdf';

export interface ImportWarning {
  item: string;
  reason: string;
}

export interface ImportReport {
  fileName: string;
  format: SupportedFormat | string;
  importedAt: string;
  fallbackUsed?: boolean;
  warnings: ImportWarning[];
  skippedFeatures: string[];
}

export interface RecentItem {
  id: string;
  name: string;
  kind: DocumentKind;
  format: SupportedFormat;
  lastOpened: number;
  handle?: FileSystemFileHandle;
  path?: string;
}

export interface DraftItem {
  id: string;
  name: string;
  kind: DocumentKind;
  format: SupportedFormat;
  content: any;
  updatedAt: number;
  path?: string;
  cleanHash?: string;
  diskStamp?: { modifiedMs: number; len: number } | null;
}

// Slide model
export interface SlideElement {
  id: string;
  type: 'text' | 'image' | 'rect' | 'video';
  x: number; // percentage or pt (0-100% or px)
  y: number;
  width: number;
  height: number;
  // text properties
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: 'left' | 'center' | 'right';
  // image properties
  src?: string;
  // shape properties
  fill?: string;
  borderColor?: string;
  borderWidth?: number;
}

export interface Slide {
  id: string;
  title?: string;
  background?: string;
  elements: SlideElement[];
}

export interface PresentationModel {
  title: string;
  slides: Slide[];
}

export interface EditorState {
  id?: string;
  kind: DocumentKind;
  fileName: string;
  format: SupportedFormat;
  filePath?: string;
  fileHandle?: FileSystemFileHandle;
  isDirty: boolean;
  cleanHash?: string;
  contentHash?: string;
  diskStamp?: { modifiedMs: number; len: number } | null;
  lastSavedAt?: Date;
  importReport?: ImportReport | null;
  historyEpoch?: number;
  // Payload for document, spreadsheet, presentation, or pdf
  documentContent?: JSONContent; // Tiptap JSON
  spreadsheetData?: any[]; // FortuneSheet sheets
  presentationData?: PresentationModel;
  pdfData?: Uint8Array;
}

