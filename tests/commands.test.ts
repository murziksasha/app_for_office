import { describe, expect, it, vi } from 'vitest';
import { commandIsEnabled, commands, getCommandById, getCommandsForKind } from '../src/shell/commands';
import en from '../src/i18n/locales/en.json';
import uk from '../src/i18n/locales/uk.json';

function getNestedValue(obj: any, path: string): string | undefined {
  return path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);
}

describe('Shared command list', () => {
  it('asserts every id is unique', () => {
    const ids = commands.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('asserts every labelKey exists in both locale files', () => {
    for (const cmd of commands) {
      const enVal = getNestedValue(en, cmd.labelKey);
      const ukVal = getNestedValue(uk, cmd.labelKey);
      expect(enVal, `Missing English key: ${cmd.labelKey}`).toBeDefined();
      expect(typeof enVal).toBe('string');
      expect(enVal!.length).toBeGreaterThan(0);

      expect(ukVal, `Missing Ukrainian key: ${cmd.labelKey}`).toBeDefined();
      expect(typeof ukVal).toBe('string');
      expect(ukVal!.length).toBeGreaterThan(0);
    }
  });

  it('asserts a document-only command is omitted for a spreadsheet', () => {
    const docOnlyCmd = commands.find(
      (c) => c.kinds.includes('document') && !c.kinds.includes('spreadsheet') && !c.kinds.includes('any')
    );
    expect(docOnlyCmd).toBeDefined();

    const sheetCommands = getCommandsForKind('spreadsheet');
    const existsInSheet = sheetCommands.some((c) => c.id === docOnlyCmd!.id);
    expect(existsInSheet).toBe(false);
  });

  it('runs Save and Print from either callback name', () => {
    const save = getCommandById('save');
    const print = getCommandById('print');
    const onSave = vi.fn();
    const onPrint = vi.fn();
    save?.run({ onSave });
    print?.run({ onPrint });
    expect(onSave).toHaveBeenCalledOnce();
    expect(onPrint).toHaveBeenCalledOnce();
  });

  it('disables presentation redo', () => {
    const redo = getCommandById('redo');
    expect(redo).toBeDefined();
    expect(getCommandsForKind('presentation').some((cmd) => cmd.id === 'redo')).toBe(false);
    expect(commandIsEnabled(redo!, { kind: 'presentation' })).toBe(false);
    const run = vi.fn();
    redo?.run({ kind: 'presentation', redo: run });
    expect(run).not.toHaveBeenCalled();
  });
});

