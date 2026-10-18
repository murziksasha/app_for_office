/**
 * Pure file-lifecycle decisions for the tabbed shell.
 * React and Rust perform the results. They do not re-decide them.
 */

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
  | { kind: 'save-as'; reason: 'no-path' | 'missing' }
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
  openNames: string[]
): string {
  const base = kind === 'document' ? 'Document' : kind === 'spreadsheet' ? 'Workbook' : 'Presentation';
  const ext = kind === 'document' ? 'docx' : kind === 'spreadsheet' ? 'xlsx' : 'pptx';
  const used = new Set(openNames.map((name) => name.toLowerCase()));
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
            message: 'This file is already open with unsaved edits.',
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
            message: 'This file is already open with unsaved edits.',
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
