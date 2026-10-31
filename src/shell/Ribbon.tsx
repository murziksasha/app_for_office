import React, { useEffect, useState } from 'react';
import type { WorkbookInstance } from '@fortune-sheet/react';
import { DraftItem, EditorState, DocumentKind, RecentItem, SlideElement } from '../types';
import type { SlideCommandState, SlideEditorHandle } from '../slides/SlideEditor';
import {
  autoSumSheet,
  clearSheetSelection,
  deleteSheetAxis,
  fillSheetSelection,
  freezeSheet,
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
} from '../spreadsheet/sheetCommands';
import { PrintSetupDialog } from '../spreadsheet/PrintSetupDialog';
import { defaultPrintSetup } from '../spreadsheet/sheetPrint';
import { clearFormatting } from '../document/clearFormatting';
import { applyDocumentStyle } from '../document/styles';
import {
  useFormatPainter,
  formatPainter,
  captureDocumentFormat,
  captureSheetFormat,
} from './formatPainter';
import { RibbonGroup } from './ribbon/RibbonGroup';
import { RibbonButton, ribbonFieldStyle } from './ribbon/RibbonButton';
import { LanguageButton } from './LanguageButton';
import { i18n, t } from '../i18n/instance';
import { Backstage } from './Backstage';
import { CommandSearch } from './CommandSearch';
import { QuickAccess } from './QuickAccess';
import { handleKeyTipKey, TAB_KEY_TIPS, type KeyTipMode } from './keyTips';
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
} from 'lucide-react';

type RibbonTab = 'file' | 'home' | 'insert' | 'layout' | 'view' | 'table' | 'picture';

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
  onStartSlideshow?: (mode: 'beginning' | 'current') => void;
  onOpenSettings?: () => void;
  docPageInfo?: { page: number; totalPages: number; words?: number } | null;
  templates?: any[];
  showOutline?: boolean;
  onToggleOutline?: () => void;
}

function tabsFor(kind: EditorState['kind']): RibbonTab[] {
  if (kind === 'pdf') return ['file'];
  if (kind === 'document') return ['file', 'home', 'insert', 'layout', 'view'];
  if (kind === 'presentation') return ['file', 'home', 'insert', 'view'];
  if (kind === 'spreadsheet') return ['file', 'home', 'insert', 'layout'];
  return ['file', 'home', 'insert'];
}

export function getContextualTabs(isTable?: boolean, isPicture?: boolean): string[] {
  const tabs: string[] = [];
  if (isTable) tabs.push('table');
  if (isPicture) tabs.push('picture');
  return tabs;
}

const RIBBON_COLLAPSED_KEY = 'folio_ribbon_collapsed';

export const Ribbon: React.FC<RibbonProps> = (props) => {
  const { editorState } = props;
  const [activeTab, setActiveTab] = useState<RibbonTab>(editorState.kind === 'pdf' ? 'file' : 'home');
  const [keyTipMode, setKeyTipMode] = useState<KeyTipMode>('none');
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

  const isTableActive = editorState.kind === 'document' && Boolean(props.documentEditor?.isActive?.('table'));
  const isImageActive = editorState.kind === 'document' && Boolean(props.documentEditor?.isActive?.('image'));
  const contextual = editorState.kind === 'document' ? getContextualTabs(isTableActive, isImageActive) : [];
  const tabs = [...tabsFor(editorState.kind), ...contextual] as RibbonTab[];

  useEffect(() => {
    if (activeTab === 'table' && !isTableActive) {
      setActiveTab('home');
    } else if (activeTab === 'picture' && !isImageActive) {
      setActiveTab('home');
    }
  }, [activeTab, isTableActive, isImageActive]);

  const selectTab = (tab: RibbonTab, toggleCollapse = true) => {
    if (tab === 'file' && editorState.kind !== 'pdf') {
      setActiveTab('file');
      return;
    }
    if (collapsed) {
      setActiveTab(tab);
      setCollapsed(false);
      return;
    }
    if (tab === activeTab) {
      if (toggleCollapse) {
        setCollapsed(true);
      }
      return;
    }
    setActiveTab(tab);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key === 'Alt') {
        e.preventDefault();
        setKeyTipMode((prev) => (prev === 'none' ? 'tabs' : 'none'));
        return;
      }

      if (keyTipMode !== 'none') {
        const availableTabs = tabsFor(editorState.kind);
        const commandsForTab: Record<string, () => void> = {
          B: () => props.documentEditor?.chain().focus().toggleBold().run(),
          I: () => props.documentEditor?.chain().focus().toggleItalic().run(),
          U: () => props.documentEditor?.chain().focus().toggleUnderline().run(),
        };
        const quickAccessCommands: Record<string, () => void> = {
          save: props.onSave,
          undo: () => props.documentEditor?.chain().focus().undo().run(),
          redo: () => props.documentEditor?.chain().focus().redo().run(),
          print: props.onPrint,
        };

        const result = handleKeyTipKey(
          e.key,
          { mode: keyTipMode, activeTab },
          availableTabs,
          commandsForTab,
          quickAccessCommands,
          (tab) => {
            setCollapsed(false);
            selectTab(tab as RibbonTab, false);
          },
        );

        if (result.nextState.mode !== keyTipMode || result.nextState.activeTab !== activeTab) {
          e.preventDefault();
          setKeyTipMode(result.nextState.mode);
          if (result.nextState.activeTab !== activeTab) {
            setActiveTab(result.nextState.activeTab as RibbonTab);
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [keyTipMode, activeTab, editorState.kind, props]);

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
      <QuickAccess
        editorState={editorState}
        onSave={props.onSave}
        onPrint={props.onPrint}
        documentEditor={props.documentEditor}
        sheetApi={props.sheetApi}
        slideCommands={props.slideCommands}
      />
      <TitleBar {...props} />
      <div
        className="folio-tab-strip"
        style={{
          display: 'flex',
          gap: 2,
          padding: '0 12px',
          borderBottom: '1px solid var(--folio-border)',
        }}
      >
        {tabs.map((tab) => (
          <TabButton
            key={tab}
            tab={tab}
            active={activeTab === tab}
            keyTip={keyTipMode === 'tabs' ? TAB_KEY_TIPS[tab] : undefined}
            onClick={() => selectTab(tab)}
          />
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
      {activeTab === 'file' && editorState.kind !== 'pdf' && (
        <Backstage
          editorState={editorState}
          docPageInfo={props.docPageInfo}
          onClose={() => setActiveTab('home')}
          onNew={props.onNew}
          onOpen={props.onOpen}
          onSave={props.onSave}
          onSaveAs={props.onSaveAs}
          onSavePdf={props.onSavePdf || (() => {})}
          onEditAsDocument={props.onEditAsDocument}
          onPrint={props.onPrint}
          onCloseFile={props.onCloseFile}
          onOpenSettings={props.onOpenSettings}
          recentFiles={props.recentFiles as any}
          drafts={props.drafts as any}
          onOpenRecent={props.onOpenRecent as any}
          onRestoreDraft={props.onRestoreDraft as any}
          onDismissDraft={props.onDismissDraft as any}
          templates={props.templates}
        />
      )}
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
        {activeTab === 'file' && editorState.kind === 'pdf' && <FilePane {...props} />}
        {activeTab === 'home' && editorState.kind === 'document' && (
          <DocumentHome editor={props.documentEditor} onFind={props.onFind} keyTipMode={keyTipMode} />
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
        {activeTab === 'view' && editorState.kind === 'document' && (
          <DocumentView
            showOutline={props.showOutline}
            onToggleOutline={props.onToggleOutline}
            zoom={props.zoom}
            onZoomChange={props.onZoomChange}
          />
        )}
        {activeTab === 'table' && editorState.kind === 'document' && (
          <TableTab editor={props.documentEditor} />
        )}
        {activeTab === 'picture' && editorState.kind === 'document' && (
          <PictureTab editor={props.documentEditor} />
        )}
        {activeTab === 'home' && editorState.kind === 'spreadsheet' && (
          <SheetHome api={props.sheetApi} onFind={props.onFind} />
        )}
        {activeTab === 'insert' && editorState.kind === 'spreadsheet' && <SheetInsert api={props.sheetApi} />}
        {activeTab === 'layout' && editorState.kind === 'spreadsheet' && <SheetLayout api={props.sheetApi} />}
        {activeTab === 'home' && editorState.kind === 'presentation' && (
          <SlideHome commands={props.slideCommands} state={props.slideState} onStartSlideshow={props.onStartSlideshow} />
        )}
        {activeTab === 'insert' && editorState.kind === 'presentation' && <SlideInsert commands={props.slideCommands} />}
        {activeTab === 'view' && editorState.kind === 'presentation' && (
          <SlideView commands={props.slideCommands} state={props.slideState} />
        )}
      </div>
      )}
    </div>
  );
};

function TabButton({
  tab,
  active,
  keyTip,
  onClick,
}: {
  tab: RibbonTab;
  active: boolean;
  keyTip?: string;
  onClick: () => void;
}) {
  const label =
    tab === 'file'
      ? t('ribbon.file')
      : tab === 'home'
        ? t('ribbon.home')
        : tab === 'insert'
          ? t('ribbon.insert')
          : tab === 'layout'
            ? t('ribbon.layout')
            : tab === 'view'
              ? t('ribbon.view')
              : tab === 'table'
                ? t('ribbon.table')
                : tab === 'picture'
                  ? t('ribbon.picture')
                  : tab;
  const file = tab === 'file';
  return (
    <button
      type="button"
      data-testid={`ribbon-tab-${tab}`}
      onClick={onClick}
      style={{
        position: 'relative',
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
      {keyTip && (
        <span
          data-testid={`keytip-tab-${tab}`}
          style={{
            position: 'absolute',
            bottom: -6,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 3,
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
            zIndex: 1200,
            lineHeight: 1.2,
          }}
        >
          {keyTip}
        </span>
      )}
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
      <CommandSearch
        kind={editorState.kind}
        context={{
          editor: props.documentEditor,
          api: props.sheetApi?.current,
          workbook: props.sheetApi?.current,
          slideHandle: props.slideCommands?.current,
          onSave: props.onSave,
          onSaveAs: props.onSaveAs,
          onPrint: props.onPrint,
          onSavePdf: props.onSavePdf,
          startSlideshow: props.onStartSlideshow,
          toggleSnapToGrid: props.slideCommands?.current?.toggleSnapToGrid,
          alignSelected: props.slideCommands?.current?.alignSelected,
          distributeSelected: props.slideCommands?.current?.distributeSelected,
          bringForward: props.slideCommands?.current?.bringForward,
          sendBackward: props.slideCommands?.current?.sendBackward,
          applyPalette: props.slideCommands?.current?.applyPalette,
          toggleViewMode: props.slideCommands?.current?.toggleViewMode,
        }}
      />
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

function DocumentHome({
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
      <RibbonGroup label={t('ribbon.styles')}>
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
      <RibbonGroup label={t('ribbon.references')}>
        <RibbonButton
          title={t('ribbon.toc')}
          label={t('ribbon.toc')}
          icon={<FileText size={16} />}
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

function DocumentView({
  showOutline,
  onToggleOutline,
  zoom,
  onZoomChange,
}: {
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
      </RibbonGroup>
      <ZoomGroup zoom={zoom} onZoomChange={onZoomChange} />
    </>,
  );
}

function TableTab({ editor }: { editor: any }) {
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

function PictureTab({ editor }: { editor: any }) {
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

function sheetFrom(apiRef?: React.RefObject<WorkbookInstance | null>) {
  return () => apiRef?.current || null;
}

function SheetHome({
  api,
  onFind,
}: {
  api?: React.RefObject<WorkbookInstance | null>;
  onFind?: () => void;
}) {
  const book = sheetFrom(api);
  const painterState = useFormatPainter();
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
        <RibbonButton title={t('ribbon.date')} label={t('ribbon.date')} onClick={() => { const sheet = book(); if (sheet) setSheetNumberFormat(sheet, 'yyyy-MM-dd', 'd'); }} />
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
      <RibbonGroup label={t('ribbon.view')}>
        <RibbonButton title={t('ribbon.freezeRow')} label={t('ribbon.freezeRow')} icon={<Pin size={14} />} onClick={() => { const sheet = book(); if (sheet) freezeSheet(sheet, 'row'); }} />
        <RibbonButton title={t('ribbon.freezeColumn')} label={t('ribbon.freezeColumn')} icon={<Pin size={14} />} onClick={() => { const sheet = book(); if (sheet) freezeSheet(sheet, 'column'); }} />
        <RibbonButton title={t('ribbon.unfreeze')} label={t('ribbon.unfreeze')} icon={<PinOff size={14} />} onClick={() => { const sheet = book(); if (sheet) unfreezeSheet(sheet); }} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.data')}>
        <RibbonButton title={t('ribbon.sortAsc')} label={t('ribbon.sortAsc')} icon={<ArrowDownAZ size={14} />} onClick={() => { const sheet = book(); if (sheet) sortSheetSelection(sheet, true); }} />
        <RibbonButton title={t('ribbon.sortDesc')} label={t('ribbon.sortDesc')} icon={<ArrowDownZA size={14} />} onClick={() => { const sheet = book(); if (sheet) sortSheetSelection(sheet, false); }} />
        <RibbonButton title={t('ribbon.filter')} label={t('ribbon.filter')} icon={<ListFilter size={14} />} onClick={() => { const sheet = book(); if (sheet) toggleSheetFilter(sheet); }} />
        <RibbonButton title={t('ribbon.autoSum')} label={t('ribbon.autoSum')} icon={<Sigma size={14} />} onClick={() => { const sheet = book(); if (sheet) autoSumSheet(sheet); }} />
        <RibbonButton title={t('ribbon.fill')} label={t('ribbon.fill')} icon={<Plus size={14} />} onClick={() => { const sheet = book(); if (sheet) fillSheetSelection(sheet); }} />
        <RibbonButton title={t('ribbon.dataValidation')} label={t('ribbon.dataValidation')} icon={<List size={14} />} onClick={() => { const sheet = book(); if (sheet) addSheetDataValidation(sheet); }} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.editing')}>
        <RibbonButton large title={t('ribbon.find')} label={t('ribbon.find')} icon={<Search size={20} />} onClick={onFind} />
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

function SheetLayout({ api }: { api?: React.RefObject<WorkbookInstance | null> }) {
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

function slideText(state?: SlideCommandState) {
  return state?.element?.type === 'text' ? state.element : null;
}

function SlideHome({
  commands,
  state,
  onStartSlideshow,
}: {
  commands?: React.RefObject<SlideEditorHandle | null>;
  state?: SlideCommandState;
  onStartSlideshow?: (mode: 'beginning' | 'current') => void;
}) {
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const api = commands?.current;
  const text = slideText(state);
  const count = state?.slideCount || 0;
  const index = state?.slideIndex || 0;
  const patch = (updates: Partial<SlideElement>) => {
    commands?.current?.patchSelected(updates);
  };
  return commandRow(
    <>
      <RibbonGroup label={t('ribbon.slideshow')}>
        <RibbonButton
          large
          title={`${t('ribbon.fromBeginning')} (F5)`}
          label={t('ribbon.fromBeginning')}
          icon={<Presentation size={22} />}
          disabled={!api}
          onClick={() => onStartSlideshow?.('beginning')}
        />
        <RibbonButton
          title={`${t('ribbon.fromCurrent')} (Shift+F5)`}
          label={t('ribbon.fromCurrentShort')}
          icon={<Presentation size={14} />}
          disabled={!api}
          onClick={() => onStartSlideshow?.('current')}
        />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.slides')}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}>
          <RibbonButton
            large
            title={t('ribbon.newSlide')}
            label={t('ribbon.newSlide')}
            icon={<Plus size={22} />}
            disabled={!api}
            onClick={() => commands?.current?.addSlide()}
          />
          <button
            type="button"
            aria-label="Choose Slide Layout"
            data-testid="folio-slide-layout-dropdown"
            disabled={!api}
            onClick={() => setLayoutMenuOpen((prev) => !prev)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0 4px',
              cursor: api ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--folio-text-muted)',
              borderRadius: 4,
            }}
          >
            <ChevronDown size={14} />
          </button>
          {layoutMenuOpen && (
            <div
              data-testid="folio-slide-layout-menu"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 4,
                backgroundColor: 'var(--folio-panel)',
                border: '1px solid var(--folio-border)',
                borderRadius: 4,
                boxShadow: 'var(--folio-shadow-popup)',
                zIndex: 100,
                minWidth: 160,
                display: 'flex',
                flexDirection: 'column',
                padding: '4px 0',
              }}
            >
              <button
                type="button"
                data-testid="folio-layout-title"
                onClick={() => {
                  setLayoutMenuOpen(false);
                  commands?.current?.addSlide('title');
                }}
                style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--folio-text)',
                }}
              >
                {t('ribbon.layoutTitle')}
              </button>
              <button
                type="button"
                data-testid="folio-layout-titleContent"
                onClick={() => {
                  setLayoutMenuOpen(false);
                  commands?.current?.addSlide('titleContent');
                }}
                style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--folio-text)',
                }}
              >
                {t('ribbon.layoutTitleContent')}
              </button>
              <button
                type="button"
                data-testid="folio-layout-twoContent"
                onClick={() => {
                  setLayoutMenuOpen(false);
                  commands?.current?.addSlide('twoContent');
                }}
                style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--folio-text)',
                }}
              >
                {t('ribbon.layoutTwoContent')}
              </button>
              <button
                type="button"
                data-testid="folio-layout-blank"
                onClick={() => {
                  setLayoutMenuOpen(false);
                  commands?.current?.addSlide('blank');
                }}
                style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--folio-text)',
                }}
              >
                {t('ribbon.layoutBlank')}
              </button>
            </div>
          )}
        </div>
        <select
          aria-label={t('ribbon.slideSize')}
          title={t('ribbon.slideSize')}
          value={state?.slideSize || '16:9'}
          disabled={!api}
          onChange={(e) => commands?.current?.setSlideSize(e.target.value as '16:9' | '16:10' | '4:3')}
          style={{ ...ribbonFieldStyle, width: 76 }}
        >
          <option value="16:9">16:9</option>
          <option value="16:10">16:10</option>
          <option value="4:3">4:3</option>
        </select>
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
        <RibbonButton
          title={t('ribbon.bringForward')}
          label={t('ribbon.bringForward')}
          icon={<BringToFront size={14} />}
          disabled={!state?.canReorder}
          onClick={() => commands?.current?.bringForward?.()}
        />
        <RibbonButton
          title={t('ribbon.sendBackward')}
          label={t('ribbon.sendBackward')}
          icon={<SendToBack size={14} />}
          disabled={!state?.canReorder}
          onClick={() => commands?.current?.sendBackward?.()}
        />
        <RibbonButton
          title={t('ribbon.alignLeft')}
          icon={<AlignStartHorizontal size={14} />}
          disabled={!state?.canAlign}
          onClick={() => commands?.current?.alignSelected?.('left')}
        />
        <RibbonButton
          title={t('ribbon.alignCenter')}
          icon={<AlignCenterHorizontal size={14} />}
          disabled={!state?.canAlign}
          onClick={() => commands?.current?.alignSelected?.('center')}
        />
        <RibbonButton
          title={t('ribbon.alignRight')}
          icon={<AlignEndHorizontal size={14} />}
          disabled={!state?.canAlign}
          onClick={() => commands?.current?.alignSelected?.('right')}
        />
        <RibbonButton
          title={t('ribbon.alignTop')}
          icon={<AlignStartVertical size={14} />}
          disabled={!state?.canAlign}
          onClick={() => commands?.current?.alignSelected?.('top')}
        />
        <RibbonButton
          title={t('ribbon.alignMiddle')}
          icon={<AlignCenterVertical size={14} />}
          disabled={!state?.canAlign}
          onClick={() => commands?.current?.alignSelected?.('middle')}
        />
        <RibbonButton
          title={t('ribbon.alignBottom')}
          icon={<AlignEndVertical size={14} />}
          disabled={!state?.canAlign}
          onClick={() => commands?.current?.alignSelected?.('bottom')}
        />
        <RibbonButton
          title={t('ribbon.distributeHorizontally')}
          icon={<AlignHorizontalDistributeCenter size={14} />}
          disabled={!state?.canDistribute}
          onClick={() => commands?.current?.distributeSelected?.('horizontal')}
        />
        <RibbonButton
          title={t('ribbon.distributeVertically')}
          icon={<AlignVerticalDistributeCenter size={14} />}
          disabled={!state?.canDistribute}
          onClick={() => commands?.current?.distributeSelected?.('vertical')}
        />
        <RibbonButton
          title={t('ribbon.snapToGrid')}
          icon={<Grid size={14} />}
          pressed={Boolean(state?.snapToGrid)}
          disabled={!api}
          onClick={() => commands?.current?.toggleSnapToGrid?.()}
        />
        <RibbonButton title={t('ribbon.undoMove')} label={t('ribbon.undoShort')} icon={<Undo2 size={14} />} disabled={!state?.canUndo} onClick={() => commands?.current?.undo()} />
        <RibbonButton title={t('ribbon.delete')} label={t('ribbon.delete')} icon={<Trash2 size={14} />} disabled={!state?.element} onClick={() => commands?.current?.deleteSelected()} />
      </RibbonGroup>
      {state?.element?.type === 'rect' && (
        <RibbonGroup label={t('ribbon.illustrations')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--folio-text-muted)' }}>{t('ribbon.fill')}</span>
            <input
              type="color"
              title={t('ribbon.fill')}
              aria-label={t('ribbon.fill')}
              value={state.element.fill || '#e2e8f0'}
              onChange={(e) => patch({ fill: e.target.value })}
              style={{ width: 28, height: 28, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--folio-text-muted)' }}>{t('ribbon.outlineColor')}</span>
            <input
              type="color"
              title={t('ribbon.outlineColor')}
              aria-label={t('ribbon.outlineColor')}
              value={state.element.borderColor || '#94a3b8'}
              onChange={(e) => patch({ borderColor: e.target.value })}
              style={{ width: 28, height: 28, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
            />
          </div>
        </RibbonGroup>
      )}
      {state?.element?.type === 'table' && (
        <RibbonGroup label={t('ribbon.table')}>
          <RibbonButton title={t('ribbon.addRow')} label={t('ribbon.addRow')} icon={<Plus size={14} />} disabled={!api} onClick={() => commands?.current?.addTableRow()} />
          <RibbonButton title={t('ribbon.deleteRow')} label={t('ribbon.deleteRow')} icon={<Trash2 size={14} />} disabled={!api} onClick={() => commands?.current?.deleteTableRow()} />
          <RibbonButton title={t('ribbon.addColumn')} label={t('ribbon.addColumn')} icon={<Plus size={14} />} disabled={!api} onClick={() => commands?.current?.addTableColumn()} />
          <RibbonButton title={t('ribbon.deleteColumn')} label={t('ribbon.deleteColumn')} icon={<Trash2 size={14} />} disabled={!api} onClick={() => commands?.current?.deleteTableColumn()} />
        </RibbonGroup>
      )}
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
      <RibbonGroup label={t('ribbon.tables')}>
        <RibbonButton
          large
          title={t('ribbon.tableHint')}
          label={t('ribbon.table')}
          icon={<TableIcon size={22} />}
          disabled={!ready}
          onClick={() => commands?.current?.addTable()}
        />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.illustrations')}>
        <RibbonButton title={t('ribbon.picture')} label={t('ribbon.picture')} icon={<ImageIcon size={16} />} disabled={!ready} onClick={() => commands?.current?.addImage()} />
        <RibbonButton title={t('ribbon.video')} label={t('ribbon.video')} icon={<Video size={16} />} disabled={!ready} onClick={() => commands?.current?.addVideo()} />
        <RibbonButton title={t('ribbon.rectangle')} label={t('ribbon.rectangle')} icon={<Square size={16} />} disabled={!ready} onClick={() => commands?.current?.addShape('rect')} />
        <RibbonButton title={t('ribbon.rounded')} label={t('ribbon.rounded')} icon={<Square size={16} />} disabled={!ready} onClick={() => commands?.current?.addShape('roundRect')} />
        <RibbonButton title={t('ribbon.oval')} label={t('ribbon.oval')} icon={<Circle size={16} />} disabled={!ready} onClick={() => commands?.current?.addShape('ellipse')} />
        <RibbonButton title={t('ribbon.triangle')} label={t('ribbon.triangle')} icon={<Triangle size={16} />} disabled={!ready} onClick={() => commands?.current?.addShape('triangle')} />
        <RibbonButton title={t('ribbon.line')} label={t('ribbon.line')} icon={<Minus size={16} />} disabled={!ready} onClick={() => commands?.current?.addShape('line')} />
      </RibbonGroup>
    </>,
  );
}

function SlideView({
  commands,
  state,
}: {
  commands?: React.RefObject<SlideEditorHandle | null>;
  state?: SlideCommandState;
}) {
  const api = commands?.current;
  return commandRow(
    <>
      <RibbonGroup label={t('ribbon.view')}>
        <RibbonButton
          large
          title={state?.viewMode === 'sorter' ? t('ribbon.normalView') : t('ribbon.slideSorter')}
          label={state?.viewMode === 'sorter' ? t('ribbon.normalView') : t('ribbon.slideSorter')}
          icon={<LayoutGrid size={22} />}
          pressed={state?.viewMode === 'sorter'}
          disabled={!api}
          onClick={() => commands?.current?.toggleViewMode?.()}
        />
        <RibbonButton
          title={t('ribbon.snapToGrid')}
          label={t('ribbon.snapToGrid')}
          icon={<Grid size={14} />}
          pressed={Boolean(state?.snapToGrid)}
          disabled={!api}
          onClick={() => commands?.current?.toggleSnapToGrid?.()}
        />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.palettes')}>
        <RibbonButton
          title={t('ribbon.palettePaper')}
          label={t('ribbon.palettePaper')}
          icon={<Palette size={14} />}
          disabled={!api}
          onClick={() => commands?.current?.applyPalette?.('paper')}
        />
        <RibbonButton
          title={t('ribbon.paletteInk')}
          label={t('ribbon.paletteInk')}
          icon={<Palette size={14} />}
          disabled={!api}
          onClick={() => commands?.current?.applyPalette?.('ink')}
        />
        <RibbonButton
          title={t('ribbon.paletteTeal')}
          label={t('ribbon.paletteTeal')}
          icon={<Palette size={14} />}
          disabled={!api}
          onClick={() => commands?.current?.applyPalette?.('teal')}
        />
      </RibbonGroup>
    </>,
  );
}
