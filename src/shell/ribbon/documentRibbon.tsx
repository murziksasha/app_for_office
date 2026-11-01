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
import { canonicalFamilyName, DEFAULT_DOCUMENT_FONT } from '../../fonts/names';
import { bandState } from '../../document/bandState';
const DOC_FONT_SIZES = ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '20pt', '24pt', '28pt', '36pt', '48pt', '72pt'];

export function DocumentHome({
  editor,
  onFind,
  keyTipMode,
}: {
  editor: any;
  onFind?: () => void;
  keyTipMode?: KeyTipMode;
}) {
  useEditorTick(editor);
  const painterState = useFormatPainter();
  const [bandFont, setBandFont] = useState<string | null>(null);
  useEffect(() => bandState.subscribe((focus) => {
    setBandFont(focus ? canonicalFamilyName(focus.marks.fontFamily) || DEFAULT_DOCUMENT_FONT : null);
  }), []);
  const markOn = (name: string, attrs?: Record<string, unknown>) => Boolean(editor?.isActive?.(name, attrs));
  const alignOn = (align: string) => Boolean(editor?.isActive?.({ textAlign: align }));
  const fontSize = editor?.getAttributes('textStyle')?.fontSize || '11pt';
  const fontFamily = bandFont || canonicalFamilyName(editor?.getAttributes('textStyle')?.fontFamily) || DEFAULT_DOCUMENT_FONT;
  const currentStyleAttr = editor?.getAttributes('paragraph')?.styleName || editor?.getAttributes('heading')?.styleName;
  const styleName = currentStyleAttr || (markOn('heading', { level: 1 })
    ? 'Heading 1'
    : markOn('heading', { level: 2 })
      ? 'Heading 2'
      : markOn('heading', { level: 3 })
        ? 'Heading 3'
        : 'Paragraph');

  return commandRow(
    <>
      <RibbonGroup label={t('ribbon.clipboard')}>
        <RibbonButton large title={t('ribbon.paste')} label={t('ribbon.paste')} icon={<ClipboardPaste size={22} />} disabled={!editor} onClick={() => clip(editor, 'paste')} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <RibbonButton title={t('ribbon.cut')} label={t('ribbon.cut')} icon={<Scissors size={14} />} disabled={!editor} onClick={() => clip(editor, 'cut')} />
          <RibbonButton title={t('ribbon.copy')} label={t('ribbon.copy')} icon={<Copy size={14} />} disabled={!editor} onClick={() => clip(editor, 'copy')} />
        </div>
        <RibbonButton
          title={t('ribbon.formatPainter')}
          label={t('ribbon.formatPainter')}
          icon={<Paintbrush size={14} />}
          pressed={painterState.armed}
          disabled={!editor}
          onClick={() => {
            const payload = captureDocumentFormat(editor);
            formatPainter.arm({ doc: payload });
          }}
        />
        <RibbonButton title={t('ribbon.undo')} icon={<Undo2 size={16} />} disabled={!editor?.can().undo()} onClick={() => editor.chain().focus().undo().run()} />
        <RibbonButton title={t('ribbon.redo')} icon={<Redo2 size={16} />} disabled={!editor?.can().redo()} onClick={() => editor.chain().focus().redo().run()} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.font')}>
        <FontPicker
          value={fontFamily}
          disabled={!editor}
          onChange={(family) => {
            if (bandState.getFocus()) {
              bandState.setFontFamily(family);
              setBandFont(family);
              return;
            }
            editor.chain().focus().setFontFamily(family).run();
          }}
        />
        <select
          aria-label={t('ribbon.fontSize')}
          title={t('ribbon.fontSize')}
          value={DOC_FONT_SIZES.includes(fontSize) ? fontSize : '11pt'}
          disabled={!editor}
          onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
          style={{ ...ribbonFieldStyle, width: 72 }}
        >
          {DOC_FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size.replace('pt', '')}
            </option>
          ))}
        </select>
        <RibbonButton
          title={t('ribbon.bold')}
          icon={<Bold size={16} />}
          pressed={markOn('bold')}
          disabled={!editor}
          keyTip={keyTipMode === 'commands' ? 'B' : undefined}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <RibbonButton
          title={t('ribbon.italic')}
          icon={<Italic size={16} />}
          pressed={markOn('italic')}
          disabled={!editor}
          keyTip={keyTipMode === 'commands' ? 'I' : undefined}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <RibbonButton
          title={t('ribbon.underline')}
          icon={<Underline size={16} />}
          pressed={markOn('underline')}
          disabled={!editor}
          keyTip={keyTipMode === 'commands' ? 'U' : undefined}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <RibbonButton title={t('ribbon.strike')} icon={<Strikethrough size={16} />} pressed={markOn('strike')} disabled={!editor} onClick={() => editor.chain().focus().toggleStrike().run()} />
        <RibbonButton
          title={t('ribbon.superscript')}
          icon={<Superscript size={16} />}
          pressed={markOn('superscript')}
          disabled={!editor}
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
        />
        <RibbonButton
          title={t('ribbon.subscript')}
          icon={<Subscript size={16} />}
          pressed={markOn('subscript')}
          disabled={!editor}
          onClick={() => editor.chain().focus().toggleSubscript().run()}
        />
        <RibbonButton
          title={t('ribbon.clearFormatting')}
          icon={<RemoveFormatting size={16} />}
          disabled={!editor}
          onClick={() => clearFormatting(editor)}
        />
        <input
          type="color"
          title={t('ribbon.textColor')}
          aria-label={t('ribbon.textColor')}
          disabled={!editor}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          style={{ width: 28, height: 28, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
        />
        <RibbonButton title={t('ribbon.highlight')} icon={<Highlighter size={16} />} pressed={markOn('highlight')} disabled={!editor} onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.paragraph')}>
        <RibbonButton title={t('ribbon.alignLeft')} icon={<AlignLeft size={16} />} pressed={alignOn('left')} disabled={!editor} onClick={() => editor.chain().focus().setTextAlign('left').run()} />
        <RibbonButton title={t('ribbon.alignCenter')} icon={<AlignCenter size={16} />} pressed={alignOn('center')} disabled={!editor} onClick={() => editor.chain().focus().setTextAlign('center').run()} />
        <RibbonButton title={t('ribbon.alignRight')} icon={<AlignRight size={16} />} pressed={alignOn('right')} disabled={!editor} onClick={() => editor.chain().focus().setTextAlign('right').run()} />
        <RibbonButton title={t('ribbon.alignJustify')} icon={<AlignJustify size={16} />} pressed={alignOn('justify')} disabled={!editor} onClick={() => editor.chain().focus().setTextAlign('justify').run()} />
        <RibbonButton title={t('ribbon.bullets')} icon={<List size={16} />} pressed={markOn('bulletList')} disabled={!editor} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <RibbonButton title={t('ribbon.numbered')} icon={<ListOrdered size={16} />} pressed={markOn('orderedList')} disabled={!editor} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <RibbonButton title={t('ribbon.outdent')} icon={<OutdentIcon size={16} />} disabled={!editor} onClick={() => editor.chain().focus().outdent().run()} />
        <RibbonButton title={t('ribbon.indent')} icon={<IndentIcon size={16} />} disabled={!editor} onClick={() => editor.chain().focus().indent().run()} />
        <select
          aria-label={t('ribbon.lineSpacing')}
          title={t('ribbon.lineSpacing')}
          value={editor?.getAttributes('paragraph')?.lineSpacing || '1.15'}
          disabled={!editor}
          onChange={(e) => editor?.chain().focus().setLineSpacing(e.target.value).run()}
          style={{ ...ribbonFieldStyle, width: 62 }}
        >
          <option value="1">1.0</option>
          <option value="1.15">1.15</option>
          <option value="1.5">1.5</option>
          <option value="2">2.0</option>
        </select>
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.styles')} layout="gallery">
        <StyleChip name="Paragraph" active={styleName === 'Paragraph' || styleName === 'Normal'} onClick={() => applyDocumentStyle(editor, 'Normal')} />
        <StyleChip name="Title" active={styleName === 'Title'} onClick={() => applyDocumentStyle(editor, 'Title')} style={{ fontSize: 16, fontWeight: 700 }} />
        <StyleChip name="Heading 1" active={styleName === 'Heading 1'} onClick={() => applyDocumentStyle(editor, 'Heading 1')} style={{ fontSize: 14, fontWeight: 700 }} />
        <StyleChip name="Heading 2" active={styleName === 'Heading 2'} onClick={() => applyDocumentStyle(editor, 'Heading 2')} style={{ fontSize: 13, fontWeight: 700 }} />
        <StyleChip name="Heading 3" active={styleName === 'Heading 3'} onClick={() => applyDocumentStyle(editor, 'Heading 3')} style={{ fontSize: 12, fontWeight: 650, color: 'var(--folio-teal)' }} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.editing')}>
        <RibbonButton large title={t('ribbon.find')} label={t('ribbon.find')} icon={<Search size={20} />} disabled={!editor} onClick={onFind} />
      </RibbonGroup>
    </>,
  );
}

function StyleChip({
  name,
  active,
  onClick,
  style,
}: {
  name: string;
  active: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
}) {
  const labels: Record<string, string> = {
    Paragraph: t('ribbon.paragraph'),
    Normal: t('ribbon.styleNormal'),
    Title: t('ribbon.styleTitle'),
    'Heading 1': t('ribbon.heading1'),
    'Heading 2': t('ribbon.heading2'),
    'Heading 3': t('ribbon.heading3'),
    Quote: t('ribbon.styleQuote'),
  };
  const shown = labels[name] || name;
  return (
    <button
      type="button"
      title={shown}
      onClick={onClick}
      style={{
        minWidth: 84,
        height: 52,
        padding: '4px 8px',
        borderRadius: 4,
        border: active ? '1px solid var(--folio-teal)' : '1px solid var(--folio-border)',
        background: active ? 'var(--folio-accent-tint)' : 'var(--folio-panel)',
        color: 'var(--folio-ink)',
        fontSize: 12,
        ...style,
      }}
    >
      {shown}
    </button>
  );
}

export function DocumentReferences({ editor }: { editor: any }) {
  return commandRow(
    <RibbonGroup label={t('ribbon.references')}>
      <RibbonButton
        large
        title={t('ribbon.toc')}
        label={t('ribbon.toc')}
        icon={<FileText size={22} />}
        disabled={!editor}
        onClick={() => editor.chain().focus().insertTableOfContents().run()}
      />
      <RibbonButton
        title={t('ribbon.footnote')}
        label={t('ribbon.footnote')}
        icon={<FilePlus size={16} />}
        disabled={!editor}
        onClick={() => (editor.commands as any)?.addFootnote()}
      />
    </RibbonGroup>,
  );
}

export function DocumentInsert({ editor, onInsertLink }: { editor: any; onInsertLink: () => void }) {
  useEditorTick(editor);
  const inTable = Boolean(editor?.isActive('table'));

  const insertImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !editor) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        const src = re.target?.result as string;
        editor.chain().focus().setImage({ src }).run();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const insertLink = () => {
    if (!editor) return;
    onInsertLink();
  };

  return commandRow(
    <>
      <RibbonGroup label={t('ribbon.tables')}>
        <RibbonButton
          large
          title={t('ribbon.tableHint')}
          label={t('ribbon.table')}
          icon={<TableIcon size={22} />}
          disabled={!editor}
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        />
        {inTable && (
          <>
            <RibbonButton title={t('ribbon.addRow')} label={t('ribbon.row')} icon={<Plus size={14} />} onClick={() => editor.chain().focus().addRowAfter().run()} />
            <RibbonButton title={t('ribbon.addColumn')} label={t('ribbon.column')} icon={<Plus size={14} />} onClick={() => editor.chain().focus().addColumnAfter().run()} />
            <RibbonButton title={t('ribbon.deleteTable')} label={t('ribbon.delete')} icon={<Trash2 size={14} />} onClick={() => editor.chain().focus().deleteTable().run()} />
          </>
        )}
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.illustrations')}>
        <RibbonButton large title={t('ribbon.picture')} label={t('ribbon.picture')} icon={<ImageIcon size={22} />} disabled={!editor} onClick={insertImage} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.links')}>
        <RibbonButton title={t('ribbon.link')} label={t('ribbon.link')} icon={<LinkIcon size={16} />} disabled={!editor} onClick={insertLink} />
        <RibbonButton title={t('ribbon.divider')} label={t('ribbon.divider')} icon={<Minus size={16} />} disabled={!editor} onClick={() => editor.chain().focus().setHorizontalRule().run()} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.pages')}>
        <RibbonButton title={t('ribbon.pageBreak')} label={t('ribbon.pageBreak')} icon={<SeparatorHorizontal size={16} />} disabled={!editor} onClick={() => editor.chain().focus().setPageBreak().run()} />
      </RibbonGroup>
    </>,
  );
}

export function DocumentLayout({
  editor,
  documentContent,
  zoom,
  onZoomChange,
}: {
  editor: any;
  documentContent?: JSONContent;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}) {
  const setup = pageSetupFromDoc(documentContent);
  const commit = (partial: Partial<PageSetup>) => {
    editor?.commands.setPageSetup(partial);
  };
  return commandRow(
    <>
      <RibbonGroup label={t('ribbon.page')}>
        <select
          aria-label={t('ribbon.pageSize')}
          value={setup.size}
          onChange={(e) => commit({ size: e.target.value as PageSetup['size'] })}
          style={ribbonFieldStyle}
        >
          <option value="letter">{t('ribbon.letter')}</option>
          <option value="a4">{t('ribbon.a4')}</option>
        </select>
        <select
          aria-label={t('ribbon.orientation')}
          value={setup.orientation || 'portrait'}
          onChange={(e) => commit({ orientation: e.target.value as PageSetup['orientation'] })}
          style={ribbonFieldStyle}
        >
          <option value="portrait">{t('ribbon.portrait')}</option>
          <option value="landscape">{t('ribbon.landscape')}</option>
        </select>
        <select
          aria-label={t('ribbon.columns')}
          value={String(setup.columns || 1)}
          onChange={(e) => commit({ columns: parseInt(e.target.value, 10) as PageSetup['columns'] })}
          style={ribbonFieldStyle}
        >
          <option value="1">{t('ribbon.columnOne')}</option>
          <option value="2">{t('ribbon.columnTwo')}</option>
          <option value="3">{t('ribbon.columnThree')}</option>
        </select>
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.margins')}>
        <MarginField label={t('ribbon.marginTop')} mm={setup.marginTop} onCommit={(marginTop) => commit({ marginTop })} />
        <MarginField label={t('ribbon.marginBottom')} mm={setup.marginBottom} onCommit={(marginBottom) => commit({ marginBottom })} />
        <MarginField label={t('ribbon.marginLeft')} mm={setup.marginLeft} onCommit={(marginLeft) => commit({ marginLeft })} />
        <MarginField label={t('ribbon.marginRight')} mm={setup.marginRight} onCommit={(marginRight) => commit({ marginRight })} />
      </RibbonGroup>
      <ZoomGroup zoom={zoom} onZoomChange={onZoomChange} />
    </>,
  );
}

function MarginField({ label, mm, onCommit }: { label: string; mm: number; onCommit: (mm: number) => void }) {
  const lang = i18n.language;
  const [text, setText] = useState(formatMargin(mm, lang));
  useEffect(() => {
    setText(formatMargin(mm, lang));
  }, [mm, lang]);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: 'var(--folio-ink-muted)' }}>
      {label}
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          aria-label={label}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const parsed = parseMargin(text, i18n.language);
            if (parsed == null) setText(formatMargin(mm, i18n.language));
            else onCommit(parsed);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          style={{ ...ribbonFieldStyle, width: 64 }}
        />
        <span>{marginUnit(lang) === 'cm' ? t('ribbon.unitCm') : t('ribbon.unitIn')}</span>
      </span>
    </label>
  );
}

function ZoomGroup({ zoom, onZoomChange }: { zoom: number; onZoomChange: (zoom: number) => void }) {
  return (
    <RibbonGroup label={t('ribbon.zoom')}>
      {[75, 100, 125, 150].map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onZoomChange(value)}
          style={{
            padding: '3px 8px',
            borderRadius: 4,
            backgroundColor: zoom === value ? 'var(--folio-teal)' : 'var(--folio-bg)',
            color: zoom === value ? 'white' : 'var(--folio-ink)',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {value}%
        </button>
      ))}
    </RibbonGroup>
  );
}

export function DocumentView({
  editor,
  showOutline,
  onToggleOutline,
  zoom,
  onZoomChange,
}: {
  editor?: any;
  showOutline?: boolean;
  onToggleOutline?: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}) {
  return commandRow(
    <>
      <RibbonGroup label={t('ribbon.view')}>
        <RibbonButton
          large
          title={t('document.headings')}
          label={t('document.headings')}
          icon={<ListFilter size={22} />}
          pressed={showOutline}
          onClick={onToggleOutline}
        />
        <RibbonButton
          title={t('ribbon.spellCheck')}
          label={t('ribbon.spellCheck')}
          icon={<SpellCheck size={16} />}
          disabled={!editor}
          onClick={() => editor?.commands?.toggleSpellCheck?.()}
        />
      </RibbonGroup>
      <ZoomGroup zoom={zoom} onZoomChange={onZoomChange} />
    </>,
  );
}

export function TableTab({ editor }: { editor: any }) {
  useEditorTick(editor);
  return commandRow(
    <>
      <RibbonGroup label={t('ribbon.rows')}>
        <RibbonButton title={t('ribbon.addRowAbove')} label={t('ribbon.addRowAbove')} icon={<Plus size={14} />} disabled={!editor} onClick={() => editor.chain().focus().addRowBefore().run()} />
        <RibbonButton title={t('ribbon.addRowBelow')} label={t('ribbon.addRowBelow')} icon={<Plus size={14} />} disabled={!editor} onClick={() => editor.chain().focus().addRowAfter().run()} />
        <RibbonButton title={t('ribbon.deleteRow')} label={t('ribbon.deleteRow')} icon={<Trash2 size={14} />} disabled={!editor} onClick={() => editor.chain().focus().deleteRow().run()} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.columns')}>
        <RibbonButton title={t('ribbon.addColumnLeft')} label={t('ribbon.addColumnLeft')} icon={<Plus size={14} />} disabled={!editor} onClick={() => editor.chain().focus().addColumnBefore().run()} />
        <RibbonButton title={t('ribbon.addColumnRight')} label={t('ribbon.addColumnRight')} icon={<Plus size={14} />} disabled={!editor} onClick={() => editor.chain().focus().addColumnAfter().run()} />
        <RibbonButton title={t('ribbon.deleteColumn')} label={t('ribbon.deleteColumn')} icon={<Trash2 size={14} />} disabled={!editor} onClick={() => editor.chain().focus().deleteColumn().run()} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.tables')}>
        <RibbonButton title={t('ribbon.mergeCells')} label={t('ribbon.mergeCells')} icon={<Merge size={14} />} disabled={!editor} onClick={() => editor.chain().focus().mergeCells().run()} />
        <RibbonButton title={t('ribbon.splitCell')} label={t('ribbon.splitCell')} icon={<Split size={14} />} disabled={!editor} onClick={() => editor.chain().focus().splitCell().run()} />
        <RibbonButton title={t('ribbon.deleteTable')} label={t('ribbon.deleteTable')} icon={<Trash2 size={14} />} disabled={!editor} onClick={() => editor.chain().focus().deleteTable().run()} />
      </RibbonGroup>
    </>,
  );
}

export function PictureTab({ editor }: { editor: any }) {
  useEditorTick(editor);
  return commandRow(
    <>
      <RibbonGroup label={t('ribbon.alignment')}>
        <RibbonButton title={t('ribbon.alignPictureLeft')} label={t('ribbon.alignPictureLeft')} icon={<AlignLeft size={16} />} disabled={!editor} onClick={() => editor.chain().focus().setTextAlign('left').run()} />
        <RibbonButton title={t('ribbon.alignPictureCenter')} label={t('ribbon.alignPictureCenter')} icon={<AlignCenter size={16} />} disabled={!editor} onClick={() => editor.chain().focus().setTextAlign('center').run()} />
        <RibbonButton title={t('ribbon.alignPictureRight')} label={t('ribbon.alignPictureRight')} icon={<AlignRight size={16} />} disabled={!editor} onClick={() => editor.chain().focus().setTextAlign('right').run()} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.picture')}>
        <RibbonButton title={t('ribbon.deletePicture')} label={t('ribbon.deletePicture')} icon={<Trash2 size={16} />} disabled={!editor} onClick={() => editor.chain().focus().deleteSelection().run()} />
      </RibbonGroup>
    </>,
  );
}

