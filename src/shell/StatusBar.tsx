import React from 'react';
import { EditorState } from '../types';
import { ZoomIn, ZoomOut, Check, HardDrive, AlertCircle } from 'lucide-react';

interface StatusBarProps {
  editorState: EditorState;
  documentEditor?: any;
  pageSize: 'letter' | 'a4';
  zoom: number;
  onZoomChange: (newZoom: number) => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  editorState,
  documentEditor,
  pageSize,
  zoom,
  onZoomChange,
}) => {
  const isDoc = editorState.kind === 'document';
  const wordCount = documentEditor?.storage?.characterCount?.words?.() ?? 0;
  const charCount = documentEditor?.storage?.characterCount?.characters?.() ?? 0;

  return (
    <footer
      className="folio-status-bar no-print"
      style={{
        height: '28px',
        backgroundColor: 'var(--folio-ribbon-bg)',
        borderTop: '1px solid var(--folio-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        fontSize: '11px',
        color: 'var(--folio-ink-muted)',
        userSelect: 'none',
      }}
    >
      {/* Left items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <HardDrive size={13} color="var(--folio-teal)" />
          <span>Local storage</span>
        </div>

        {isDoc && (
          <>
            <span>
              {wordCount} {wordCount === 1 ? 'word' : 'words'} · {charCount} characters
            </span>
            <span>Page: {pageSize.toUpperCase()}</span>
          </>
        )}

        {editorState.kind === 'spreadsheet' && (
          <span>Spreadsheet · {editorState.spreadsheetData?.length || 1} sheet(s)</span>
        )}

        {editorState.kind === 'presentation' && (
          <span>Presentation · {editorState.presentationData?.slides?.length || 1} slide(s)</span>
        )}
      </div>

      {/* Right items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Save status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {editorState.isDirty ? (
            <>
              <AlertCircle size={13} color="var(--folio-amber)" />
              <span style={{ color: 'var(--folio-amber)' }}>Unsaved changes</span>
            </>
          ) : (
            <>
              <Check size={13} color="var(--folio-teal)" />
              <span style={{ color: 'var(--folio-teal)' }}>Saved</span>
            </>
          )}
        </div>

        {/* Zoom controls */}
        {isDoc && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => onZoomChange(Math.max(50, zoom - 10))}
              style={{ padding: '2px', color: 'inherit' }}
              title="Zoom out"
            >
              <ZoomOut size={12} />
            </button>
            <input
              type="range"
              min="50"
              max="200"
              step="5"
              value={zoom}
              onChange={(e) => onZoomChange(parseInt(e.target.value, 10))}
              style={{
                width: '70px',
                accentColor: 'var(--folio-teal)',
                cursor: 'pointer',
              }}
            />
            <button
              onClick={() => onZoomChange(Math.min(200, zoom + 10))}
              style={{ padding: '2px', color: 'inherit' }}
              title="Zoom in"
            >
              <ZoomIn size={12} />
            </button>
            <span style={{ minWidth: '32px', textAlign: 'right' }}>{zoom}%</span>
          </div>
        )}
      </div>
    </footer>
  );
};

