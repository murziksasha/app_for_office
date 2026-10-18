import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import { documentExtensions, defaultDocumentModel } from './model';
import { Search, ChevronDown, ChevronUp, X, Replace } from 'lucide-react';

interface DocumentEditorProps {
  content: JSONContent;
  onChange: (doc: JSONContent) => void;
  pageSize?: 'letter' | 'a4';
  zoom?: number;
  onEditorReady?: (editor: any) => void;
  onSaveShortcut?: () => void;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  content,
  onChange,
  pageSize = 'letter',
  zoom = 100,
  onEditorReady,
  onSaveShortcut,
}) => {
  const [showFind, setShowFind] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCount, setMatchCount] = useState(0);

  const editor = useEditor({
    extensions: documentExtensions,
    content: content || defaultDocumentModel,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Update editor content if content prop changes from outside (e.g. file switched)
  const prevContentRef = useRef<JSONContent | null>(null);
  useEffect(() => {
    if (editor && content) {
      const currentJson = editor.getJSON();
      // Only setContent if different from internal editor content
      if (JSON.stringify(currentJson) !== JSON.stringify(content)) {
        editor.commands.setContent(content, { emitUpdate: false });
      }
      prevContentRef.current = content;
    }
  }, [content, editor]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowFind(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSaveShortcut?.();
      }
      if (e.key === 'Escape' && showFind) {
        setShowFind(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFind, onSaveShortcut]);

  // Find occurrences
  const handleFind = () => {
    if (!editor || !findText) {
      setMatchCount(0);
      return;
    }
    const text = editor.getText();
    const regex = new RegExp(findText, 'gi');
    const matches = text.match(regex);
    setMatchCount(matches ? matches.length : 0);
  };

  const handleReplace = () => {
    if (!editor || !findText) return;
    const currentHtml = editor.getHTML();
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    const newHtml = currentHtml.replace(regex, replaceText);
    editor.commands.setContent(newHtml);
    handleFind();
  };

  // Dimensions
  const pageWidth = pageSize === 'a4' ? '794px' : '816px';
  const minHeight = pageSize === 'a4' ? '1123px' : '1056px';

  return (
    <div
      className="folio-doc-viewport"
      style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: 'var(--folio-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '36px 16px',
        position: 'relative',
      }}
    >
      {/* Find & Replace Floating Panel */}
      {showFind && (
        <div
          className="folio-find-panel animate-fade-in"
          style={{
            position: 'fixed',
            top: '110px',
            right: '24px',
            zIndex: 100,
            background: 'var(--folio-panel)',
            padding: '12px 16px',
            borderRadius: 'var(--folio-radius-md)',
            boxShadow: 'var(--folio-shadow-md)',
            border: '1px solid var(--folio-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            width: '320px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--folio-ink)' }}>Find & Replace</span>
            <button onClick={() => setShowFind(false)} style={{ padding: '2px', color: 'var(--folio-ink-muted)' }}>
              <X size={14} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              placeholder="Find text..."
              value={findText}
              onChange={(e) => {
                setFindText(e.target.value);
              }}
              onKeyUp={(e) => e.key === 'Enter' && handleFind()}
              style={{
                flex: 1,
                padding: '4px 8px',
                border: '1px solid var(--folio-border)',
                borderRadius: '4px',
                outline: 'none',
              }}
            />
            <button
              onClick={handleFind}
              style={{
                padding: '4px 10px',
                background: 'var(--folio-teal)',
                color: 'white',
                borderRadius: '4px',
                fontWeight: 500,
              }}
            >
              Find
            </button>
          </div>
          {matchCount > 0 && (
            <div style={{ fontSize: '11px', color: 'var(--folio-ink-muted)' }}>Found {matchCount} matches</div>
          )}
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              placeholder="Replace with..."
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              style={{
                flex: 1,
                padding: '4px 8px',
                border: '1px solid var(--folio-border)',
                borderRadius: '4px',
                outline: 'none',
              }}
            />
            <button
              onClick={handleReplace}
              style={{
                padding: '4px 10px',
                background: 'var(--folio-bg-alt)',
                border: '1px solid var(--folio-border)',
                borderRadius: '4px',
                fontWeight: 500,
              }}
            >
              Replace
            </button>
          </div>
        </div>
      )}

      {/* Paper Sheet */}
      <div
        className="folio-paper-sheet"
        style={{
          width: pageWidth,
          minHeight,
          background: '#ffffff',
          boxShadow: 'var(--folio-shadow-paper)',
          borderRadius: '2px',
          border: '1px solid var(--folio-border-light)',
          padding: '64px 72px',
          transform: `scale(${zoom / 100})`,
          transformOrigin: 'top center',
          transition: 'transform 0.1s ease',
          marginBottom: '60px',
        }}
      >
        <EditorContent editor={editor} className="folio-prose" />
      </div>

      <style>{`
        .folio-prose .ProseMirror {
          outline: none;
          min-height: 800px;
          color: var(--folio-ink);
          font-family: Georgia, 'Times New Roman', Cambria, serif;
          font-size: 11pt;
          line-height: 1.6;
        }
        .folio-prose .ProseMirror p {
          margin-bottom: 0.8em;
        }
        .folio-prose .ProseMirror h1 {
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 24pt;
          font-weight: 700;
          color: var(--folio-ink);
          margin-top: 1em;
          margin-bottom: 0.4em;
        }
        .folio-prose .ProseMirror h2 {
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 18pt;
          font-weight: 600;
          color: var(--folio-ink);
          margin-top: 0.9em;
          margin-bottom: 0.3em;
        }
        .folio-prose .ProseMirror h3 {
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 14pt;
          font-weight: 600;
          color: var(--folio-ink);
          margin-top: 0.8em;
          margin-bottom: 0.3em;
        }
        .folio-prose .ProseMirror ul,
        .folio-prose .ProseMirror ol {
          padding-left: 28px;
          margin-bottom: 0.8em;
        }
        .folio-prose .ProseMirror li {
          margin-bottom: 0.2em;
        }
        .folio-prose .ProseMirror table {
          border-collapse: collapse;
          width: 100%;
          margin: 1.2em 0;
          table-layout: fixed;
        }
        .folio-prose .ProseMirror th,
        .folio-prose .ProseMirror td {
          border: 1px solid var(--folio-border);
          padding: 8px 12px;
          vertical-align: top;
          position: relative;
        }
        .folio-prose .ProseMirror th {
          background-color: var(--folio-bg);
          font-weight: 600;
        }
        .folio-prose .ProseMirror hr {
          border: none;
          border-top: 1px solid var(--folio-border);
          margin: 1.5em 0;
        }
        .folio-prose .ProseMirror blockquote {
          border-left: 3px solid var(--folio-teal);
          padding-left: 14px;
          color: var(--folio-ink-muted);
          margin: 1em 0;
        }
        .folio-prose .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 2px;
          margin: 8px 0;
        }
        .folio-link {
          color: var(--folio-teal);
          text-decoration: underline;
          cursor: pointer;
        }
        .folio-page-break {
          break-after: page;
          page-break-after: always;
          height: 1px;
          border-top: 1px dashed var(--folio-teal);
          margin: 24px 0;
          position: relative;
        }
        .folio-page-break::after {
          content: 'Page Break';
          position: absolute;
          top: -9px;
          right: 12px;
          font-size: 10px;
          font-weight: 600;
          color: var(--folio-teal);
          background: #ffffff;
          padding: 0 4px;
        }
        @media print {
          .folio-page-break {
            border-top: none;
            margin: 0;
            height: 0;
          }
          .folio-page-break::after {
            display: none;
          }
        }
        .folio-prose .ProseMirror p.is-editor-empty:first-child::before {
          color: var(--folio-ink-faint);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
};

