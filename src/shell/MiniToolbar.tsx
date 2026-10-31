import React, { useEffect, useRef } from 'react';
import {
  Bold,
  Italic,
  Underline,
  RemoveFormatting,
  Paintbrush,
  Highlighter,
} from 'lucide-react';
import { t } from '../i18n/instance';
import { clearFormatting } from '../document/clearFormatting';
import { formatPainter, captureDocumentFormat } from './formatPainter';

export interface MiniToolbarProps {
  editor: any;
  position: { x: number; y: number } | null;
  onClose: () => void;
}

const FONT_SIZES = ['9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '24pt'];

export const MiniToolbar: React.FC<MiniToolbarProps> = ({ editor, position, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!editor || !position) return null;

  const currentSize = editor.getAttributes('textStyle')?.fontSize || '11pt';
  const isBold = editor.isActive('bold');
  const isItalic = editor.isActive('italic');
  const isUnderline = editor.isActive('underline');
  const isHighlight = editor.isActive('highlight');

  // Clamp within viewport
  const left = Math.max(12, Math.min(window.innerWidth - 320, position.x - 140));
  const top = Math.max(48, position.y - 48);

  const buttonStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '26px',
    height: '26px',
    border: 'none',
    borderRadius: '3px',
    background: active ? 'var(--folio-teal-light)' : 'transparent',
    color: active ? 'var(--folio-teal)' : 'var(--folio-ink)',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.1s ease',
  });

  return (
    <div
      ref={ref}
      data-testid="mini-toolbar"
      className="folio-mini-toolbar"
      style={{
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: '3px 6px',
        backgroundColor: 'var(--folio-page)',
        border: '1px solid var(--folio-border)',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.08)',
        backdropFilter: 'blur(4px)',
        userSelect: 'none',
        animation: 'folioFadeIn 0.12s ease-out',
      }}
      onMouseDown={(e) => {
        // Prevent losing editor selection on button click
        e.preventDefault();
      }}
    >
      {/* Font Size */}
      <select
        value={FONT_SIZES.includes(currentSize) ? currentSize : '11pt'}
        onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
        style={{
          height: '24px',
          fontSize: '11px',
          border: '1px solid var(--folio-border)',
          borderRadius: '3px',
          padding: '0 4px',
          background: 'var(--folio-page)',
          color: 'var(--folio-ink)',
          cursor: 'pointer',
          marginRight: '2px',
        }}
        title={t('ribbon.fontSize')}
        aria-label={t('ribbon.fontSize')}
      >
        {FONT_SIZES.map((sz) => (
          <option key={sz} value={sz}>
            {sz.replace('pt', '')}
          </option>
        ))}
      </select>

      <div style={{ width: '1px', height: '16px', background: 'var(--folio-border)', margin: '0 2px' }} />

      {/* Bold */}
      <button
        type="button"
        data-testid="mini-toolbar-bold"
        style={buttonStyle(isBold)}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title={t('ribbon.bold')}
        aria-label={t('ribbon.bold')}
      >
        <Bold size={13} strokeWidth={isBold ? 3 : 2} />
      </button>

      {/* Italic */}
      <button
        type="button"
        style={buttonStyle(isItalic)}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title={t('ribbon.italic')}
        aria-label={t('ribbon.italic')}
      >
        <Italic size={13} />
      </button>

      {/* Underline */}
      <button
        type="button"
        style={buttonStyle(isUnderline)}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title={t('ribbon.underline')}
        aria-label={t('ribbon.underline')}
      >
        <Underline size={13} />
      </button>

      {/* Highlight */}
      <button
        type="button"
        style={buttonStyle(isHighlight)}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        title={t('ribbon.highlight')}
        aria-label={t('ribbon.highlight')}
      >
        <Highlighter size={13} />
      </button>

      <div style={{ width: '1px', height: '16px', background: 'var(--folio-border)', margin: '0 2px' }} />

      {/* Clear Formatting */}
      <button
        type="button"
        style={buttonStyle(false)}
        onClick={() => clearFormatting(editor)}
        title={t('ribbon.clearFormatting')}
        aria-label={t('ribbon.clearFormatting')}
      >
        <RemoveFormatting size={13} />
      </button>

      {/* Format Painter */}
      <button
        type="button"
        style={buttonStyle(formatPainter.getState().armed)}
        onClick={() => {
          const payload = captureDocumentFormat(editor);
          formatPainter.arm({ doc: payload });
        }}
        title={t('ribbon.formatPainter')}
        aria-label={t('ribbon.formatPainter')}
      >
        <Paintbrush size={13} />
      </button>
    </div>
  );
};

