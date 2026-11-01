import React, { useEffect, useRef, useState } from 'react';
import type { WorkbookInstance } from '@fortune-sheet/react';
import { DraftItem, EditorState, DocumentKind, RecentItem, SlideElement } from '../../types';
import type { SlideCommandState, SlideEditorHandle } from '../../slides/SlideEditor';
import {
  autoSumSheet,
  clearSheetSelection,
  deleteSheetAxis,
  fillSheetSelection,
  freezeSheet,
  freezeSheetAtSelection,
  insertSheetAxis,
  mergeSheetSelection,
  setSheetBorder,
  setSheetFill,
  setSheetNumberFormat,
  setSheetPrintSetup,
  setSheetStyle,
  sortSheetSelection,
  toggleSheetFilter,
  toggleSheetMark,
  toggleSheetWrap,
  unfreezeSheet,
  unmergeSheetSelection,
  addSheetDataValidation,
} from '../../spreadsheet/sheetCommands';
import { PrintSetupDialog } from '../../spreadsheet/PrintSetupDialog';
import { defaultPrintSetup } from '../../spreadsheet/sheetPrint';
import { clearFormatting } from '../../document/clearFormatting';
import { applyDocumentStyle } from '../../document/styles';
import {
  useFormatPainter,
  formatPainter,
  captureDocumentFormat,
  captureSheetFormat,
} from '../formatPainter';
import { RibbonGroup } from './RibbonGroup';
import { tabsFor, type RibbonTab } from './tabs';
import { RibbonButton, ribbonFieldStyle } from './RibbonButton';
import { LanguageButton } from '../LanguageButton';
import { i18n, t } from '../../i18n/instance';
import { Backstage } from '../Backstage';
import { LinkDialog } from '../LinkDialog';
import { CommandSearch } from '../CommandSearch';
import { QuickAccess } from '../QuickAccess';
import { handleKeyTipKey, TAB_KEY_TIPS, type KeyTipMode } from '../keyTips';
import type { JSONContent } from '@tiptap/core';
import { formatMargin, marginUnit, pageSetupFromDoc, parseMargin, type PageSetup } from '../../document/pageSetup';
import {
  Save,
  Printer,
  X,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Table as TableIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  Minus,
  FilePlus,
  FolderOpen,
  SaveAll,
  FileText,
  Search,
  Highlighter,
  Indent as IndentIcon,
  Outdent as OutdentIcon,
  SeparatorHorizontal,
  Scissors,
  Copy,
  ClipboardPaste,
  Presentation,
  Type,
  Video,
  Square,
  Circle,
  Triangle,
  Trash2,
  ChevronUp,
  ChevronDown,
  WrapText,
  Eraser,
  Plus,
  Grid,
  LayoutGrid,
  Palette,
  BringToFront,
  SendToBack,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Paintbrush,
  Superscript,
  Subscript,
  RemoveFormatting,
  Merge,
  Split,
  Grid2x2,
  Pin,
  PinOff,
  ArrowDownAZ,
  ArrowDownZA,
  ListFilter,
  Sigma,
  SpellCheck,
} from 'lucide-react';

import { commandRow, useEditorTick, clip } from './shared';
import { FontPicker } from '../../fonts/FontPicker';
import { canonicalFamilyName, DEFAULT_SPREADSHEET_FONT } from '../../fonts/names';
const SHEET_FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];

function sheetFrom(apiRef?: React.RefObject<WorkbookInstance | null>) {
  return () => apiRef?.current || null;
}

export function SheetHome({
  api,
  onFind,
}: {
  api?: React.RefObject<WorkbookInstance | null>;
  onFind?: () => void;
}) {
  const book = sheetFrom(api);
  const painterState = useFormatPainter();
  const [sheetFont, setSheetFont] = React.useState(DEFAULT_SPREADSHEET_FONT);
  React.useEffect(() => {
    const id = window.setInterval(() => {
      const sheet = book();
      const sel = sheet?.getSelection()?.[0];
      if (!sheet || !sel?.row?.length || !sel.column?.length) return;
      const ff = sheet.getCellValue(Math.min(...sel.row), Math.min(...sel.column), { type: 'ff' });
      const name = typeof ff === 'string' && ff ? canonicalFamilyName(ff) : DEFAULT_SPREADSHEET_FONT;
      setSheetFont((prev) => (prev === name ? prev : name));
    }, 400);
    return () => window.clearInterval(id);
  }, [api]);
  return commandRow(
    <>
      <RibbonGroup label={t('ribbon.clipboard')}>
        <RibbonButton
          title={t('ribbon.formatPainter')}
          label={t('ribbon.formatPainter')}
          icon={<Paintbrush size={14} />}
          pressed={painterState.armed}
          onClick={() => {
            const sheet = book();
            const payload = captureSheetFormat(sheet);
            formatPainter.arm({ sheet: payload });
          }}
        />
        <RibbonButton title={t('ribbon.undoShort')} icon={<Undo2 size={16} />} onClick={() => book()?.handleUndo()} />
        <RibbonButton title={t('ribbon.redoShort')} icon={<Redo2 size={16} />} onClick={() => book()?.handleRedo()} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.font')}>
        <FontPicker
          value={sheetFont}
          onChange={(family) => {
            const sheet = book();
            if (!sheet) return;
            const sel = sheet.getSelection()?.[0];
            if (!sel?.row?.length || !sel.column?.length) return;
            sheet.setCellFormatByRange('ff', family, { row: sel.row, column: sel.column });
            setSheetFont(family);
          }}
        />
        <select
          aria-label={t('ribbon.fontSize')}
          title={t('ribbon.fontSize')}
          defaultValue={11}
          onChange={(e) => {
            const sheet = book();
            if (sheet) setSheetStyle(sheet, 'fs', Number(e.target.value));
          }}
          style={{ ...ribbonFieldStyle, width: 64 }}
        >
          {SHEET_FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <RibbonButton title={t('ribbon.bold')} icon={<Bold size={16} />} onClick={() => { const sheet = book(); if (sheet) toggleSheetMark(sheet, 'bl'); }} />
        <RibbonButton title={t('ribbon.italic')} icon={<Italic size={16} />} onClick={() => { const sheet = book(); if (sheet) toggleSheetMark(sheet, 'it'); }} />
        <RibbonButton title={t('ribbon.underline')} icon={<Underline size={16} />} onClick={() => { const sheet = book(); if (sheet) toggleSheetMark(sheet, 'un'); }} />
        <input
          type="color"
          title={t('ribbon.textColor')}
          aria-label={t('ribbon.textColor')}
          onChange={(e) => {
            const sheet = book();
            if (sheet) setSheetStyle(sheet, 'fc', e.target.value);
          }}
          style={{ width: 28, height: 28, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
        />
        <input
          type="color"
          title={t('ribbon.fillColor')}
          aria-label={t('ribbon.fillColor')}
          defaultValue="#fff3bf"
          onChange={(e) => {
            const sheet = book();
            if (sheet) setSheetFill(sheet, e.target.value);
          }}
          style={{ width: 28, height: 28, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
        />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.alignment')}>
        <RibbonButton title={t('ribbon.alignLeft')} icon={<AlignLeft size={16} />} onClick={() => { const sheet = book(); if (sheet) setSheetStyle(sheet, 'ht', 1); }} />
        <RibbonButton title={t('ribbon.alignCenter')} icon={<AlignCenter size={16} />} onClick={() => { const sheet = book(); if (sheet) setSheetStyle(sheet, 'ht', 0); }} />
        <RibbonButton title={t('ribbon.alignRight')} icon={<AlignRight size={16} />} onClick={() => { const sheet = book(); if (sheet) setSheetStyle(sheet, 'ht', 2); }} />
        <RibbonButton title={t('ribbon.wrap')} icon={<WrapText size={16} />} onClick={() => { const sheet = book(); if (sheet) toggleSheetWrap(sheet); }} />
        <RibbonButton title={t('ribbon.merge')} label={t('ribbon.merge')} icon={<Merge size={14} />} onClick={() => { const sheet = book(); if (sheet) mergeSheetSelection(sheet); }} />
        <RibbonButton title={t('ribbon.unmerge')} label={t('ribbon.unmerge')} icon={<Split size={14} />} onClick={() => { const sheet = book(); if (sheet) unmergeSheetSelection(sheet); }} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.number')}>
        <RibbonButton title={t('ribbon.general')} label={t('ribbon.general')} onClick={() => { const sheet = book(); if (sheet) setSheetNumberFormat(sheet, 'General', 'g'); }} />
        <RibbonButton title={t('ribbon.number')} label="0.00" onClick={() => { const sheet = book(); if (sheet) setSheetNumberFormat(sheet, '0.00', 'n'); }} />
        <RibbonButton title={t('ribbon.percent')} label="%" onClick={() => { const sheet = book(); if (sheet) setSheetNumberFormat(sheet, '0%', 'n'); }} />
        <RibbonButton title={t('ribbon.thousands')} label={t('ribbon.thousands')} onClick={() => { const sheet = book(); if (sheet) setSheetNumberFormat(sheet, '#,##0', 'n'); }} />
        <RibbonButton title={t('ribbon.currency')} label={t('ribbon.currency')} onClick={() => { const sheet = book(); if (sheet) setSheetNumberFormat(sheet, '#,##0.00', 'n'); }} />
        <RibbonButton title={t('ribbon.date')} label={t('ribbon.date')} onClick={() => { const sheet = book(); if (sheet) setSheetNumberFormat(sheet, 'yyyy-MM-dd', 'd'); }} />
        <RibbonButton title={t('ribbon.time')} label={t('ribbon.time')} onClick={() => { const sheet = book(); if (sheet) setSheetNumberFormat(sheet, 'hh:mm', 'd'); }} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.cells')}>
        <RibbonButton title={t('ribbon.insertRow')} label={t('ribbon.insertRow')} icon={<Plus size={14} />} onClick={() => { const sheet = book(); if (sheet) insertSheetAxis(sheet, 'row'); }} />
        <RibbonButton title={t('ribbon.insertColumn')} label={t('ribbon.insertColumn')} icon={<Plus size={14} />} onClick={() => { const sheet = book(); if (sheet) insertSheetAxis(sheet, 'column'); }} />
        <RibbonButton title={t('ribbon.deleteRow')} label={t('ribbon.deleteRow')} icon={<Trash2 size={14} />} onClick={() => { const sheet = book(); if (sheet) deleteSheetAxis(sheet, 'row'); }} />
        <RibbonButton title={t('ribbon.deleteColumn')} label={t('ribbon.deleteColumn')} icon={<Trash2 size={14} />} onClick={() => { const sheet = book(); if (sheet) deleteSheetAxis(sheet, 'column'); }} />
        <RibbonButton title={t('ribbon.clear')} label={t('ribbon.clear')} icon={<Eraser size={14} />} onClick={() => { const sheet = book(); if (sheet) clearSheetSelection(sheet); }} />
        <RibbonButton title={t('ribbon.borderAll')} label={t('ribbon.borderAll')} icon={<Grid2x2 size={14} />} onClick={() => { const sheet = book(); if (sheet) setSheetBorder(sheet, 'border-all'); }} />
        <RibbonButton title={t('ribbon.borderNone')} label={t('ribbon.borderNone')} icon={<Square size={14} />} onClick={() => { const sheet = book(); if (sheet) setSheetBorder(sheet, 'border-none'); }} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.editing')}>
        <RibbonButton large title={t('ribbon.find')} label={t('ribbon.find')} icon={<Search size={20} />} onClick={onFind} />
      </RibbonGroup>
    </>,
  );
}

export function SheetData({ api }: { api?: React.RefObject<WorkbookInstance | null> }) {
  const book = sheetFrom(api);
  return commandRow(
    <RibbonGroup label={t('ribbon.data')}>
      <RibbonButton title={t('ribbon.sortAsc')} label={t('ribbon.sortAsc')} icon={<ArrowDownAZ size={14} />} onClick={() => { const sheet = book(); if (sheet) sortSheetSelection(sheet, true); }} />
      <RibbonButton title={t('ribbon.sortDesc')} label={t('ribbon.sortDesc')} icon={<ArrowDownZA size={14} />} onClick={() => { const sheet = book(); if (sheet) sortSheetSelection(sheet, false); }} />
      <RibbonButton title={t('ribbon.filter')} label={t('ribbon.filter')} icon={<ListFilter size={14} />} onClick={() => { const sheet = book(); if (sheet) toggleSheetFilter(sheet); }} />
      <RibbonButton large title={t('ribbon.autoSum')} label={t('ribbon.autoSum')} icon={<Sigma size={22} />} onClick={() => { const sheet = book(); if (sheet) autoSumSheet(sheet); }} />
      <RibbonButton title={t('ribbon.fill')} label={t('ribbon.fill')} icon={<Plus size={14} />} onClick={() => { const sheet = book(); if (sheet) fillSheetSelection(sheet); }} />
      <RibbonButton title={t('ribbon.dataValidation')} label={t('ribbon.dataValidation')} icon={<List size={14} />} onClick={() => { const sheet = book(); if (sheet) addSheetDataValidation(sheet); }} />
    </RibbonGroup>,
  );
}

export function SheetView({ api }: { api?: React.RefObject<WorkbookInstance | null> }) {
  const book = sheetFrom(api);
  return commandRow(
    <RibbonGroup label={t('ribbon.view')}>
      <RibbonButton title={t('ribbon.freezeRow')} label={t('ribbon.freezeRow')} icon={<Pin size={14} />} onClick={() => { const sheet = book(); if (sheet) freezeSheet(sheet, 'row'); }} />
      <RibbonButton title={t('ribbon.freezeColumn')} label={t('ribbon.freezeColumn')} icon={<Pin size={14} />} onClick={() => { const sheet = book(); if (sheet) freezeSheet(sheet, 'column'); }} />
      <RibbonButton title={t('ribbon.freezeSelection')} label={t('ribbon.freezeSelection')} icon={<Pin size={14} />} onClick={() => { const sheet = book(); if (sheet) freezeSheetAtSelection(sheet); }} />
      <RibbonButton title={t('ribbon.unfreeze')} label={t('ribbon.unfreeze')} icon={<PinOff size={14} />} onClick={() => { const sheet = book(); if (sheet) unfreezeSheet(sheet); }} />
    </RibbonGroup>,
  );
}

export function SheetInsert({ api }: { api?: React.RefObject<WorkbookInstance | null> }) {
  return commandRow(
    <RibbonGroup label={t('ribbon.sheets')}>
      <RibbonButton large title={t('ribbon.newSheet')} label={t('ribbon.newSheet')} icon={<Plus size={22} />} onClick={() => api?.current?.addSheet()} />
    </RibbonGroup>,
  );
}

export function SheetLayout({ api }: { api?: React.RefObject<WorkbookInstance | null> }) {
  const [printSetupOpen, setPrintSetupOpen] = useState(false);
  const book = sheetFrom(api);
  const currentSetup = (book()?.getSheet?.() as any)?.printSetup || defaultPrintSetup;

  return commandRow(
    <>
      <RibbonGroup label={t('ribbon.page')}>
        <RibbonButton
          large
          data-testid="folio-sheet-print-setup"
          title={t('ribbon.printSetup')}
          label={t('ribbon.printSetup')}
          icon={<Printer size={22} />}
          onClick={() => setPrintSetupOpen(true)}
        />
      </RibbonGroup>
      {printSetupOpen && (
        <PrintSetupDialog
          open={printSetupOpen}
          currentSetup={currentSetup}
          onConfirm={(setup) => {
            const sheet = book();
            if (sheet) setSheetPrintSetup(sheet, setup);
            setPrintSetupOpen(false);
          }}
          onCancel={() => setPrintSetupOpen(false)}
        />
      )}
    </>,
  );
}

