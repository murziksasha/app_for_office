import React, { useRef, useCallback, useEffect, memo } from 'react';
import { Workbook, WorkbookInstance } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { FortuneSheetData } from './adapters';

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
}

export const SpreadsheetEditor: React.FC<SpreadsheetEditorProps> = memo(({
  sheets,
  onChange,
  onSaveShortcut,
  onWorkbookReady,
}) => {
  const workbookRef = useRef<WorkbookInstance>(null);
  const liveRef = useRef<WorkbookInstance | null>(null);
  if (!liveRef.current) liveRef.current = liveWorkbook(workbookRef);
  const cellKeyRef = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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
      ]),
    );
    if (cellKeyRef.current === null || key === cellKeyRef.current) {
      cellKeyRef.current = key;
      return;
    }
    cellKeyRef.current = key;
    onChangeRef.current(data as FortuneSheetData[]);
  }, []);

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
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
          e.preventDefault();
          onSaveShortcut?.();
        }
      }}
    >
      <Workbook
        ref={workbookRef}
        data={sheets}
        onChange={handleChange}
        showToolbar={false}
        showFormulaBar={true}
        showSheetTabs={true}
        forceCalculation={true}
      />
    </div>
  );
});

