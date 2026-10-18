import { describe, expect, it } from 'vitest';
import {
  closeContinues,
  contentHash,
  decideSave,
  defaultPrintChoice,
  findTabByHandle,
  isDiskNewer,
  isDirtyHash,
  nextDirtyIndex,
  nextFileName,
  normalizePath,
  pathsMatch,
  planOpenBatch,
  printScopeFromChoice,
  printScopeNeeded,
  shouldRemoveRecent,
  type TabRef,
} from '../src/files/session';

const tabs: TabRef[] = [
  { id: 'a', path: 'C:\\Docs\\report.docx', dirty: false },
  { id: 'b', path: 'C:\\Docs\\notes.docx', dirty: true },
];

describe('path identity', () => {
  it('matches Windows paths regardless of slash and case', () => {
    expect(pathsMatch('C:\\Docs\\Report.docx', 'c:/docs/report.docx')).toBe(true);
    expect(pathsMatch('C:\\Docs\\Report.docx', 'C:\\Other\\Report.docx')).toBe(false);
    expect(normalizePath('\\\\server\\share\\A.docx')).toBe('\\\\server\\share\\a.docx');
  });
});

describe('dirty hash', () => {
  it('clears when the content matches the clean snapshot', () => {
    const clean = contentHash({ type: 'doc', content: [{ type: 'paragraph' }] });
    expect(isDirtyHash(clean, clean)).toBe(false);
    expect(isDirtyHash(contentHash({ type: 'doc', content: [{ type: 'paragraph', content: [] }] }), clean)).toBe(true);
  });
});

describe('names and close', () => {
  it('uses the smallest free document number', () => {
    expect(nextFileName('document', ['Document1.docx', 'document2.docx'])).toBe('Document3.docx');
    expect(nextFileName('spreadsheet', [])).toBe('Workbook1.xlsx');
    expect(nextFileName('presentation', ['Presentation1.pptx'])).toBe('Presentation2.pptx');
  });

  it('stops the close unless save finishes or the user discards', () => {
    expect(nextDirtyIndex([{ dirty: false }, { dirty: true }], 0)).toBe(1);
    expect(closeContinues('Save', 'ok')).toBe(true);
    expect(closeContinues('Save', 'failed')).toBe(false);
    expect(closeContinues('Save', 'cancelled')).toBe(false);
    expect(closeContinues("Don't save")).toBe(true);
    expect(closeContinues('Cancel')).toBe(false);
    expect(closeContinues(null)).toBe(false);
  });
});

describe('save target', () => {
  it('opens Save when there is no path or the file is gone', () => {
    expect(decideSave({ selfId: 'a', targetPath: '', status: null, openTabs: tabs }).kind).toBe('save-as');
    expect(
      decideSave({
        selfId: 'a',
        targetPath: 'C:\\Docs\\report.docx',
        status: { exists: false, parentExists: true, modifiedMs: null, len: null },
        openTabs: tabs,
      })
    ).toEqual({ kind: 'save-as', reason: 'missing' });
  });

  it('refuses a path owned by another tab and overwrites its own', () => {
    expect(
      decideSave({
        selfId: 'new',
        targetPath: 'C:\\Docs\\notes.docx',
        status: { exists: true, parentExists: true, modifiedMs: 1, len: 2 },
        openTabs: tabs,
      })
    ).toEqual({ kind: 'already-open', ownerId: 'b' });

    expect(
      decideSave({
        selfId: 'a',
        targetPath: 'C:\\Docs\\report.docx',
        status: { exists: true, parentExists: true, modifiedMs: 5, len: 9 },
        stamp: { modifiedMs: 5, len: 9 },
        openTabs: tabs,
      }).kind
    ).toBe('overwrite');
  });

  it('asks before overwriting a newer disk copy and overwrites when it cannot tell', () => {
    expect(
      decideSave({
        selfId: 'a',
        targetPath: 'C:\\Docs\\report.docx',
        status: { exists: true, parentExists: true, modifiedMs: 8, len: 9 },
        stamp: { modifiedMs: 5, len: 9 },
        openTabs: tabs,
      }).kind
    ).toBe('conflict');
    expect(decideSave({ selfId: 'a', targetPath: 'C:\\Docs\\report.docx', status: null, openTabs: tabs }).kind).toBe(
      'overwrite'
    );
    expect(isDiskNewer({ modifiedMs: 1, len: 1 }, { exists: true, parentExists: true, modifiedMs: null, len: 1 })).toBe(
      false
    );
  });
});

describe('recent removal', () => {
  it('removes a deleted file and keeps an unavailable drive', () => {
    expect(shouldRemoveRecent({ exists: false, parentExists: true })).toBe(true);
    expect(shouldRemoveRecent({ exists: false, parentExists: false })).toBe(false);
    expect(shouldRemoveRecent({ exists: true, parentExists: true })).toBe(false);
  });
});

describe('open batch', () => {
  it('asks for a draft before opening and keeps walking the list', () => {
    const plan = planOpenBatch(
      [
        { key: '1', path: 'C:\\Docs\\new.docx', hasDraft: true },
        { key: '2', path: 'C:\\Docs\\other.docx' },
      ],
      tabs,
      false
    );
    expect(plan.actions.map((step) => step.action.type)).toEqual(['ask-draft', 'open']);
    expect(plan.activation).toBe('first-open');
  });

  it('focuses a sole open file and skips already-open files inside a mixed batch', () => {
    const sole = planOpenBatch([{ key: '1', path: 'C:\\Docs\\report.docx' }], tabs, true);
    expect(sole.actions[0].action).toEqual({ type: 'focus', tabId: 'a' });

    const dirty = planOpenBatch([{ key: '1', path: 'C:\\Docs\\notes.docx' }], tabs, true);
    expect(dirty.actions[0].action.type).toBe('focus-dirty');

    const newer = planOpenBatch([{ key: '1', path: 'C:\\Docs\\report.docx', diskNewer: true }], tabs, true);
    expect(newer.actions[0].action.type).toBe('ask-reload');

    const mixed = planOpenBatch(
      [
        { key: '1', path: 'C:\\Docs\\report.docx' },
        { key: '2', path: 'C:\\Docs\\fresh.docx' },
      ],
      tabs,
      true
    );
    expect(mixed.actions.map((step) => step.action.type)).toEqual(['skip', 'open']);
    expect(mixed.activation).toBe('keep');
  });

  it('focuses the first file when every chosen file is already open', () => {
    const plan = planOpenBatch(
      [
        { key: '1', path: 'C:\\Docs\\report.docx' },
        { key: '2', path: 'c:/docs/notes.docx' },
      ],
      tabs,
      true
    );
    expect(plan.actions.map((step) => step.action.type)).toEqual(['focus', 'skip']);
    expect(plan.activation).toBe('focus-existing');
  });

  it('ignores folders, collects failures, and asks before replacing a clean tab with a draft', () => {
    const plan = planOpenBatch(
      [
        { key: 'dir', folder: true },
        { key: 'bad', error: 'Legacy Office binary format' },
        { key: 'draft', path: 'C:\\Docs\\report.docx', intent: 'draft' },
        { key: 'dirty-draft', path: 'C:\\Docs\\notes.docx', intent: 'draft' },
      ],
      tabs,
      true
    );
    expect(plan.actions.map((step) => step.action.type)).toEqual(['ignore', 'fail', 'ask-replace', 'focus-dirty']);
  });
});

describe('print scope', () => {
  it('asks only when a sheet, slide, or page choice changes the job', () => {
    expect(printScopeNeeded('document', 4)).toBe(false);
    expect(printScopeNeeded('spreadsheet', 1)).toBe(false);
    expect(printScopeNeeded('presentation', 10)).toBe(true);
    expect(defaultPrintChoice('spreadsheet')).toBe('Active sheet');
    expect(printScopeFromChoice('All slides')).toBe('all');
    expect(printScopeFromChoice('This page')).toBe('current');
    expect(printScopeFromChoice('Cancel')).toBe('cancel');
    expect(printScopeFromChoice(null)).toBe('cancel');
  });
});

describe('browser handles', () => {
  it('focuses a tab only when the handle comparison succeeds', async () => {
    const existing = { isSameEntry: async () => true };
    const other = { isSameEntry: async () => false };
    const throwing = {
      isSameEntry: async () => {
        throw new Error('denied');
      },
    };
    const open = [{ id: 't', fileHandle: existing }];
    expect(await findTabByHandle(open, existing)).toBe('t');
    expect(await findTabByHandle(open, other)).toBeNull();
    expect(await findTabByHandle(open, throwing)).toBeNull();
    expect(await findTabByHandle(open, undefined)).toBeNull();
  });
});
