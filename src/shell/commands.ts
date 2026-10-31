import { DocumentKind } from '../types';
import { t } from '../i18n/instance';
import { clearFormatting } from '../document/clearFormatting';
import {
  clearSheetSelection,
  deleteSheetAxis,
  fillSheetSelection,
  insertSheetAxis,
} from '../spreadsheet/sheetCommands';

export type CommandKind = DocumentKind | 'any';

export interface CommandContext {
  editor?: any;
  workbook?: any;
  slideHandle?: any;
  app?: any;
  state?: any;
  [key: string]: any;
}

export interface FolioCommand {
  id: string;
  labelKey: string;
  kinds: CommandKind[];
  run: (context?: CommandContext) => void | Promise<void>;
  shortcut?: string;
  keyTip?: string;
}

export const commands: FolioCommand[] = [
  {
    id: 'save',
    labelKey: 'ribbon.save',
    kinds: ['any'],
    run: (ctx) => {
      ctx?.save?.();
    },
    shortcut: 'Ctrl+S',
  },
  {
    id: 'saveAs',
    labelKey: 'ribbon.saveAs',
    kinds: ['any'],
    run: (ctx) => {
      ctx?.onSaveAs?.() || ctx?.saveAs?.();
    },
    shortcut: 'F12',
  },
  {
    id: 'undo',
    labelKey: 'ribbon.undoShort',
    kinds: ['document', 'spreadsheet', 'presentation'],
    run: (ctx) => {
      ctx?.undo?.();
    },
    shortcut: 'Ctrl+Z',
  },
  {
    id: 'redo',
    labelKey: 'ribbon.redoShort',
    kinds: ['document', 'spreadsheet', 'presentation'],
    run: (ctx) => {
      ctx?.redo?.();
    },
    shortcut: 'Ctrl+Y',
  },
  {
    id: 'print',
    labelKey: 'ribbon.print',
    kinds: ['any'],
    run: (ctx) => {
      ctx?.print?.();
    },
    shortcut: 'Ctrl+P',
  },
  {
    id: 'cut',
    labelKey: 'ribbon.cut',
    kinds: ['document', 'spreadsheet'],
    run: (ctx) => {
      ctx?.cut?.();
    },
  },
  {
    id: 'copy',
    labelKey: 'ribbon.copy',
    kinds: ['document', 'spreadsheet'],
    run: (ctx) => {
      ctx?.copy?.();
    },
  },
  {
    id: 'paste',
    labelKey: 'ribbon.paste',
    kinds: ['document', 'spreadsheet'],
    run: (ctx) => {
      ctx?.paste?.();
    },
  },
  {
    id: 'bold',
    labelKey: 'ribbon.boldShort',
    kinds: ['document'],
    run: (ctx) => {
      if (ctx?.toggleBold) ctx.toggleBold();
      else ctx?.editor?.chain().focus().toggleBold().run();
    },
  },
  {
    id: 'italic',
    labelKey: 'ribbon.italicShort',
    kinds: ['document'],
    run: (ctx) => {
      if (ctx?.toggleItalic) ctx.toggleItalic();
      else ctx?.editor?.chain().focus().toggleItalic().run();
    },
  },
  {
    id: 'underline',
    labelKey: 'ribbon.underlineShort',
    kinds: ['document'],
    run: (ctx) => {
      if (ctx?.toggleUnderline) ctx.toggleUnderline();
      else ctx?.editor?.chain().focus().toggleUnderline().run();
    },
  },
  {
    id: 'documentHeadings',
    labelKey: 'ribbon.headings',
    kinds: ['document'],
    run: (ctx) => {
      ctx?.toggleOutline?.();
    },
  },
  {
    id: 'clearFormatting',
    labelKey: 'ribbon.clearFormatting',
    kinds: ['document'],
    run: (ctx) => {
      if (ctx?.clearFormatting) ctx.clearFormatting();
      else if (ctx?.editor) clearFormatting(ctx.editor);
    },
  },
  {
    id: 'link',
    labelKey: 'ribbon.link',
    kinds: ['document'],
    run: (ctx) => {
      if (ctx?.insertLink) ctx.insertLink();
      else if (ctx?.editor) {
        const url = window.prompt('Enter link URL:');
        if (url) ctx.editor.chain().focus().setLink({ href: url }).run();
      }
    },
  },
  {
    id: 'tableAddRow',
    labelKey: 'ribbon.addRow',
    kinds: ['document'],
    run: (ctx) => {
      if (ctx?.addRow) ctx.addRow();
      else ctx?.editor?.chain().focus().addRowAfter().run();
    },
  },
  {
    id: 'tableAddColumn',
    labelKey: 'ribbon.addColumn',
    kinds: ['document'],
    run: (ctx) => {
      if (ctx?.addColumn) ctx.addColumn();
      else ctx?.editor?.chain().focus().addColumnAfter().run();
    },
  },
  {
    id: 'tableDelete',
    labelKey: 'ribbon.deleteTable',
    kinds: ['document'],
    run: (ctx) => {
      if (ctx?.deleteTable) ctx.deleteTable();
      else ctx?.editor?.chain().focus().deleteTable().run();
    },
  },
  {
    id: 'sheetInsertRow',
    labelKey: 'ribbon.insertRow',
    kinds: ['spreadsheet'],
    run: (ctx) => {
      if (ctx?.insertRow) ctx.insertRow();
      else if (ctx?.api) insertSheetAxis(ctx.api, 'row');
    },
  },
  {
    id: 'sheetInsertColumn',
    labelKey: 'ribbon.insertColumn',
    kinds: ['spreadsheet'],
    run: (ctx) => {
      if (ctx?.insertColumn) ctx.insertColumn();
      else if (ctx?.api) insertSheetAxis(ctx.api, 'column');
    },
  },
  {
    id: 'sheetDeleteRow',
    labelKey: 'ribbon.deleteRow',
    kinds: ['spreadsheet'],
    run: (ctx) => {
      if (ctx?.deleteRow) ctx.deleteRow();
      else if (ctx?.api) deleteSheetAxis(ctx.api, 'row');
    },
  },
  {
    id: 'sheetDeleteColumn',
    labelKey: 'ribbon.deleteColumn',
    kinds: ['spreadsheet'],
    run: (ctx) => {
      if (ctx?.deleteColumn) ctx.deleteColumn();
      else if (ctx?.api) deleteSheetAxis(ctx.api, 'column');
    },
  },
  {
    id: 'sheetClear',
    labelKey: 'ribbon.clear',
    kinds: ['spreadsheet'],
    run: (ctx) => {
      if (ctx?.clear) ctx.clear();
      else if (ctx?.api) clearSheetSelection(ctx.api);
    },
  },
  {
    id: 'duplicate',
    labelKey: 'ribbon.duplicate',
    kinds: ['presentation'],
    run: (ctx) => {
      if (ctx?.duplicate) ctx.duplicate();
      else ctx?.slideCommands?.current?.duplicateSlide();
    },
  },
  {
    id: 'delete',
    labelKey: 'ribbon.delete',
    kinds: ['presentation'],
    run: (ctx) => {
      if (ctx?.delete) ctx.delete();
      else ctx?.slideCommands?.current?.deleteSelected();
    },
  },
  {
    id: 'bringForward',
    labelKey: 'ribbon.bringForward',
    kinds: ['presentation'],
    run: (ctx) => {
      ctx?.bringForward?.();
    },
  },
  {
    id: 'sendBackward',
    labelKey: 'ribbon.sendBackward',
    kinds: ['presentation'],
    run: (ctx) => {
      ctx?.sendBackward?.();
    },
  },
  {
    id: 'bringToFront',
    labelKey: 'ribbon.bringToFront',
    kinds: ['presentation'],
    run: (ctx) => {
      ctx?.bringToFront?.();
    },
  },
  {
    id: 'sendToBack',
    labelKey: 'ribbon.sendToBack',
    kinds: ['presentation'],
    run: (ctx) => {
      ctx?.sendToBack?.();
    },
  },
  {
    id: 'snapToGrid',
    labelKey: 'ribbon.snapToGrid',
    kinds: ['presentation'],
    run: (ctx) => {
      ctx?.toggleSnapToGrid?.();
    },
  },
  {
    id: 'slideSorter',
    labelKey: 'ribbon.slideSorter',
    kinds: ['presentation'],
    run: (ctx) => {
      ctx?.toggleViewMode?.();
    },
  },
  {
    id: 'palettePaper',
    labelKey: 'ribbon.palettePaper',
    kinds: ['presentation'],
    run: (ctx) => {
      ctx?.applyPalette?.('paper');
    },
  },
  {
    id: 'paletteInk',
    labelKey: 'ribbon.paletteInk',
    kinds: ['presentation'],
    run: (ctx) => {
      ctx?.applyPalette?.('ink');
    },
  },
  {
    id: 'paletteTeal',
    labelKey: 'ribbon.paletteTeal',
    kinds: ['presentation'],
    run: (ctx) => {
      ctx?.applyPalette?.('teal');
    },
  },
  {
    id: 'footnote',
    labelKey: 'ribbon.footnote',
    kinds: ['document'],
    run: (ctx) => {
      ctx?.editor?.chain().focus().addFootnote().run();
    },
  },
  {
    id: 'sheetFillSeries',
    labelKey: 'ribbon.fillSeries',
    kinds: ['spreadsheet'],
    run: (ctx) => {
      if (ctx?.api) fillSheetSelection(ctx.api, 'series');
    },
  },
  {
    id: 'sheetFillCopy',
    labelKey: 'ribbon.fillCopy',
    kinds: ['spreadsheet'],
    run: (ctx) => {
      if (ctx?.api) fillSheetSelection(ctx.api, 'copy');
    },
  },
  {
    id: 'sheetPrintSetup',
    labelKey: 'ribbon.printSetup',
    kinds: ['spreadsheet'],
    run: (ctx) => {
      ctx?.openPrintSetup?.();
    },
  },
  {
    id: 'slideshow',
    labelKey: 'ribbon.slideshow',
    kinds: ['presentation'],
    shortcut: 'F5',
    run: (ctx) => {
      ctx?.startSlideshow?.();
    },
  },
  {
    id: 'shortcuts',
    labelKey: 'shortcuts.title',
    kinds: ['any'],
    shortcut: '?',
    run: (ctx) => {
      ctx?.openShortcuts?.();
    },
  },
];

export function getCommandsForKind(kind: DocumentKind): FolioCommand[] {
  return commands.filter((cmd) => cmd.kinds.includes('any') || cmd.kinds.includes(kind));
}

export function getCommandById(id: string): FolioCommand | undefined {
  return commands.find((cmd) => cmd.id === id);
}

export function searchCommands(query: string, kind: DocumentKind): FolioCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return getCommandsForKind(kind).filter((cmd) => {
    let label = '';
    try {
      label = t(cmd.labelKey).toLowerCase();
    } catch {
      label = '';
    }
    const id = cmd.id.toLowerCase();
    return label.includes(q) || id.includes(q);
  });
}
