import React, { useEffect, useRef, useState } from 'react';
import type { WorkbookInstance } from '@fortune-sheet/react';
import { DraftItem, EditorState, DocumentKind, RecentItem, SlideElement } from '../types';
import type { SlideCommandState, SlideEditorHandle } from '../slides/SlideEditor';
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
import { tabsFor, type RibbonTab } from './ribbon/tabs';
import { commandRow } from './ribbon/shared';
import { DocumentHome, DocumentInsert, DocumentReferences, DocumentLayout, DocumentView, TableTab, PictureTab } from './ribbon/documentRibbon';
import { SheetHome, SheetInsert, SheetLayout, SheetData, SheetView } from './ribbon/sheetRibbon';
import { SlideHome, SlideInsert, SlideDesign, SlideShowTab, SlideView } from './ribbon/slideRibbon';
import { RibbonButton, ribbonFieldStyle } from './ribbon/RibbonButton';
import { LanguageButton } from './LanguageButton';
import { i18n, t } from '../i18n/instance';
import { Backstage } from './Backstage';
import { LinkDialog } from './LinkDialog';
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
  SpellCheck,
} from 'lucide-react';

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
  const [linkOpen, setLinkOpen] = useState(false);
  const expandTimer = useRef<number | null>(null);

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

  const clearExpandTimer = () => {
    if (expandTimer.current !== null) {
      window.clearTimeout(expandTimer.current);
      expandTimer.current = null;
    }
  };

  const selectTab = (tab: RibbonTab) => {
    if (tab === 'file' && editorState.kind !== 'pdf') {
      clearExpandTimer();
      setActiveTab('file');
      return;
    }
    setActiveTab(tab);
    if (collapsed) {
      clearExpandTimer();
      expandTimer.current = window.setTimeout(() => setCollapsed(false), 220);
    }
  };

  const toggleRibbon = () => {
    clearExpandTimer();
    setCollapsed((value) => !value);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'F1') {
        e.preventDefault();
        toggleRibbon();
        return;
      }

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
            selectTab(tab as RibbonTab);
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
      <TitleBar {...props} onInsertLink={() => setLinkOpen(true)} />
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
            onDoubleClick={() => {
              if (tab !== 'file') toggleRibbon();
            }}
          />
        ))}
        <button
          type="button"
          aria-label={collapsed ? t('ribbon.expand') : t('ribbon.collapse')}
          onClick={toggleRibbon}
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
          backgroundColor: 'var(--folio-panel)',
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'auto',
        }}
      >
        {activeTab === 'file' && editorState.kind === 'pdf' && <FilePane {...props} />}
        {activeTab === 'home' && editorState.kind === 'document' && (
          <DocumentHome editor={props.documentEditor} onFind={props.onFind} keyTipMode={keyTipMode} />
        )}
        {activeTab === 'insert' && editorState.kind === 'document' && (
          <DocumentInsert editor={props.documentEditor} onInsertLink={() => setLinkOpen(true)} />
        )}
        {activeTab === 'references' && editorState.kind === 'document' && (
          <DocumentReferences editor={props.documentEditor} />
        )}
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
            editor={props.documentEditor}
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
        {activeTab === 'data' && editorState.kind === 'spreadsheet' && <SheetData api={props.sheetApi} />}
        {activeTab === 'view' && editorState.kind === 'spreadsheet' && <SheetView api={props.sheetApi} />}
        {activeTab === 'home' && editorState.kind === 'presentation' && (
          <SlideHome commands={props.slideCommands} state={props.slideState} />
        )}
        {activeTab === 'insert' && editorState.kind === 'presentation' && <SlideInsert commands={props.slideCommands} />}
        {activeTab === 'design' && editorState.kind === 'presentation' && (
          <SlideDesign commands={props.slideCommands} state={props.slideState} />
        )}
        {activeTab === 'slideshow' && editorState.kind === 'presentation' && (
          <SlideShowTab commands={props.slideCommands} onStartSlideshow={props.onStartSlideshow} />
        )}
        {activeTab === 'view' && editorState.kind === 'presentation' && (
          <SlideView commands={props.slideCommands} state={props.slideState} />
        )}
      </div>
      )}
      {linkOpen && editorState.kind === 'document' && (
        <LinkDialog
          initialUrl={props.documentEditor?.getAttributes?.('link')?.href || ''}
          onCancel={() => {
            setLinkOpen(false);
            props.documentEditor?.commands?.focus?.();
          }}
          onRemove={() => {
            props.documentEditor?.chain().focus().unsetLink().run();
            setLinkOpen(false);
          }}
          onApply={(url) => {
            if (!props.documentEditor) {
              setLinkOpen(false);
              return;
            }
            if (!url) props.documentEditor.chain().focus().unsetLink().run();
            else props.documentEditor.chain().focus().setLink({ href: url }).run();
            setLinkOpen(false);
          }}
        />
      )}
    </div>
  );
};

function tabLabel(tab: RibbonTab): string {
  if (tab === 'file') return t('ribbon.file');
  if (tab === 'home') return t('ribbon.home');
  if (tab === 'insert') return t('ribbon.insert');
  if (tab === 'layout') return t('ribbon.layout');
  if (tab === 'references') return t('ribbon.references');
  if (tab === 'data') return t('ribbon.data');
  if (tab === 'design') return t('ribbon.design');
  if (tab === 'slideshow') return t('ribbon.slideshow');
  if (tab === 'view') return t('ribbon.view');
  if (tab === 'table') return t('ribbon.table');
  if (tab === 'picture') return t('ribbon.picture');
  return tab;
}

function TabButton({
  tab,
  active,
  keyTip,
  onClick,
  onDoubleClick,
}: {
  tab: RibbonTab;
  active: boolean;
  keyTip?: string;
  onClick: () => void;
  onDoubleClick?: () => void;
}) {
  const label = tabLabel(tab);
  const file = tab === 'file';
  return (
    <button
      type="button"
      data-testid={`ribbon-tab-${tab}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={{
        position: 'relative',
        padding: '6px 12px',
        fontSize: 13,
        fontWeight: active || file ? 600 : 500,
        backgroundColor: file && active ? 'var(--folio-accent)' : active ? 'var(--folio-panel)' : 'transparent',
        color: file ? (active ? 'white' : 'var(--folio-teal)') : active ? 'var(--folio-ink)' : 'var(--folio-ink-muted)',
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        borderBottom: !file && active ? '2px solid var(--folio-accent)' : '2px solid transparent',
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

function TitleBar(props: RibbonProps & { onInsertLink: () => void }) {
  const { editorState, onOpenReport, onInsertLink } = props;
  return (
    <div className="folio-titlebar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--folio-accent)', flexShrink: 0 }}>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 3,
            backgroundColor: 'var(--folio-accent)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FileText size={12} />
        </div>
        <span>Folio</span>
      </div>
      <QuickAccess
        editorState={editorState}
        onSave={props.onSave}
        onPrint={props.onPrint}
        documentEditor={props.documentEditor}
        sheetApi={props.sheetApi}
        slideCommands={props.slideCommands}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ fontWeight: 600, color: 'var(--folio-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {editorState.fileName}
        </span>
        {editorState.isDirty && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: 10,
              backgroundColor: 'var(--folio-amber-light)',
              color: 'var(--folio-amber)',
              flexShrink: 0,
            }}
          >
            {t('ribbon.unsaved')}
          </span>
        )}
        {editorState.importReport && (
          <button
            type="button"
            onClick={onOpenReport}
            style={{ fontSize: 11, color: 'var(--folio-accent)', textDecoration: 'underline', padding: '0 4px', flexShrink: 0 }}
          >
            {t('ribbon.importNotices')}
          </button>
        )}
      </div>
      <CommandSearch
        kind={editorState.kind}
        context={{
          kind: editorState.kind,
          editor: props.documentEditor,
          api: props.sheetApi?.current,
          workbook: props.sheetApi?.current,
          slideHandle: props.slideCommands?.current,
          save: props.onSave,
          onSave: props.onSave,
          saveAs: props.onSaveAs,
          onSaveAs: props.onSaveAs,
          print: props.onPrint,
          onPrint: props.onPrint,
          onSavePdf: props.onSavePdf,
          insertLink: onInsertLink,
          undo: () => {
            if (editorState.kind === 'document') props.documentEditor?.chain().focus().undo().run();
            else if (editorState.kind === 'spreadsheet') (props.sheetApi?.current as { handleUndo?: () => void } | null)?.handleUndo?.();
            else props.slideCommands?.current?.undo?.();
          },
          redo: () => {
            if (editorState.kind === 'document') props.documentEditor?.chain().focus().redo().run();
            else if (editorState.kind === 'spreadsheet') (props.sheetApi?.current as { handleRedo?: () => void } | null)?.handleRedo?.();
          },
          startSlideshow: props.onStartSlideshow,
          toggleSnapToGrid: props.slideCommands?.current?.toggleSnapToGrid,
          alignSelected: props.slideCommands?.current?.alignSelected,
          distributeSelected: props.slideCommands?.current?.distributeSelected,
          bringForward: props.slideCommands?.current?.bringForward,
          sendBackward: props.slideCommands?.current?.sendBackward,
          applyPalette: props.slideCommands?.current?.applyPalette,
          toggleViewMode: props.slideCommands?.current?.toggleViewMode,
          toggleOutline: props.onToggleOutline,
        }}
      />
      <LanguageButton />
    </div>
  );
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

