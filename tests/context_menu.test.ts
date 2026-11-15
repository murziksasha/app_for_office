import { describe, it, expect } from 'vitest';
import { getContextMenuItems } from '../src/shell/ContextMenu';
import { getCommandById } from '../src/shell/commands';

describe('Context menus', () => {
  it('includes delete table for table target and excludes it for docText', () => {
    const tableItems = getContextMenuItems('docTable');
    const textItems = getContextMenuItems('docText');

    expect(tableItems).toContain('tableDelete');
    expect(tableItems).toContain('tableAddRow');
    expect(tableItems).toContain('tableAddColumn');
    expect(textItems).not.toContain('tableDelete');
    expect(textItems).not.toContain('tableAddRow');
    expect(textItems).not.toContain('tableAddColumn');
  });

  it('includes formatting and link for both docText and docTable', () => {
    const textItems = getContextMenuItems('docText');
    const tableItems = getContextMenuItems('docTable');

    for (const id of ['cut', 'copy', 'paste', 'bold', 'italic', 'underline', 'clearFormatting', 'link']) {
      expect(textItems).toContain(id);
      expect(tableItems).toContain(id);
    }
  });

  it('includes row/column operations and clear for sheet target', () => {
    const sheetItems = getContextMenuItems('sheet');
    expect(sheetItems).toEqual([
      'cut',
      'copy',
      'paste',
      'sheetInsertRow',
      'sheetInsertColumn',
      'sheetDeleteRow',
      'sheetDeleteColumn',
      'sheetClear',
    ]);
  });

  it('includes duplicate, delete, bringForward, and sendBackward for slide object', () => {
    const slideItems = getContextMenuItems('slideObject');
    expect(slideItems).toContain('delete');
    expect(slideItems).toContain('duplicate');
    expect(slideItems).toContain('bringForward');
    expect(slideItems).toContain('sendBackward');
  });

  it('ensures every context menu command id is defined in commands registry', () => {
    const targets = ['docText', 'docTable', 'sheet', 'slideObject'] as const;
    for (const target of targets) {
      const items = getContextMenuItems(target);
      for (const id of items) {
        const cmd = getCommandById(id);
        expect(cmd, `Command ${id} should exist`).toBeDefined();
        expect(cmd?.id).toBe(id);
      }
    }
  });
});

