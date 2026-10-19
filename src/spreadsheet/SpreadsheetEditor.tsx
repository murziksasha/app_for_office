import React, { useRef, useCallback } from 'react';
import { Workbook, WorkbookInstance } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { FortuneSheetData } from './adapters';

interface SpreadsheetEditorProps {
  sheets: FortuneSheetData[];
  onChange: (sheets: FortuneSheetData[]) => void;
  onSaveShortcut?: () => void;
}

export const SpreadsheetEditor: React.FC<SpreadsheetEditorProps> = ({
  sheets,
  onChange,
  onSaveShortcut,
}) => {
  const workbookRef = useRef<WorkbookInstance>(null);

  const handleChange = useCallback(
    (data: any[]) => {
      onChange(data as FortuneSheetData[]);
    },
    [onChange]
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
        showToolbar={true}
        showFormulaBar={true}
        showSheetTabs={true}
      />
    </div>
  );
};

