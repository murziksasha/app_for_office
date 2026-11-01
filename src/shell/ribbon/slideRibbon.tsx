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
import { canonicalFamilyName, DEFAULT_PRESENTATION_FONT } from '../../fonts/names';
const SLIDE_FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 44, 54, 72];

function slideText(state?: SlideCommandState) {
  const element = state?.element;
  if (!element) return null;
  if (element.type === 'text' || element.type === 'table') return element;
  if (element.type === 'rect') return element;
  return null;
}

export function SlideHome({
  commands,
  state,
}: {
  commands?: React.RefObject<SlideEditorHandle | null>;
  state?: SlideCommandState;
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
        <RibbonButton title={t('ribbon.duplicateSlide')} label={t('ribbon.duplicate')} icon={<Copy size={14} />} disabled={!api} onClick={() => commands?.current?.duplicateSlide()} />
        <RibbonButton title={t('ribbon.deleteSlide')} label={t('ribbon.delete')} icon={<Trash2 size={14} />} disabled={!api || count <= 1} onClick={() => commands?.current?.deleteSlide()} />
        <RibbonButton title={t('ribbon.moveEarlier')} icon={<ChevronUp size={16} />} disabled={!api || index <= 0} onClick={() => commands?.current?.moveSlide('up')} />
        <RibbonButton title={t('ribbon.moveLater')} icon={<ChevronDown size={16} />} disabled={!api || index >= count - 1} onClick={() => commands?.current?.moveSlide('down')} />
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.font')}>
        <FontPicker
          value={canonicalFamilyName(text?.fontFamily) || DEFAULT_PRESENTATION_FONT}
          disabled={!text}
          onChange={(family) => patch({ fontFamily: family })}
        />
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

export function SlideDesign({
  commands,
  state,
}: {
  commands?: React.RefObject<SlideEditorHandle | null>;
  state?: SlideCommandState;
}) {
  const api = commands?.current;
  return commandRow(
    <>
      <RibbonGroup label={t('ribbon.slides')}>
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
      </RibbonGroup>
      <RibbonGroup label={t('ribbon.palettes')}>
        <RibbonButton title={t('ribbon.palettePaper')} label={t('ribbon.palettePaper')} icon={<Palette size={14} />} disabled={!api} onClick={() => commands?.current?.applyPalette?.('paper')} />
        <RibbonButton title={t('ribbon.paletteInk')} label={t('ribbon.paletteInk')} icon={<Palette size={14} />} disabled={!api} onClick={() => commands?.current?.applyPalette?.('ink')} />
        <RibbonButton title={t('ribbon.paletteTeal')} label={t('ribbon.paletteTeal')} icon={<Palette size={14} />} disabled={!api} onClick={() => commands?.current?.applyPalette?.('teal')} />
      </RibbonGroup>
    </>,
  );
}

export function SlideShowTab({
  commands,
  onStartSlideshow,
}: {
  commands?: React.RefObject<SlideEditorHandle | null>;
  onStartSlideshow?: (mode: 'beginning' | 'current') => void;
}) {
  const api = commands?.current;
  return commandRow(
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
    </RibbonGroup>,
  );
}

export function SlideInsert({ commands }: { commands?: React.RefObject<SlideEditorHandle | null> }) {
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

export function SlideView({
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
    </>,
  );
}

