import React, { useEffect, useState } from 'react';
import type { WorkbookInstance } from '@fortune-sheet/react';
import { DraftItem, EditorState, DocumentKind, RecentItem, SlideElement } from '../types';
import type { SlideCommandState, SlideEditorHandle } from '../slides/SlideEditor';
import {
  clearSheetSelection,
  deleteSheetAxis,
  insertSheetAxis,
  setSheetNumberFormat,
  setSheetStyle,
  toggleSheetMark,
  toggleSheetWrap,
} from '../spreadsheet/sheetCommands';
import { RibbonGroup } from './ribbon/RibbonGroup';
import { RibbonButton, ribbonFieldStyle } from './ribbon/RibbonButton';
import { LanguageButton } from './LanguageButton';
import { i18n, t } from '../i18n/instance';
import type { JSONContent } from '@tiptap/core';
import { formatMargin, marginUnit, pageSetupFromDoc, parseMargin, type PageSetup } from '../document/pageSetup';
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
  Trash2,
  ChevronUp,
  ChevronDown,
  WrapText,
  Eraser,
  Plus,
} from 'lucide-react';

type RibbonTab = 'file' | 'home' | 'insert' | 'layout';

const DOC_FONT_SIZES = ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '20pt', '24pt', '28pt', '36pt', '48pt', '72pt'];
const SHEET_FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];
const SLIDE_FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 44, 54, 72];

interface RibbonProps {
  editorState: EditorState;
  documentEditor: any;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onPrint: () => void;
  onCloseFile: () => void;
  onNew: (kind: DocumentKind) => void;
  onOpen: () => void;
  onSavePdf?: () => void;
  onEditAsDocument?: () => void;
  onOpenReport?: () => void;
  onFind?: () => void;
  recentFiles?: RecentItem[];
  drafts?: DraftItem[];
  onOpenRecent?: (item: RecentItem) => void;
  onRestoreDraft?: (draft: DraftItem) => void;
  onDismissDraft?: (draft: DraftItem) => void;
  slideCommands?: React.RefObject<SlideEditorHandle | null>;
  slideState?: SlideCommandState;
  sheetApi?: React.RefObject<WorkbookInstance | null>;
}

function tabsFor(kind: EditorState['kind']): RibbonTab[] {
  if (kind === 'pdf') return ['file'];
  if (kind === 'document') return ['file', 'home', 'insert', 'layout'];
  return ['file', 'home', 'insert'];
}

const RIBBON_COLLAPSED_KEY = 'folio_ribbon_collapsed';

export const Ribbon: React.FC<RibbonProps> = (props) => {
  const { editorState } = props;
  const [activeTab, setActiveTab] = useState<RibbonTab>(editorState.kind === 'pdf' ? 'file' : 'home');
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(RIBBON_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    setActiveTab(editorState.kind === 'pdf' ? 'file' : 'home');
  }, [editorState.kind, editorState.id]);

  useEffect(() => {
    try {
      localStorage.setItem(RIBBON_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      // The ribbon still collapses for this visit when storage is blocked.
    }
  }, [collapsed]);

  const tabs = tabsFor(editorState.kind);

  const selectTab = (tab: RibbonTab) => {
    if (collapsed) {
      setActiveTab(tab);
      setCollapsed(false);
      return;
    }
    if (tab === activeTab) {
      setCollapsed(true);
      return;
    }
    setActiveTab(tab);
  };

  return (
    <div
      className="folio-ribbon no-print"
      style={{
        backgroundColor: 'var(--folio-ribbon-bg)',
        borderBottom: '1px solid var(--folio-ribbon-border)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      <TitleBar {...props} />
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: '0 12px',
          borderBottom: '1px solid var(--folio-border)',
        }}
      >
        {tabs.map((tab) => (
          <TabButton key={tab} tab={tab} active={activeTab === tab} onClick={() => selectTab(tab)} />
        ))}
        <button
          type="button"
          aria-label={collapsed ? t('ribbon.expand') : t('ribbon.collapse')}
          onClick={() => setCollapsed((value) => !value)}
          style={{
            marginLeft: 'auto',
            marginBottom: 2,
            padding: '4px 8px',
            color: 'var(--folio-ink-muted)',
            borderRadius: 4,
          }}
        >
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
      {!collapsed && (
      <div
        style={{
          minHeight: activeTab === 'file' ? undefined : 104,
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'auto',
        }}
      >
        {activeTab === 'file' && <FilePane {...props} />}
        {activeTab === 'home' && editorState.kind === 'document' && (
          <DocumentHome editor={props.documentEditor} onFind={props.onFind} />
        )}
        {activeTab === 'insert' && editorState.kind === 'document' && <DocumentInsert editor={props.documentEditor} />}
        {activeTab === 'layout' && editorState.kind === 'document' && (
          <DocumentLayout
            editor={props.documentEditor}
            documentContent={props.editorState.documentContent}
            zoom={props.zoom}
            onZoomChange={props.onZoomChange}
          />
        )}
        {activeTab === 'home' && editorState.kind === 'spreadsheet' && <SheetHome api={props.sheetApi} />}
        {activeTab === 'insert' && editorState.kind === 'spreadsheet' && <SheetInsert api={props.sheetApi} />}
        {activeTab === 'home' && editorState.kind === 'presentation' && (
          <SlideHome commands={props.slideCommands} state={props.slideState} />
        )}
        {activeTab === 'insert' && editorState.kind === 'presentation' && <SlideInsert commands={props.slideCommands} />}
      </div>
      )}
    </div>
  );
};

function TabButton({ tab, active, onClick }: { tab: RibbonTab; active: boolean; onClick: () => void }) {
  const label = tab === 'file' ? t('ribbon.file') : tab === 'home' ? t('ribbon.home') : tab === 'insert' ? t('ribbon.insert') : t('ribbon.layout');
  const file = tab === 'file';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px',
        fontSize: 12,
        fontWeight: active || file ? 600 : 500,
        backgroundColor: file && active ? 'var(--folio-teal)' : active ? '#ffffff' : 'transparent',
        color: file ? (active ? 'white' : 'var(--folio-teal)') : active ? 'var(--folio-ink)' : 'var(--folio-ink-muted)',
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        borderBottom: !file && active ? '2px solid var(--folio-teal)' : '2px solid transparent',
      }}
    >
      {label}
    </button>
  );
}

function TitleBar(props: RibbonProps) {
  const { editorState, onSave, onSaveAs, onPrint, onCloseFile, onOpenReport } = props;
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 16px',
        borderBottom: '1px solid var(--folio-border-light)',
        fontSize: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--folio-teal)' }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              backgroundColor: 'var(--folio-teal)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FileText size={13} />
          </div>
          <span>Folio</span>
        </div>
        <span style={{ color: 'var(--folio-border)' }}>|</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, color: 'var(--folio-ink)' }}>{editorState.fileName}</span>
          {editorState.isDirty && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 10,
                backgroundColor: 'var(--folio-amber-light)',
                color: 'var(--folio-amber)',
              }}
            >
              {t('ribbon.unsaved')}
            </span>
          )}
          {editorState.importReport && (
            <button
              type="button"
              onClick={onOpenReport}
              style={{ fontSize: 11, color: 'var(--folio-teal)', textDecoration: 'underline', padding: '0 4px' }}
            >
              {t('ribbon.importNotices')}
            </button>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <LanguageButton />
        <button
          type="button"
          onClick={onSave}
          title={t('ribbon.saveHint')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 4,
            backgroundColor: editorState.isDirty ? 'var(--folio-teal)' : 'var(--folio-bg)',
            color: editorState.isDirty ? 'white' : 'var(--folio-ink)',
            fontWeight: 500,
          }}
        >
          <Save size={14} /> {t('ribbon.save')}
        </button>
        <button
          type="button"
          onClick={onSaveAs}
          title={t('ribbon.saveAsHint')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 4,
            backgroundColor: 'var(--folio-bg)',
            color: 'var(--folio-ink)',
            fontWeight: 500,
          }}
        >
          <SaveAll size={14} /> {t('ribbon.saveAs')}
        </button>
        <button type="button" onClick={onPrint} title={t('ribbon.printDocument')} style={{ padding: '4px 8px', borderRadius: 4, color: 'var(--folio-ink-muted)' }}>
          <Printer size={14} />
        </button>
        <button type="button" onClick={onCloseFile} title={t('ribbon.closeFile')} style={{ padding: '4px 8px', borderRadius: 4, color: 'var(--folio-ink-muted)' }}>
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

function commandRow(children: React.ReactNode) {
  return <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 104 }}>{children}</div>;
}

function FilePane(props: RibbonProps) {
  const { editorState, onNew, onOpen, onSave, onSaveAs, onPrint, onSavePdf, onEditAsDocument } = props;
  const recentFiles = props.recentFiles || [];
  const drafts = props.drafts || [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 6 }}>
      {commandRow(
        <>
          <RibbonGroup label={t('ribbon.new')}>
            <RibbonButton title={t('ribbon.newDocument')} label={t('ribbon.document')} icon={<FilePlus size={16} />} onClick={() => onNew('document')} />
            <RibbonButton title={t('ribbon.newSpreadsheet')} label={t('ribbon.spreadsheet')} icon={<TableIcon size={16} />} onClick={() => onNew('spreadsheet')} />
            <RibbonButton title={t('ribbon.newPresentation')} label={t('ribbon.presentation')} icon={<Presentation size={16} />} onClick={() => onNew('presentation')} />
          </RibbonGroup>
          <RibbonGroup label={t('ribbon.open')}>
            <RibbonButton title={t('ribbon.openFile')} label={t('ribbon.open')} icon={<FolderOpen size={16} />} onClick={onOpen} />
          </RibbonGroup>
          <RibbonGroup label={t('ribbon.save')}>
            <RibbonButton title={t('ribbon.save')} label={t('ribbon.save')} icon={<Save size={16} />} onClick={onSave} />
            <RibbonButton title={t('ribbon.saveAsEllipsis')} label={t('ribbon.saveAs')} icon={<SaveAll size={16} />} onClick={onSaveAs} />
            {editorState.kind !== 'pdf' ? (
              <RibbonButton title={t('ribbon.savePdf')} label={t('ribbon.savePdf')} icon={<FileText size={16} />} onClick={onSavePdf} />
            ) : (
              <RibbonButton title={t('ribbon.editAsDocument')} label={t('ribbon.editAsDocument')} icon={<FileText size={16} />} onClick={onEditAsDocument} />
            )}
          </RibbonGroup>
          <RibbonGroup label={t('ribbon.print')}>
            <RibbonButton title={t('ribbon.print')} label={t('ribbon.print')} icon={<Printer size={16} />} onClick={onPrint} />
          </RibbonGroup>
        </>,
      )}
      {(recentFiles.length > 0 || drafts.length > 0) && (
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', fontSize: 12, padding: '0 14px 6px' }}>
          {drafts.length > 0 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontWeight: 650, color: 'var(--folio-ink-muted)' }}>{t('ribbon.recoveredDrafts')}</span>
              {drafts.map((draft) => (
                <span key={draft.id} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  <button type="button" onClick={() => props.onRestoreDraft?.(draft)} style={{ textDecoration: 'underline', color: 'var(--folio-teal)' }}>
                    {draft.name}
                  </button>
                  <button type="button" aria-label={t('ribbon.dismiss', { name: draft.name })} onClick={() => props.onDismissDraft?.(draft)} style={{ color: 'var(--folio-ink-muted)' }}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {recentFiles.length > 0 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontWeight: 650, color: 'var(--folio-ink-muted)' }}>{t('ribbon.recent')}</span>
              {recentFiles.slice(0, 8).map((item) => (
                <button key={item.id} type="button" onClick={() => props.onOpenRecent?.(item)} style={{ textDecoration: 'underline', color: 'var(--folio-ink)' }}>
                  {item.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function useEditorTick(editor: any) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!editor?.on) return;
    const refresh = () => setTick((n) => n + 1);
    editor.on('selectionUpdate', refresh);
    editor.on('transaction', refresh);
    return () => {
      editor.off('selectionUpdate', refresh);
      editor.off('transaction', refresh);
    };
  }, [editor]);
}

function clip(editor: any, command: 'cut' | 'copy' | 'paste') {
  if (!editor) return;
  editor.chain().focus().run();
  document.execCommand(command);
}

function DocumentHome({ editor, onFind }: { editor: any; onFind?: () => void }) {
  useEditorTick(editor);
  const markOn = (name: string, attrs?: Record<string, unknown>) => Boolean(editor?.isActive?.(name, attrs));
  const alignOn = (align: string) => Boolean(editor?.isActive?.({ textAlign: align }));
  const fontSize = editor?.getAttributes('textStyle')?.fontSize || '11pt';
  const fontFamily = editor?.getAttributes('textStyle')?.fontFamily || 'Georgia, serif';
  const families: Array<[string, string]> = [
    ['Georgia, serif', 'Georgia'],
    ['system-ui, sans-serif', 'Segoe UI'],
    ["'Courier New', monospace", 'Courier'],
  ];
  if (fontFamily && !families.some(([value]) => value === fontFamily)) {
    families.unshift([fontFamily, fontFamily]);
  }
  const styleName = markOn('heading', { level: 1 })
    ? 'Heading 1'
    : markOn('heading', { level: 2 })
      ? 'Heading 2'
      : markOn('heading', { level: 3 })
        ? 'Heading 3'
        : 'Paragraph';

  return commandRow(
    <>
      <RibbonGroup label={t('ribbon.clipboard')}>
        <RibbonButton large title={t('ribbon.paste')} label={t('ribbon.paste')} icon={<ClipboardPaste size={22} />} disabled={!editor} onClick={() => clip(editor, 'paste')} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <RibbonButton title={t('ribbon.cut')} label={t('ribbon.cut')} icon={<Scissors size={14} />} disabled={!editor} onClick={() => clip(editor, 'cut')} />
          <RibbonButton title={t('ribbon.copy')} label={t('ribbon.copy')} icon={<Copy size={14} />} disabled={!editor} onClick={() => clip(editor, 'copy')} />
        </div>
        <RibbonButton title={t('ribbon.undo')} icon={<Undo2 size={16} />} disabled={!editor?.can().undo()} onClick={() => editor.chain().focus().undo().run()} />
        <RibbonButton title={t('ribbon.redo')} icon={<Redo2 size={16} />} disabled={!editor?.can().redo()} onClick={() => editor.chain().focus().redo().run()} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.font')}>
        <select
          aria-label={t('ribbon.font')}
          value={fontFamily}
          disabled={!editor}
          onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
          style={{ ...ribbonFieldStyle, maxWidth: 140 }}
        >
          {families.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
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
        <RibbonButton title={t('ribbon.bold')} icon={<Bold size={16} />} pressed={markOn('bold')} disabled={!editor} onClick={() => editor.chain().focus().toggleBold().run()} />
        <RibbonButton title={t('ribbon.italic')} icon={<Italic size={16} />} pressed={markOn('italic')} disabled={!editor} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <RibbonButton title={t('ribbon.underline')} icon={<Underline size={16} />} pressed={markOn('underline')} disabled={!editor} onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <RibbonButton title={t('ribbon.strike')} icon={<Strikethrough size={16} />} pressed={markOn('strike')} disabled={!editor} onClick={() => editor.chain().focus().toggleStrike().run()} />
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
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.styles')}>
        <StyleChip name="Paragraph" active={styleName === 'Paragraph'} onClick={() => editor?.chain().focus().setParagraph().run()} />
        <StyleChip name="Heading 1" active={styleName === 'Heading 1'} onClick={() => editor?.chain().focus().setHeading({ level: 1 }).run()} style={{ fontSize: 15, fontWeight: 700 }} />
        <StyleChip name="Heading 2" active={styleName === 'Heading 2'} onClick={() => editor?.chain().focus().setHeading({ level: 2 }).run()} style={{ fontSize: 13, fontWeight: 700 }} />
        <StyleChip name="Heading 3" active={styleName === 'Heading 3'} onClick={() => editor?.chain().focus().setHeading({ level: 3 }).run()} style={{ fontSize: 12, fontWeight: 650, color: 'var(--folio-teal)' }} />
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
    'Heading 1': t('ribbon.heading1'),
    'Heading 2': t('ribbon.heading2'),
    'Heading 3': t('ribbon.heading3'),
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
        background: active ? 'var(--folio-teal-tint)' : '#fff',
        color: 'var(--folio-ink)',
        fontSize: 12,
        ...style,
      }}
    >
      {shown}
    </button>
  );
}

function DocumentInsert({ editor }: { editor: any }) {
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
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt(t('ribbon.linkPrompt'), previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
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

function DocumentLayout({
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
            if (parsed == null || formatMargin(parsed, i18n.language) === formatMargin(mm, i18n.language)) {
              setText(formatMargin(mm, i18n.language));
              return;
            }
            onCommit(parsed);
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

function sheetFrom(apiRef?: React.RefObject<WorkbookInstance | null>) {
  return () => apiRef?.current || null;
}

function SheetHome({ api }: { api?: React.RefObject<WorkbookInstance | null> }) {
  const book = sheetFrom(api);
  return commandRow(
    <>
      <RibbonGroup label={t('ribbon.clipboard')}>
        <RibbonButton title={t('ribbon.undoShort')} icon={<Undo2 size={16} />} onClick={() => book()?.handleUndo()} />
        <RibbonButton title={t('ribbon.redoShort')} icon={<Redo2 size={16} />} onClick={() => book()?.handleRedo()} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.font')}>
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
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.alignment')}>
        <RibbonButton title={t('ribbon.alignLeft')} icon={<AlignLeft size={16} />} onClick={() => { const sheet = book(); if (sheet) setSheetStyle(sheet, 'ht', 1); }} />
        <RibbonButton title={t('ribbon.alignCenter')} icon={<AlignCenter size={16} />} onClick={() => { const sheet = book(); if (sheet) setSheetStyle(sheet, 'ht', 0); }} />
        <RibbonButton title={t('ribbon.alignRight')} icon={<AlignRight size={16} />} onClick={() => { const sheet = book(); if (sheet) setSheetStyle(sheet, 'ht', 2); }} />
        <RibbonButton title={t('ribbon.wrap')} icon={<WrapText size={16} />} onClick={() => { const sheet = book(); if (sheet) toggleSheetWrap(sheet); }} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.number')}>
        <RibbonButton title={t('ribbon.general')} label={t('ribbon.general')} onClick={() => { const sheet = book(); if (sheet) setSheetNumberFormat(sheet, 'General', 'g'); }} />
        <RibbonButton title={t('ribbon.number')} label="0.00" onClick={() => { const sheet = book(); if (sheet) setSheetNumberFormat(sheet, '0.00', 'n'); }} />
        <RibbonButton title={t('ribbon.percent')} label="%" onClick={() => { const sheet = book(); if (sheet) setSheetNumberFormat(sheet, '0%', 'n'); }} />
        <RibbonButton title={t('ribbon.date')} label={t('ribbon.date')} onClick={() => { const sheet = book(); if (sheet) setSheetNumberFormat(sheet, 'yyyy-MM-dd', 'd'); }} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.cells')}>
        <RibbonButton title={t('ribbon.insertRow')} label={t('ribbon.insertRow')} icon={<Plus size={14} />} onClick={() => { const sheet = book(); if (sheet) insertSheetAxis(sheet, 'row'); }} />
        <RibbonButton title={t('ribbon.insertColumn')} label={t('ribbon.insertColumn')} icon={<Plus size={14} />} onClick={() => { const sheet = book(); if (sheet) insertSheetAxis(sheet, 'column'); }} />
        <RibbonButton title={t('ribbon.deleteRow')} label={t('ribbon.deleteRow')} icon={<Trash2 size={14} />} onClick={() => { const sheet = book(); if (sheet) deleteSheetAxis(sheet, 'row'); }} />
        <RibbonButton title={t('ribbon.deleteColumn')} label={t('ribbon.deleteColumn')} icon={<Trash2 size={14} />} onClick={() => { const sheet = book(); if (sheet) deleteSheetAxis(sheet, 'column'); }} />
        <RibbonButton title={t('ribbon.clear')} label={t('ribbon.clear')} icon={<Eraser size={14} />} onClick={() => { const sheet = book(); if (sheet) clearSheetSelection(sheet); }} />
      </RibbonGroup>
    </>,
  );
}

function SheetInsert({ api }: { api?: React.RefObject<WorkbookInstance | null> }) {
  return commandRow(
    <RibbonGroup label={t('ribbon.sheets')}>
      <RibbonButton large title={t('ribbon.newSheet')} label={t('ribbon.newSheet')} icon={<Plus size={22} />} onClick={() => api?.current?.addSheet()} />
    </RibbonGroup>,
  );
}

function slideText(state?: SlideCommandState) {
  return state?.element?.type === 'text' ? state.element : null;
}

function SlideHome({
  commands,
  state,
}: {
  commands?: React.RefObject<SlideEditorHandle | null>;
  state?: SlideCommandState;
}) {
  const api = commands?.current;
  const text = slideText(state);
  const count = state?.slideCount || 0;
  const index = state?.slideIndex || 0;
  const patch = (updates: Partial<SlideElement>) => {
    commands?.current?.patchSelected(updates);
  };
  return commandRow(
    <>
      <RibbonGroup label={t('ribbon.slides')}>
        <RibbonButton large title={t('ribbon.newSlide')} label={t('ribbon.newSlide')} icon={<Plus size={22} />} disabled={!api} onClick={() => commands?.current?.addSlide()} />
        <RibbonButton title={t('ribbon.duplicateSlide')} label={t('ribbon.duplicate')} icon={<Copy size={14} />} disabled={!api} onClick={() => commands?.current?.duplicateSlide()} />
        <RibbonButton title={t('ribbon.deleteSlide')} label={t('ribbon.delete')} icon={<Trash2 size={14} />} disabled={!api || count <= 1} onClick={() => commands?.current?.deleteSlide()} />
        <RibbonButton title={t('ribbon.moveEarlier')} icon={<ChevronUp size={16} />} disabled={!api || index <= 0} onClick={() => commands?.current?.moveSlide('up')} />
        <RibbonButton title={t('ribbon.moveLater')} icon={<ChevronDown size={16} />} disabled={!api || index >= count - 1} onClick={() => commands?.current?.moveSlide('down')} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.font')}>
        <select
          aria-label={t('ribbon.fontSize')}
          title={t('ribbon.fontSize')}
          value={text?.fontSize || 18}
          disabled={!text}
          onChange={(e) => patch({ fontSize: parseInt(e.target.value, 10) })}
          style={{ ...ribbonFieldStyle, width: 68 }}
        >
          {SLIDE_FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <RibbonButton title={t('ribbon.bold')} icon={<Bold size={16} />} pressed={Boolean(text?.bold)} disabled={!text} onClick={() => text && patch({ bold: !text.bold })} />
        <RibbonButton title={t('ribbon.italic')} icon={<Italic size={16} />} pressed={Boolean(text?.italic)} disabled={!text} onClick={() => text && patch({ italic: !text.italic })} />
        <RibbonButton title={t('ribbon.underline')} icon={<Underline size={16} />} pressed={Boolean(text?.underline)} disabled={!text} onClick={() => text && patch({ underline: !text.underline })} />
        <input
          type="color"
          title={t('ribbon.textColor')}
          aria-label={t('ribbon.textColor')}
          value={text?.color || '#1e2022'}
          disabled={!text}
          onChange={(e) => patch({ color: e.target.value })}
          style={{ width: 28, height: 28, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
        />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.paragraph')}>
        <RibbonButton title={t('ribbon.alignLeft')} icon={<AlignLeft size={16} />} pressed={text?.align === 'left'} disabled={!text} onClick={() => patch({ align: 'left' })} />
        <RibbonButton title={t('ribbon.alignCenter')} icon={<AlignCenter size={16} />} pressed={text?.align === 'center'} disabled={!text} onClick={() => patch({ align: 'center' })} />
        <RibbonButton title={t('ribbon.alignRight')} icon={<AlignRight size={16} />} pressed={text?.align === 'right'} disabled={!text} onClick={() => patch({ align: 'right' })} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.arrange')}>
        <RibbonButton title={t('ribbon.undoMove')} label={t('ribbon.undoShort')} icon={<Undo2 size={14} />} disabled={!state?.canUndo} onClick={() => commands?.current?.undo()} />
        <RibbonButton title={t('ribbon.delete')} label={t('ribbon.delete')} icon={<Trash2 size={14} />} disabled={!state?.element} onClick={() => commands?.current?.deleteSelected()} />
      </RibbonGroup>
    </>,
  );
}

function SlideInsert({ commands }: { commands?: React.RefObject<SlideEditorHandle | null> }) {
  const ready = Boolean(commands?.current);
  return commandRow(
    <>
      <RibbonGroup label={t('ribbon.text')}>
        <RibbonButton large title={t('ribbon.textBox')} label={t('ribbon.textBox')} icon={<Type size={22} />} disabled={!ready} onClick={() => commands?.current?.addText()} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.illustrations')}>
        <RibbonButton title={t('ribbon.picture')} label={t('ribbon.picture')} icon={<ImageIcon size={16} />} disabled={!ready} onClick={() => commands?.current?.addImage()} />
        <RibbonButton title={t('ribbon.video')} label={t('ribbon.video')} icon={<Video size={16} />} disabled={!ready} onClick={() => commands?.current?.addVideo()} />
        <RibbonButton title={t('ribbon.rectangle')} label={t('ribbon.rectangle')} icon={<Square size={16} />} disabled={!ready} onClick={() => commands?.current?.addShape()} />
      </RibbonGroup>
    </>,
  );
}
