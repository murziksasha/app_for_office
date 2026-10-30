import React, { useRef, useCallback, useEffect, memo } from 'react';
import { Workbook, WorkbookInstance } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { FortuneSheetData } from './adapters';

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
  const cellKeyRef = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    onWorkbookReady?.(workbookRef.current);
    return () => onWorkbookReady?.(null);
  }, [onWorkbookReady]);

  const handleChange = useCallback((data: any[]) => {
    // FortuneSheet echoes the workbook when the selection or its internal
    // cache changes. Publish only when cell values change, so opening a
    // sheet does not mark it dirty.
    const key = JSON.stringify(
      (data || []).map((sheet) => [sheet?.name, sheet?.id, sheet?.data, sheet?.celldata, sheet?.config?.merge]),
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
      />
    </div>
  );
});

