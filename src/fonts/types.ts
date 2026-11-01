export type FontCategory = 'serif' | 'sans-serif' | 'monospace' | 'display' | 'handwriting';
export type FontStyleName = 'regular' | 'bold' | 'italic' | 'boldItalic';
export type FontCoverage = 'full' | 'partial';
export type FontEmbedding = 'installable' | 'editable' | 'preview' | 'restricted';
export type FontOrigin = 'bundled' | 'custom';

export interface FontFaceRecord {
  style: FontStyleName;
  file: string;
  sha256: string;
  weight: number;
  italic: boolean;
  embedding: FontEmbedding;
}

export interface FontFamilyRecord {
  family: string;
  category: FontCategory;
  license: string;
  licenseFile: string;
  coverage: FontCoverage;
  faces: FontFaceRecord[];
  origin: FontOrigin;
}

export interface FontCatalogFile {
  revision: string;
  source: string;
  families: Array<Omit<FontFamilyRecord, 'origin'>>;
}
