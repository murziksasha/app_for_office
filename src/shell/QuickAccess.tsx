import React from 'react';
import { Save, Undo2, Redo2, Printer } from 'lucide-react';
import { t } from '../i18n/instance';
import type { EditorState } from '../types';
import type { SlideEditorHandle } from '../slides/SlideEditor';
import type { WorkbookInstance } from '@fortune-sheet/react';

export interface QuickAccessProps {
  editorState: EditorState;
  onSave: () => void;
  onPrint: () => void;
  documentEditor?: any;
  sheetApi?: React.RefObject<WorkbookInstance | null>;
  slideCommands?: React.RefObject<SlideEditorHandle | null>;
}

export const QuickAccess: React.FC<QuickAccessProps> = ({
  editorState,
  onSave,
  onPrint,
  documentEditor,
  sheetApi,
  slideCommands,
}) => {
  const handleUndo = () => {
    if (editorState.kind === 'document') {
      documentEditor?.chain?.().focus?.().undo?.().run?.();
    } else if (editorState.kind === 'spreadsheet') {
      (sheetApi?.current as any)?.undo?.();
    } else if (editorState.kind === 'presentation') {
      slideCommands?.current?.undo?.();
    }
  };

  const handleRedo = () => {
    if (editorState.kind === 'document') {
      documentEditor?.chain?.().focus?.().redo?.().run?.();
    } else if (editorState.kind === 'spreadsheet') {
      (sheetApi?.current as any)?.redo?.();
    }
  };

  return (
    <div
      className="folio-quick-access no-print"
      role="toolbar"
      aria-label="Quick Access Toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 12px',
        backgroundColor: 'var(--folio-ribbon-bg)',
        borderBottom: '1px solid var(--folio-border-light, #e2e8f0)',
        fontSize: '12px',
      }}
    >
      <button
        type="button"
        className="folio-qa-save"
        title={`${t('ribbon.save')} (Ctrl+S)`}
        aria-label={t('ribbon.save')}
        onClick={onSave}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 6px',
          borderRadius: '4px',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: 'var(--folio-ink)',
        }}
      >
        <Save size={14} />
      </button>

      <button
        type="button"
        className="folio-qa-undo"
        title={`${t('ribbon.undoShort')} (Ctrl+Z)`}
        aria-label={t('ribbon.undoShort')}
        onClick={handleUndo}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 6px',
          borderRadius: '4px',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: 'var(--folio-ink)',
        }}
      >
        <Undo2 size={14} />
      </button>

      <button
        type="button"
        className="folio-qa-redo"
        title={`${t('ribbon.redoShort')} (Ctrl+Y)`}
        aria-label={t('ribbon.redoShort')}
        onClick={handleRedo}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 6px',
          borderRadius: '4px',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: 'var(--folio-ink)',
        }}
      >
        <Redo2 size={14} />
      </button>

      <button
        type="button"
        className="folio-qa-print"
        title={`${t('ribbon.print')} (Ctrl+P)`}
        aria-label={t('ribbon.print')}
        onClick={onPrint}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 6px',
          borderRadius: '4px',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: 'var(--folio-ink)',
        }}
      >
        <Printer size={14} />
      </button>
    </div>
  );
};

