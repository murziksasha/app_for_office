export type RibbonTab =
  | 'file'
  | 'home'
  | 'insert'
  | 'layout'
  | 'references'
  | 'data'
  | 'design'
  | 'slideshow'
  | 'view'
  | 'table'
  | 'picture';

export function tabsFor(kind: string): RibbonTab[] {
  if (kind === 'pdf') return ['file'];
  if (kind === 'document') return ['file', 'home', 'insert', 'layout', 'references', 'view'];
  if (kind === 'presentation') return ['file', 'home', 'insert', 'design', 'slideshow', 'view'];
  if (kind === 'spreadsheet') return ['file', 'home', 'insert', 'layout', 'data', 'view'];
  return ['file', 'home', 'insert'];
}
