import { DocumentKind, SupportedFormat } from '../types';
import { t } from '../i18n/instance';

export interface DiskStamp {
  modifiedMs: number;
  len: number;
}

export interface PathStatus {
  exists: boolean;
  parentExists: boolean;
  modifiedMs: number | null;
  len: number | null;
}

export interface TabRef {
  id: string;
  path?: string;
  dirty: boolean;
}

export interface OpenCandidate {
  key: string;
  path?: string;
  folder?: boolean;
  error?: string;
  hasDraft?: boolean;
  diskNewer?: boolean;
  /** Opening the recovered draft itself, rather than the file path. */
  intent?: 'path' | 'draft';
  /** Set when identity was proven without a path, for example a browser file handle. */
  existingTabId?: string;
}

export type OpenAction =
  | { type: 'ignore' }
  | { type: 'fail'; message: string }
  | { type: 'skip' }
  | { type: 'focus'; tabId: string }
  | { type: 'focus-dirty'; tabId: string; message: string }
  | { type: 'ask-reload'; tabId: string }
  | { type: 'ask-draft' }
  | { type: 'ask-replace'; tabId: string }
  | { type: 'open' };

export interface OpenPlan {
  actions: { key: string; action: OpenAction }[];
  /** Where focus goes after the batch, once opens have happened. */
  activation: 'keep' | 'first-open' | 'focus-existing';
}

export type SaveDecision =
  | { kind: 'save-as'; reason: 'no-path' | 'missing' | 'macro' }
  | { kind: 'conflict' }
  | { kind: 'overwrite' }
  | { kind: 'already-open'; ownerId: string };

export const SAVE_BUTTONS = ['Save', "Don't save", 'Cancel'] as const;
export const RELOAD_BUTTONS = ['Reload', 'Keep'] as const;
export const DRAFT_OPEN_BUTTONS = ['Restore', 'Open from disk'] as const;
export const DRAFT_REPLACE_BUTTONS = ['Replace', 'Keep'] as const;
export const CONFLICT_BUTTONS = ['Overwrite', 'Save As', 'Cancel'] as const;

export function normalizePath(path: string): string {
  const unified = path.replace(/\//g, '\\');
  const unc = unified.startsWith('\\\\');
  const collapsed = unified.replace(/\\+/g, '\\').replace(/\\$/, '');
  const restored = unc ? `\\${collapsed}` : collapsed;
  return restored.toLowerCase();
}

export function pathsMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return normalizePath(a) === normalizePath(b);
}

export function contentHash(value: unknown): string {
  const text = JSON.stringify(value) ?? 'null';
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16)}-${(h2 >>> 0).toString(16)}-${text.length}`;
}

export function isDirtyHash(contentHashValue: string, cleanHash: string): boolean {
  return contentHashValue !== cleanHash;
}

export function findTabByPath(tabs: TabRef[], path?: string | null): TabRef | undefined {
  if (!path) return undefined;
  return tabs.find((tab) => pathsMatch(tab.path, path));
}

export function nextFileName(
  kind: 'document' | 'spreadsheet' | 'presentation',
  openNames: string[],
  baseTitle?: string
): string {
  const used = new Set(openNames.map((name) => name.toLowerCase()));

  if (baseTitle) {
    const cleanBase = baseTitle.replace(/\.[^/.]+$/, '');
    if (!used.has(cleanBase.toLowerCase()) && !used.has(`${cleanBase}.docx`.toLowerCase())) {
      return cleanBase;
    }
    let n = 2;
    while (
      used.has(`${cleanBase} ${n}`.toLowerCase()) ||
      used.has(`${cleanBase}${n}`.toLowerCase()) ||
      used.has(`${cleanBase} ${n}.docx`.toLowerCase()) ||
      used.has(`${cleanBase}${n}.docx`.toLowerCase())
    ) {
      n += 1;
    }
    return `${cleanBase} ${n}`;
  }

  const base = kind === 'document' ? 'Document' : kind === 'spreadsheet' ? 'Workbook' : 'Presentation';
  const ext = kind === 'document' ? 'docx' : kind === 'spreadsheet' ? 'xlsx' : 'pptx';
  let n = 1;
  while (used.has(`${base}${n}.${ext}`.toLowerCase())) n += 1;
  return `${base}${n}.${ext}`;
}

export function nextDirtyIndex(tabs: { dirty: boolean }[], start: number): number {
  for (let i = start; i < tabs.length; i++) {
    if (tabs[i].dirty) return i;
  }
  return -1;
}

/** A save that does not finish stops the close. Discard moves on. Cancel stops. */
export function closeContinues(choice: string | null, saveResult?: 'ok' | 'cancelled' | 'failed'): boolean {
  if (choice === "Don't save") return true;
  if (choice === 'Save') return saveResult === 'ok';
  return false;
}

export function shouldRemoveRecent(status: Pick<PathStatus, 'exists' | 'parentExists'>): boolean {
  return status.parentExists && !status.exists;
}

export function isDiskNewer(stamp: DiskStamp | null | undefined, status: PathStatus | null | undefined): boolean {
  if (!stamp || !status?.exists) return false;
  if (status.modifiedMs == null || status.len == null) return false;
  return status.modifiedMs !== stamp.modifiedMs || status.len !== stamp.len;
}

export function decideSave(args: {
  selfId: string;
  targetPath?: string | null;
  status: PathStatus | null;
  stamp?: DiskStamp | null;
  openTabs: TabRef[];
}): SaveDecision {
  const target = args.targetPath?.trim();
  if (!target) return { kind: 'save-as', reason: 'no-path' };
  if (isMacroPath(target)) return { kind: 'save-as', reason: 'macro' };

  const owner = args.openTabs.find((tab) => tab.id !== args.selfId && pathsMatch(tab.path, target));
  if (owner) return { kind: 'already-open', ownerId: owner.id };

  if (!args.status) return { kind: 'overwrite' };
  if (!args.status.exists) return { kind: 'save-as', reason: 'missing' };
  if (isDiskNewer(args.stamp, args.status)) return { kind: 'conflict' };
  return { kind: 'overwrite' };
}

export function printScopeNeeded(kind: 'document' | 'spreadsheet' | 'presentation' | 'pdf', unitCount: number): boolean {
  if (kind === 'document') return false;
  return unitCount > 1;
}

export function defaultPrintChoice(kind: 'spreadsheet' | 'presentation' | 'pdf'): string {
  if (kind === 'spreadsheet') return 'Active sheet';
  if (kind === 'presentation') return 'All slides';
  return 'All pages';
}

export function printButtons(kind: 'spreadsheet' | 'presentation' | 'pdf'): string[] {
  if (kind === 'spreadsheet') return ['Active sheet', 'All sheets', 'Cancel'];
  if (kind === 'presentation') return ['All slides', 'This slide', 'Cancel'];
  return ['All pages', 'This page', 'Cancel'];
}

export function printScopeFromChoice(choice: string | null): 'current' | 'all' | 'cancel' {
  if (!choice || choice === 'Cancel') return 'cancel';
  if (choice.startsWith('All')) return 'all';
  return 'current';
}

function boundTab(item: OpenCandidate, tabs: TabRef[]): TabRef | undefined {
  if (item.existingTabId) return tabs.find((tab) => tab.id === item.existingTabId);
  return findTabByPath(tabs, item.path);
}

export function planOpenBatch(items: OpenCandidate[], tabs: TabRef[], hasActiveTab: boolean): OpenPlan {
  const actionable = items.filter((item) => !item.folder && !item.error);
  const existingCount = actionable.filter((item) => item.intent !== 'draft' && boundTab(item, tabs)).length;
  const allExisting = actionable.length > 0 && existingCount === actionable.length;
  let focusedExisting = false;

  const actions = items.map((item) => {
    if (item.folder) return { key: item.key, action: { type: 'ignore' } as OpenAction };
    if (item.error) return { key: item.key, action: { type: 'fail', message: item.error } as OpenAction };

    const tab = boundTab(item, tabs);

    if (item.intent === 'draft') {
      if (tab?.dirty) {
        return {
          key: item.key,
          action: {
            type: 'focus-dirty',
            tabId: tab.id,
            message: t('dialog.alreadyOpenDirty'),
          } as OpenAction,
        };
      }
      if (tab) return { key: item.key, action: { type: 'ask-replace', tabId: tab.id } as OpenAction };
      return { key: item.key, action: { type: 'open' } as OpenAction };
    }

    if (tab) {
      const shouldHandle = allExisting ? !focusedExisting : actionable.length === 1;
      if (allExisting && shouldHandle) focusedExisting = true;
      if (!shouldHandle) return { key: item.key, action: { type: 'skip' } as OpenAction };
      if (tab.dirty) {
        return {
          key: item.key,
          action: {
            type: 'focus-dirty',
            tabId: tab.id,
            message: t('dialog.alreadyOpenDirty'),
          } as OpenAction,
        };
      }
      if (item.diskNewer) return { key: item.key, action: { type: 'ask-reload', tabId: tab.id } as OpenAction };
      return { key: item.key, action: { type: 'focus', tabId: tab.id } as OpenAction };
    }

    if (item.hasDraft) return { key: item.key, action: { type: 'ask-draft' } as OpenAction };
    return { key: item.key, action: { type: 'open' } as OpenAction };
  });

  let activation: OpenPlan['activation'] = 'keep';
  if (!hasActiveTab) activation = 'first-open';
  else if (allExisting) activation = 'focus-existing';

  return { actions, activation };
}

export interface HandleLike {
  isSameEntry?: (other: never) => Promise<boolean>;
}

export async function findTabByHandle(
  tabs: { id?: string; fileHandle?: HandleLike | null }[],
  handle?: HandleLike | null
): Promise<string | null> {
  if (!handle?.isSameEntry) return null;
  for (const tab of tabs) {
    if (!tab.id || !tab.fileHandle?.isSameEntry) continue;
    try {
      if (await handle.isSameEntry(tab.fileHandle as never)) return tab.id;
    } catch {
      // An unproven comparison never focuses a tab.
    }
  }
  return null;
}

export const MACRO_EXTENSIONS = new Set(['docm', 'xlsm', 'pptm']);

export function isMacroPath(path?: string | null): boolean {
  if (!path) return false;
  const parts = path.split(/[\\/]/);
  const name = parts.pop() || path;
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return false;
  const ext = name.slice(dot + 1).toLowerCase();
  return MACRO_EXTENSIONS.has(ext);
}

export function isSafeSavePath(path?: string | null): boolean {
  return Boolean(path && !isMacroPath(path));
}

export function suggestedSaveName(fileName: string, currentFormat: SupportedFormat): string {
  const parts = fileName.split(/[\\/]/);
  const name = parts.pop() || fileName;
  const lastDot = name.lastIndexOf('.');
  if (lastDot <= 0) {
    const ext = currentFormat;
    return `${name}.${ext}`;
  }
  const base = name.slice(0, lastDot);
  const ext = name.slice(lastDot + 1).toLowerCase();
  if (ext === 'docm') return `${base}.docx`;
  if (ext === 'xlsm') return `${base}.xlsx`;
  if (ext === 'pptm') return `${base}.pptx`;
  return name;
}

export interface FormatFilter {
  format: SupportedFormat;
  label: string;
  extensions: string[];
}

const DOCUMENT_FILTERS: FormatFilter[] = [
  { format: 'docx', label: 'Document', extensions: ['docx'] },
  { format: 'tmdx', label: 'Document', extensions: ['tmdx'] },
  { format: 'odt', label: 'OpenDocument Text', extensions: ['odt'] },
  { format: 'rtf', label: 'Rich Text Format', extensions: ['rtf'] },
  { format: 'txt', label: 'Plain Text', extensions: ['txt'] },
  { format: 'md', label: 'Markdown Document', extensions: ['md'] },
  { format: 'html', label: 'HTML Document', extensions: ['html', 'htm'] },
];

const SPREADSHEET_FILTERS: FormatFilter[] = [
  { format: 'xlsx', label: 'Spreadsheet', extensions: ['xlsx'] },
  { format: 'pmdx', label: 'Spreadsheet', extensions: ['pmdx'] },
  { format: 'csv', label: 'Comma Separated Values', extensions: ['csv'] },
  { format: 'tsv', label: 'Tab Separated Values', extensions: ['tsv'] },
];

const PRESENTATION_FILTERS: FormatFilter[] = [
  { format: 'pptx', label: 'Presentation', extensions: ['pptx'] },
  { format: 'prdx', label: 'Presentation', extensions: ['prdx'] },
];

const PDF_FILTERS: FormatFilter[] = [
  { format: 'pdf', label: 'PDF Document', extensions: ['pdf'] },
];

export function saveFiltersForKind(kind: DocumentKind, currentFormat?: SupportedFormat): FormatFilter[] {
  let base: FormatFilter[];
  switch (kind) {
    case 'spreadsheet':
      base = SPREADSHEET_FILTERS;
      break;
    case 'presentation':
      base = PRESENTATION_FILTERS;
      break;
    case 'pdf':
      base = PDF_FILTERS;
      break;
    case 'document':
    default:
      base = DOCUMENT_FILTERS;
      break;
  }

  const list = base.map((f) => ({ ...f, extensions: [...f.extensions] }));
  if (currentFormat) {
    const idx = list.findIndex((f) => f.format === currentFormat);
    if (idx > 0) {
      const [item] = list.splice(idx, 1);
      list.unshift(item);
    }
  }
  return list;
}

export function resolvePickedName(
  pickedName: string,
  kind: DocumentKind,
  currentFileName: string,
  currentFormat: SupportedFormat
): { ok: true; fileName: string; format: SupportedFormat } | { ok: false; message: string } {
  const parts = pickedName.split(/[\\/]/);
  const name = parts.pop() || pickedName;
  const lastDot = name.lastIndexOf('.');

  // Bare name: no dot or dot is first char (hidden file) or dot at the end
  if (lastDot <= 0 || lastDot === name.length - 1) {
    const cleanBase = lastDot === name.length - 1 ? name.slice(0, lastDot) : name;
    // Current file's extension:
    const currentParts = currentFileName.split(/[\\/]/);
    const currName = currentParts.pop() || currentFileName;
    const currDot = currName.lastIndexOf('.');
    let currExt = currDot > 0 ? currName.slice(currDot + 1).toLowerCase() : currentFormat;
    // If macro, rewrite to writable
    if (currExt === 'docm') currExt = 'docx';
    else if (currExt === 'xlsm') currExt = 'xlsx';
    else if (currExt === 'pptm') currExt = 'pptx';

    const fmt = currExt === 'htm' ? 'html' : (currExt as SupportedFormat);
    return {
      ok: true,
      fileName: `${cleanBase}.${currExt}`,
      format: fmt,
    };
  }

  const ext = name.slice(lastDot + 1).toLowerCase();
  if (ext === 'htm') {
    if (kind === 'document') {
      return { ok: true, fileName: name, format: 'html' };
    }
    return { ok: false, message: t('dialog.badExtension', { name, ext: '.htm', kind }) };
  }

  const allowedFilters = saveFiltersForKind(kind);
  const matched = allowedFilters.find((f) => f.format === ext || f.extensions.includes(ext));
  if (matched) {
    return { ok: true, fileName: name, format: matched.format };
  }

  return {
    ok: false,
    message: t('dialog.badExtension', { name, ext: `.${ext}`, kind }),
  };
}

const LOSSY_FORMATS = new Set<SupportedFormat>(['txt', 'md', 'csv', 'tsv']);

export function isLossySave(currentFormat: SupportedFormat, targetFormat: SupportedFormat): boolean {
  if (currentFormat === targetFormat) return false;
  return LOSSY_FORMATS.has(targetFormat);
}

export function getActiveSheet<T extends { status?: number; name?: string }>(
  sheets?: T[] | null
): T | undefined {
  if (!sheets || sheets.length === 0) return undefined;
  return sheets.find((s) => s.status === 1) || sheets[0];
}

export function lossyWarningMessage(targetFormat: SupportedFormat, sheetName?: string): string {
  if (targetFormat === 'csv' || targetFormat === 'tsv') {
    const sheet = sheetName || 'Sheet1';
    return t('dialog.lossySheet', { format: targetFormat.toUpperCase(), sheet });
  }
  if (targetFormat === 'txt') {
    return t('dialog.lossyTxt');
  }
  if (targetFormat === 'md') {
    return t('dialog.lossyMd');
  }
  return t('dialog.lossyGeneric');
}
