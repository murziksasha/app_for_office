import React, { useRef, useCallback, useEffect, useState, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Workbook, WorkbookInstance } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { FortuneSheetData } from './adapters';
import { FindPanel } from '../shell/FindPanel';
import { ContextMenu, getContextMenuItems } from '../shell/ContextMenu';
import { formatPainter, applySheetFormat } from '../shell/formatPainter';
import { findInSheetData, findNextIndex, findPreviousIndex, type SheetMatch } from './findSheet';
import { selectionStats, type SheetSelectionStats } from './sheetCommands';
import { SheetTabBar } from './SheetTabBar';
import { findValidationForCell, isValidationValueValid } from './dataValidation';

// FortuneSheet rebuilds its imperative API on every internal change, and the
// getters close over that render's context. A handle captured once keeps
// reading the sheet from when the editor opened.
function liveWorkbook(ref: React.RefObject<WorkbookInstance | null>): WorkbookInstance {
  return new Proxy({} as WorkbookInstance, {
    get(_target, prop) {
      const api = ref.current;
      if (!api) return undefined;
      const value = api[prop as keyof WorkbookInstance];
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(api) : value;
    },
  });
}

interface SpreadsheetEditorProps {
  sheets: FortuneSheetData[];
  onChange: (sheets: FortuneSheetData[]) => void;
  onSaveShortcut?: () => void;
  onWorkbookReady?: (api: WorkbookInstance | null) => void;
  findSignal?: number;
  onSelectionChange?: (stats: SheetSelectionStats | null) => void;
}

export const SpreadsheetEditor: React.FC<SpreadsheetEditorProps> = memo(({
  sheets,
  onChange,
  onSaveShortcut,
  onWorkbookReady,
  findSignal = 0,
  onSelectionChange,
}) => {
  const workbookRef = useRef<WorkbookInstance>(null);
  const liveRef = useRef<WorkbookInstance | null>(null);
  if (!liveRef.current) liveRef.current = liveWorkbook(workbookRef);
  const cellKeyRef = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  const [showFind, setShowFind] = useState(false);
  const [findText, setFindText] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const matchesRef = useRef<SheetMatch[]>([]);
  const seenFindSignal = useRef(findSignal);
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);
  const { t } = useTranslation();

  const activeSheet = sheets.find((s) => s.status === 1) || sheets[0];
  const activeValidation = focusedCell && activeSheet?.dataValidations
    ? findValidationForCell(focusedCell.row, focusedCell.col, activeSheet.dataValidations)
    : undefined;
  const currentCellVal = focusedCell
    ? (activeSheet?.data?.[focusedCell.row]?.[focusedCell.col]?.v ?? '')
    : '';
  const isCellInvalid = activeValidation && currentCellVal !== ''
    ? !isValidationValueValid(currentCellVal, activeValidation.list)
    : false;

  const handleSelectSheet = (id: string) => {
    if (liveRef.current?.activateSheet) {
      try {
        liveRef.current.activateSheet({ id });
        return;
      } catch {
        // safe fallback
      }
    }
    const next = sheets.map((s, idx) => ({
      ...s,
      status: s.id === id ? 1 : 0,
      order: idx,
    }));
    onChangeRef.current(next);
  };

  const handleRenameSheet = (id: string, newName: string) => {
    if (liveRef.current?.setSheetName) {
      try {
        liveRef.current.setSheetName(newName, { id });
        return;
      } catch {
        // safe fallback
      }
    }
    const next = sheets.map((s) => (s.id === id ? { ...s, name: newName } : s));
    onChangeRef.current(next);
  };

  const handleReorderSheets = (fromIndex: number, toIndex: number) => {
    const next = [...sheets];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    const orderMap: Record<string, number> = {};
    const ordered = next.map((s, idx) => {
      orderMap[s.id] = idx;
      return { ...s, order: idx };
    });
    if (liveRef.current?.setSheetOrder) {
      try {
        liveRef.current.setSheetOrder(orderMap);
        return;
      } catch {
        // safe fallback
      }
    }
    onChangeRef.current(ordered);
  };

  const handleSetSheetColor = (id: string, color?: string) => {
    const next = sheets.map((s) => (s.id === id ? { ...s, color } : s));
    onChangeRef.current(next);
  };

  const handleAddSheet = () => {
    if (liveRef.current?.addSheet) {
      try {
        liveRef.current.addSheet();
        return;
      } catch {
        // fallback
      }
    }
    const newSheet: FortuneSheetData = {
      name: `Sheet${sheets.length + 1}`,
      id: `sheet_${Date.now()}`,
      status: 1,
      order: sheets.length,
      row: 50,
      column: 26,
      data: Array.from({ length: 50 }, () => Array.from({ length: 26 }, () => null)),
    };
    const next = sheets.map((s) => ({ ...s, status: 0 })).concat(newSheet);
    onChangeRef.current(next);
  };

  useEffect(() => {
    if (findSignal !== seenFindSignal.current) {
      seenFindSignal.current = findSignal;
      setShowFind(true);
    }
  }, [findSignal]);

  useEffect(() => {
    const api = workbookRef.current;
    onWorkbookReady?.(liveRef.current);
    const uncached = sheets.some((sheet) =>
      (sheet.data || []).some((row) =>
        (row || []).some((cell) => Boolean(cell?.f) && (cell?.v == null || cell?.v === '')),
      ),
    );
    if (api && uncached) api.calculateFormula();
    return () => onWorkbookReady?.(null);
  }, [onWorkbookReady]);

  const handleChange = useCallback((data: any[]) => {
    // FortuneSheet echoes the workbook when the selection or its internal
    // cache changes. Publish only when cell values change, so opening a
    // sheet does not mark it dirty.
    const key = JSON.stringify(
      (data || []).map((sheet) => [
        sheet?.name,
        sheet?.id,
        sheet?.data,
        sheet?.celldata,
        sheet?.config,
        sheet?.frozen,
        sheet?.filter_select,
        sheet?.color,
        sheet?.conditionalFormats,
        sheet?.dataValidations,
        sheet?.printSetup,
      ]),
    );
    if (cellKeyRef.current === null || key === cellKeyRef.current) {
      cellKeyRef.current = key;
      return;
    }
    cellKeyRef.current = key;
    onChangeRef.current(data as FortuneSheetData[]);
  }, []);

  const getActiveSheetData = () => {
    const all = liveRef.current?.getAllSheets?.();
    if (all && all.length > 0) {
      const active = all.find((s: any) => s.status === 1) || all[0];
      return active?.data || [];
    }
    const active = sheets.find((s) => s.status === 1) || sheets[0];
    return active?.data || [];
  };

  const selectMatch = (idx: number, matches: SheetMatch[]) => {
    const match = matches[idx];
    if (!match || !liveRef.current) return;
    try {
      (liveRef.current as any).setCellSelection?.({
        row: [match.row, match.row],
        column: [match.col, match.col],
      });
      (liveRef.current as any).scroll?.({
        targetRow: match.row,
        targetColumn: match.col,
      });
    } catch {
      // safe fallback
    }
  };

  const handleFind = () => {
    if (!findText) {
      setMatchCount(0);
      setCurrentIndex(-1);
      matchesRef.current = [];
      return;
    }
    const data = getActiveSheetData();
    const matches = findInSheetData(data, findText, { matchCase });
    matchesRef.current = matches;
    setMatchCount(matches.length);
    if (matches.length > 0) {
      setCurrentIndex(0);
      selectMatch(0, matches);
    } else {
      setCurrentIndex(-1);
    }
  };

  const handleFindNext = () => {
    if (!findText) return;
    const data = getActiveSheetData();
    const matches = findInSheetData(data, findText, { matchCase });
    matchesRef.current = matches;
    setMatchCount(matches.length);
    if (matches.length === 0) {
      setCurrentIndex(-1);
      return;
    }
    const nextIdx = findNextIndex(matches.length, currentIndex);
    setCurrentIndex(nextIdx);
    selectMatch(nextIdx, matches);
  };

  const handleFindPrevious = () => {
    if (!findText) return;
    const data = getActiveSheetData();
    const matches = findInSheetData(data, findText, { matchCase });
    matchesRef.current = matches;
    setMatchCount(matches.length);
    if (matches.length === 0) {
      setCurrentIndex(-1);
      return;
    }
    const prevIdx = findPreviousIndex(matches.length, currentIndex);
    setCurrentIndex(prevIdx);
    selectMatch(prevIdx, matches);
  };

  const hooks = useMemo(
    () => ({
      afterSelectionChange: () => {
        if (liveRef.current) {
          const sel = liveRef.current.getSelection()?.[0];
          if (sel?.row?.length && sel.column?.length) {
            const r = Math.min(...sel.row);
            const c = Math.min(...sel.column);
            setFocusedCell((prev) => (prev?.row === r && prev?.col === c ? prev : { row: r, col: c }));
          }
          const stats = selectionStats(liveRef.current);
          onSelectionChangeRef.current?.(stats);
        }
      },
    }),
    [],
  );

  return (
    <div
      className="folio-spreadsheet-container"
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#ffffff',
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
          e.preventDefault();
          onSaveShortcut?.();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
          e.preventDefault();
          setShowFind(true);
        }
        if (e.key === 'Escape') {
          if (showFind) setShowFind(false);
          formatPainter.cancel();
        }
      }}
      onMouseUp={() => {
        const painter = formatPainter.getState();
        if (painter.armed && painter.sheetPayload && liveRef.current) {
          setTimeout(() => {
            if (liveRef.current) {
              applySheetFormat(liveRef.current, painter.sheetPayload!);
              formatPainter.didApply();
            }
          }, 30);
        }
        if (liveRef.current) {
          setTimeout(() => {
            if (liveRef.current) {
              const stats = selectionStats(liveRef.current);
              onSelectionChange?.(stats);
            }
          }, 40);
        }
      }}
    >
      <FindPanel
        open={showFind}
        onClose={() => setShowFind(false)}
        supportsReplace={false}
        findText={findText}
        setFindText={setFindText}
        matchCase={matchCase}
        setMatchCase={(mc) => {
          setMatchCase(mc);
          if (findText) {
            const data = getActiveSheetData();
            const matches = findInSheetData(data, findText, { matchCase: mc });
            matchesRef.current = matches;
            setMatchCount(matches.length);
            if (matches.length > 0) {
              setCurrentIndex(0);
              selectMatch(0, matches);
            } else {
              setCurrentIndex(-1);
            }
          }
        }}
        matchCount={matchCount}
        currentIndex={currentIndex}
        onFind={handleFind}
        onFindNext={handleFindNext}
        onFindPrevious={handleFindPrevious}
      />
      <Workbook
        ref={workbookRef}
        data={sheets}
        onChange={handleChange}
        showToolbar={false}
        showFormulaBar={true}
        showSheetTabs={true}
        forceCalculation={true}
        cellContextMenu={[]}
        headerContextMenu={[]}
        hooks={hooks}
      />
      {activeValidation && (
        <div
          data-testid="folio-validation-picker"
          style={{
            position: 'absolute',
            top: 6,
            right: 20,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#ffffff',
            padding: '2px 8px',
            borderRadius: 4,
            border: isCellInvalid ? '2px solid #f59e0b' : '1px solid var(--folio-border, #d1d5db)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          }}
        >
          <span style={{ fontSize: 11, color: isCellInvalid ? '#d97706' : 'var(--folio-ink-muted)' }}>
            {isCellInvalid ? 'Invalid Value' : (t('ribbon.dropdownList') || 'List')}:
          </span>
          <select
            data-testid="folio-validation-dropdown"
            aria-label="Select value"
            value={String(currentCellVal || '')}
            onChange={(e) => {
              const val = e.target.value;
              if (liveRef.current && focusedCell) {
                liveRef.current.setCellValue(focusedCell.row, focusedCell.col, val);
                const fxInput = document.getElementById('luckysheet-functionbox-cell');
                if (fxInput) fxInput.textContent = val;
              }
            }}
            style={{ fontSize: 12, padding: '2px 6px', borderRadius: 3, border: '1px solid #d1d5db' }}
          >
            <option value="">-- Select --</option>
            {activeValidation.list.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      )}
      <SheetTabBar
        sheets={sheets}
        onSelectSheet={handleSelectSheet}
        onRenameSheet={handleRenameSheet}
        onReorderSheets={handleReorderSheets}
        onSetSheetColor={handleSetSheetColor}
        onAddSheet={handleAddSheet}
      />
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          commandIds={getContextMenuItems('sheet')}
          context={{ kind: 'spreadsheet', api: liveRef.current }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
});

