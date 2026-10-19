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
  pageSize: 'letter' | 'a4';
  onPageSizeChange: (size: 'letter' | 'a4') => void;
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

export const Ribbon: React.FC<RibbonProps> = (props) => {
  const { editorState } = props;
  const [activeTab, setActiveTab] = useState<RibbonTab>(editorState.kind === 'pdf' ? 'file' : 'home');

  useEffect(() => {
    setActiveTab(editorState.kind === 'pdf' ? 'file' : 'home');
  }, [editorState.kind, editorState.id]);

  const tabs = tabsFor(editorState.kind);

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
          <TabButton key={tab} tab={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} />
        ))}
      </div>
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
            pageSize={props.pageSize}
            onPageSizeChange={props.onPageSizeChange}
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
    </div>
  );
};

function TabButton({ tab, active, onClick }: { tab: RibbonTab; active: boolean; onClick: () => void }) {
  const label = tab === 'file' ? 'File' : tab === 'home' ? 'Home' : tab === 'insert' ? 'Insert' : 'Layout';
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
              Unsaved changes
            </span>
          )}
          {editorState.importReport && (
            <button
              type="button"
              onClick={onOpenReport}
              style={{ fontSize: 11, color: 'var(--folio-teal)', textDecoration: 'underline', padding: '0 4px' }}
            >
              Import notices
            </button>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          onClick={onSave}
          title="Save (Ctrl+S)"
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
          <Save size={14} /> Save
        </button>
        <button
          type="button"
          onClick={onSaveAs}
          title="Save As (F12 or Ctrl+Shift+S)"
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
          <SaveAll size={14} /> Save As
        </button>
        <button type="button" onClick={onPrint} title="Print Document" style={{ padding: '4px 8px', borderRadius: 4, color: 'var(--folio-ink-muted)' }}>
          <Printer size={14} />
        </button>
        <button type="button" onClick={onCloseFile} title="Close File" style={{ padding: '4px 8px', borderRadius: 4, color: 'var(--folio-ink-muted)' }}>
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
          <RibbonGroup label="New">
            <RibbonButton title="New Document" label="Document" icon={<FilePlus size={16} />} onClick={() => onNew('document')} />
            <RibbonButton title="New Spreadsheet" label="Spreadsheet" icon={<TableIcon size={16} />} onClick={() => onNew('spreadsheet')} />
            <RibbonButton title="New Presentation" label="Presentation" icon={<Presentation size={16} />} onClick={() => onNew('presentation')} />
          </RibbonGroup>
          <RibbonGroup label="Open">
            <RibbonButton title="Open File..." label="Open" icon={<FolderOpen size={16} />} onClick={onOpen} />
          </RibbonGroup>
          <RibbonGroup label="Save">
            <RibbonButton title="Save" label="Save" icon={<Save size={16} />} onClick={onSave} />
            <RibbonButton title="Save As..." label="Save As" icon={<SaveAll size={16} />} onClick={onSaveAs} />
            {editorState.kind !== 'pdf' ? (
              <RibbonButton title="Save as PDF" label="Save as PDF" icon={<FileText size={16} />} onClick={onSavePdf} />
            ) : (
              <RibbonButton title="Edit as Document" label="Edit as Document" icon={<FileText size={16} />} onClick={onEditAsDocument} />
            )}
          </RibbonGroup>
          <RibbonGroup label="Print">
            <RibbonButton title="Print" label="Print" icon={<Printer size={16} />} onClick={onPrint} />
          </RibbonGroup>
        </>,
      )}
      {(recentFiles.length > 0 || drafts.length > 0) && (
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', fontSize: 12, padding: '0 14px 6px' }}>
          {drafts.length > 0 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontWeight: 650, color: 'var(--folio-ink-muted)' }}>Recovered drafts</span>
              {drafts.map((draft) => (
                <span key={draft.id} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  <button type="button" onClick={() => props.onRestoreDraft?.(draft)} style={{ textDecoration: 'underline', color: 'var(--folio-teal)' }}>
                    {draft.name}
                  </button>
                  <button type="button" aria-label={`Dismiss ${draft.name}`} onClick={() => props.onDismissDraft?.(draft)} style={{ color: 'var(--folio-ink-muted)' }}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {recentFiles.length > 0 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontWeight: 650, color: 'var(--folio-ink-muted)' }}>Recent</span>
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
      <RibbonGroup label="Clipboard">
        <RibbonButton large title="Paste" label="Paste" icon={<ClipboardPaste size={22} />} disabled={!editor} onClick={() => clip(editor, 'paste')} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <RibbonButton title="Cut" label="Cut" icon={<Scissors size={14} />} disabled={!editor} onClick={() => clip(editor, 'cut')} />
          <RibbonButton title="Copy" label="Copy" icon={<Copy size={14} />} disabled={!editor} onClick={() => clip(editor, 'copy')} />
        </div>
        <RibbonButton title="Undo (Ctrl+Z)" icon={<Undo2 size={16} />} disabled={!editor?.can().undo()} onClick={() => editor.chain().focus().undo().run()} />
        <RibbonButton title="Redo (Ctrl+Y)" icon={<Redo2 size={16} />} disabled={!editor?.can().redo()} onClick={() => editor.chain().focus().redo().run()} />
      </RibbonGroup>
      <RibbonGroup label="Font">
        <select
          aria-label="Font"
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
          aria-label="Font size"
          title="Font Size"
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
        <RibbonButton title="Bold (Ctrl+B)" icon={<Bold size={16} />} pressed={markOn('bold')} disabled={!editor} onClick={() => editor.chain().focus().toggleBold().run()} />
        <RibbonButton title="Italic (Ctrl+I)" icon={<Italic size={16} />} pressed={markOn('italic')} disabled={!editor} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <RibbonButton title="Underline (Ctrl+U)" icon={<Underline size={16} />} pressed={markOn('underline')} disabled={!editor} onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <RibbonButton title="Strikethrough" icon={<Strikethrough size={16} />} pressed={markOn('strike')} disabled={!editor} onClick={() => editor.chain().focus().toggleStrike().run()} />
        <input
          type="color"
          title="Text Color"
          aria-label="Text Color"
          disabled={!editor}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          style={{ width: 28, height: 28, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
        />
        <RibbonButton title="Highlight Yellow" icon={<Highlighter size={16} />} pressed={markOn('highlight')} disabled={!editor} onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()} />
      </RibbonGroup>
      <RibbonGroup label="Paragraph">
        <RibbonButton title="Align Left" icon={<AlignLeft size={16} />} pressed={alignOn('left')} disabled={!editor} onClick={() => editor.chain().focus().setTextAlign('left').run()} />
        <RibbonButton title="Align Center" icon={<AlignCenter size={16} />} pressed={alignOn('center')} disabled={!editor} onClick={() => editor.chain().focus().setTextAlign('center').run()} />
        <RibbonButton title="Align Right" icon={<AlignRight size={16} />} pressed={alignOn('right')} disabled={!editor} onClick={() => editor.chain().focus().setTextAlign('right').run()} />
        <RibbonButton title="Align Justify" icon={<AlignJustify size={16} />} pressed={alignOn('justify')} disabled={!editor} onClick={() => editor.chain().focus().setTextAlign('justify').run()} />
        <RibbonButton title="Bullet List" icon={<List size={16} />} pressed={markOn('bulletList')} disabled={!editor} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <RibbonButton title="Numbered List" icon={<ListOrdered size={16} />} pressed={markOn('orderedList')} disabled={!editor} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <RibbonButton title="Decrease Indent" icon={<OutdentIcon size={16} />} disabled={!editor} onClick={() => editor.chain().focus().outdent().run()} />
        <RibbonButton title="Increase Indent" icon={<IndentIcon size={16} />} disabled={!editor} onClick={() => editor.chain().focus().indent().run()} />
      </RibbonGroup>
      <RibbonGroup label="Styles">
        <StyleChip name="Paragraph" active={styleName === 'Paragraph'} onClick={() => editor?.chain().focus().setParagraph().run()} />
        <StyleChip name="Heading 1" active={styleName === 'Heading 1'} onClick={() => editor?.chain().focus().setHeading({ level: 1 }).run()} style={{ fontSize: 15, fontWeight: 700 }} />
        <StyleChip name="Heading 2" active={styleName === 'Heading 2'} onClick={() => editor?.chain().focus().setHeading({ level: 2 }).run()} style={{ fontSize: 13, fontWeight: 700 }} />
        <StyleChip name="Heading 3" active={styleName === 'Heading 3'} onClick={() => editor?.chain().focus().setHeading({ level: 3 }).run()} style={{ fontSize: 12, fontWeight: 650, color: 'var(--folio-teal)' }} />
      </RibbonGroup>
      <RibbonGroup label="Editing">
        <RibbonButton large title="Find" label="Find" icon={<Search size={20} />} disabled={!editor} onClick={onFind} />
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
  return (
    <button
      type="button"
      title={name}
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
      {name}
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
    const url = window.prompt('Enter link URL', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  };

  return commandRow(
    <>
      <RibbonGroup label="Tables">
        <RibbonButton
          large
          title="Table (3x3)"
          label="Table"
          icon={<TableIcon size={22} />}
          disabled={!editor}
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        />
        {inTable && (
          <>
            <RibbonButton title="Add row" label="Row" icon={<Plus size={14} />} onClick={() => editor.chain().focus().addRowAfter().run()} />
            <RibbonButton title="Add column" label="Column" icon={<Plus size={14} />} onClick={() => editor.chain().focus().addColumnAfter().run()} />
            <RibbonButton title="Delete table" label="Delete" icon={<Trash2 size={14} />} onClick={() => editor.chain().focus().deleteTable().run()} />
          </>
        )}
      </RibbonGroup>
      <RibbonGroup label="Illustrations">
        <RibbonButton large title="Picture" label="Picture" icon={<ImageIcon size={22} />} disabled={!editor} onClick={insertImage} />
      </RibbonGroup>
      <RibbonGroup label="Links">
        <RibbonButton title="Link" label="Link" icon={<LinkIcon size={16} />} disabled={!editor} onClick={insertLink} />
        <RibbonButton title="Divider" label="Divider" icon={<Minus size={16} />} disabled={!editor} onClick={() => editor.chain().focus().setHorizontalRule().run()} />
      </RibbonGroup>
      <RibbonGroup label="Pages">
        <RibbonButton title="Page Break" label="Page break" icon={<SeparatorHorizontal size={16} />} disabled={!editor} onClick={() => editor.chain().focus().setPageBreak().run()} />
      </RibbonGroup>
    </>,
  );
}

function DocumentLayout({
  pageSize,
  onPageSizeChange,
  zoom,
  onZoomChange,
}: {
  pageSize: 'letter' | 'a4';
  onPageSizeChange: (size: 'letter' | 'a4') => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}) {
  return commandRow(
    <>
      <RibbonGroup label="Page">
        <select aria-label="Page size" value={pageSize} onChange={(e) => onPageSizeChange(e.target.value as 'letter' | 'a4')} style={ribbonFieldStyle}>
          <option value="letter">Letter (8.5 × 11 in)</option>
          <option value="a4">A4 (210 × 297 mm)</option>
        </select>
      </RibbonGroup>
      <ZoomGroup zoom={zoom} onZoomChange={onZoomChange} />
    </>,
  );
}

function ZoomGroup({ zoom, onZoomChange }: { zoom: number; onZoomChange: (zoom: number) => void }) {
  return (
    <RibbonGroup label="Zoom">
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
      <RibbonGroup label="Clipboard">
        <RibbonButton title="Undo" icon={<Undo2 size={16} />} onClick={() => book()?.handleUndo()} />
        <RibbonButton title="Redo" icon={<Redo2 size={16} />} onClick={() => book()?.handleRedo()} />
      </RibbonGroup>
      <RibbonGroup label="Font">
        <select
          aria-label="Font size"
          title="Font Size"
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
        <RibbonButton title="Bold (Ctrl+B)" icon={<Bold size={16} />} onClick={() => { const sheet = book(); if (sheet) toggleSheetMark(sheet, 'bl'); }} />
        <RibbonButton title="Italic (Ctrl+I)" icon={<Italic size={16} />} onClick={() => { const sheet = book(); if (sheet) toggleSheetMark(sheet, 'it'); }} />
        <RibbonButton title="Underline (Ctrl+U)" icon={<Underline size={16} />} onClick={() => { const sheet = book(); if (sheet) toggleSheetMark(sheet, 'un'); }} />
        <input
          type="color"
          title="Text Color"
          aria-label="Text Color"
          onChange={(e) => {
            const sheet = book();
            if (sheet) setSheetStyle(sheet, 'fc', e.target.value);
          }}
          style={{ width: 28, height: 28, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
        />
      </RibbonGroup>
      <RibbonGroup label="Alignment">
        <RibbonButton title="Align Left" icon={<AlignLeft size={16} />} onClick={() => { const sheet = book(); if (sheet) setSheetStyle(sheet, 'ht', 1); }} />
        <RibbonButton title="Align Center" icon={<AlignCenter size={16} />} onClick={() => { const sheet = book(); if (sheet) setSheetStyle(sheet, 'ht', 0); }} />
        <RibbonButton title="Align Right" icon={<AlignRight size={16} />} onClick={() => { const sheet = book(); if (sheet) setSheetStyle(sheet, 'ht', 2); }} />
        <RibbonButton title="Wrap text" icon={<WrapText size={16} />} onClick={() => { const sheet = book(); if (sheet) toggleSheetWrap(sheet); }} />
      </RibbonGroup>
      <RibbonGroup label="Number">
        <RibbonButton title="General" label="General" onClick={() => { const sheet = book(); if (sheet) setSheetNumberFormat(sheet, 'General', 'g'); }} />
        <RibbonButton title="Number" label="0.00" onClick={() => { const sheet = book(); if (sheet) setSheetNumberFormat(sheet, '0.00', 'n'); }} />
        <RibbonButton title="Percent" label="%" onClick={() => { const sheet = book(); if (sheet) setSheetNumberFormat(sheet, '0%', 'n'); }} />
        <RibbonButton title="Date" label="Date" onClick={() => { const sheet = book(); if (sheet) setSheetNumberFormat(sheet, 'yyyy-MM-dd', 'd'); }} />
      </RibbonGroup>
      <RibbonGroup label="Cells">
        <RibbonButton title="Insert row" label="Insert row" icon={<Plus size={14} />} onClick={() => { const sheet = book(); if (sheet) insertSheetAxis(sheet, 'row'); }} />
        <RibbonButton title="Insert column" label="Insert column" icon={<Plus size={14} />} onClick={() => { const sheet = book(); if (sheet) insertSheetAxis(sheet, 'column'); }} />
        <RibbonButton title="Delete row" label="Delete row" icon={<Trash2 size={14} />} onClick={() => { const sheet = book(); if (sheet) deleteSheetAxis(sheet, 'row'); }} />
        <RibbonButton title="Delete column" label="Delete column" icon={<Trash2 size={14} />} onClick={() => { const sheet = book(); if (sheet) deleteSheetAxis(sheet, 'column'); }} />
        <RibbonButton title="Clear" label="Clear" icon={<Eraser size={14} />} onClick={() => { const sheet = book(); if (sheet) clearSheetSelection(sheet); }} />
      </RibbonGroup>
    </>,
  );
}

function SheetInsert({ api }: { api?: React.RefObject<WorkbookInstance | null> }) {
  return commandRow(
    <RibbonGroup label="Sheets">
      <RibbonButton large title="New sheet" label="New sheet" icon={<Plus size={22} />} onClick={() => api?.current?.addSheet()} />
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
      <RibbonGroup label="Slides">
        <RibbonButton large title="New slide" label="New slide" icon={<Plus size={22} />} disabled={!api} onClick={() => commands?.current?.addSlide()} />
        <RibbonButton title="Duplicate slide" label="Duplicate" icon={<Copy size={14} />} disabled={!api} onClick={() => commands?.current?.duplicateSlide()} />
        <RibbonButton title="Delete slide" label="Delete" icon={<Trash2 size={14} />} disabled={!api || count <= 1} onClick={() => commands?.current?.deleteSlide()} />
        <RibbonButton title="Move earlier" icon={<ChevronUp size={16} />} disabled={!api || index <= 0} onClick={() => commands?.current?.moveSlide('up')} />
        <RibbonButton title="Move later" icon={<ChevronDown size={16} />} disabled={!api || index >= count - 1} onClick={() => commands?.current?.moveSlide('down')} />
      </RibbonGroup>
      <RibbonGroup label="Font">
        <select
          aria-label="Font size"
          title="Font Size"
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
        <RibbonButton title="Bold (Ctrl+B)" icon={<Bold size={16} />} pressed={Boolean(text?.bold)} disabled={!text} onClick={() => text && patch({ bold: !text.bold })} />
        <RibbonButton title="Italic (Ctrl+I)" icon={<Italic size={16} />} pressed={Boolean(text?.italic)} disabled={!text} onClick={() => text && patch({ italic: !text.italic })} />
        <RibbonButton title="Underline (Ctrl+U)" icon={<Underline size={16} />} pressed={Boolean(text?.underline)} disabled={!text} onClick={() => text && patch({ underline: !text.underline })} />
        <input
          type="color"
          title="Text Color"
          aria-label="Text Color"
          value={text?.color || '#1e2022'}
          disabled={!text}
          onChange={(e) => patch({ color: e.target.value })}
          style={{ width: 28, height: 28, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
        />
      </RibbonGroup>
      <RibbonGroup label="Paragraph">
        <RibbonButton title="Align Left" icon={<AlignLeft size={16} />} pressed={text?.align === 'left'} disabled={!text} onClick={() => patch({ align: 'left' })} />
        <RibbonButton title="Align Center" icon={<AlignCenter size={16} />} pressed={text?.align === 'center'} disabled={!text} onClick={() => patch({ align: 'center' })} />
        <RibbonButton title="Align Right" icon={<AlignRight size={16} />} pressed={text?.align === 'right'} disabled={!text} onClick={() => patch({ align: 'right' })} />
      </RibbonGroup>
      <RibbonGroup label="Arrange">
        <RibbonButton title="Undo move or resize" label="Undo" icon={<Undo2 size={14} />} disabled={!state?.canUndo} onClick={() => commands?.current?.undo()} />
        <RibbonButton title="Delete" label="Delete" icon={<Trash2 size={14} />} disabled={!state?.element} onClick={() => commands?.current?.deleteSelected()} />
      </RibbonGroup>
    </>,
  );
}

function SlideInsert({ commands }: { commands?: React.RefObject<SlideEditorHandle | null> }) {
  const ready = Boolean(commands?.current);
  return commandRow(
    <>
      <RibbonGroup label="Text">
        <RibbonButton large title="Text box" label="Text box" icon={<Type size={22} />} disabled={!ready} onClick={() => commands?.current?.addText()} />
      </RibbonGroup>
      <RibbonGroup label="Illustrations">
        <RibbonButton title="Picture" label="Picture" icon={<ImageIcon size={16} />} disabled={!ready} onClick={() => commands?.current?.addImage()} />
        <RibbonButton title="Video" label="Video" icon={<Video size={16} />} disabled={!ready} onClick={() => commands?.current?.addVideo()} />
        <RibbonButton title="Rectangle" label="Rectangle" icon={<Square size={16} />} disabled={!ready} onClick={() => commands?.current?.addShape()} />
      </RibbonGroup>
    </>,
  );
}
