import { describe, expect, it } from 'vitest';
import { commands, getCommandsForKind } from '../src/shell/commands';
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
});

