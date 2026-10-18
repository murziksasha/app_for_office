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
}

export interface DraftItem {
  id: string;
  name: string;
  kind: DocumentKind;
  format: SupportedFormat;
  content: any;
  updatedAt: number;
}

// Slide model
export interface SlideElement {
  id: string;
  type: 'text' | 'image' | 'rect';
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
  kind: DocumentKind;
  fileName: string;
  format: SupportedFormat;
  fileHandle?: FileSystemFileHandle;
  isDirty: boolean;
  lastSavedAt?: Date;
  importReport?: ImportReport | null;
  // Payload for document, spreadsheet, presentation, or pdf
  documentContent?: any; // HTML string or Tiptap JSON
  spreadsheetData?: any[]; // FortuneSheet sheets
  presentationData?: PresentationModel;
  pdfData?: Uint8Array;
}

