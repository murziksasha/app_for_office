import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import { documentExtensions, defaultDocumentModel } from './model';
import { MarginRuler } from './MarginRuler';
import { formatMargin, mergePageSetup, mmToPx, PAGE_MM, pageSetupFromDoc, type PageSetup } from './pageSetup';
import { bandState } from './bandState';
import { X } from 'lucide-react';
import { i18n, t } from '../i18n/instance';
import { FindPanel } from '../shell/FindPanel';
import { ContextMenu, getContextMenuItems } from '../shell/ContextMenu';
import { MiniToolbar } from '../shell/MiniToolbar';
import {
  formatPainter,
  applyDocumentFormat,
} from '../shell/formatPainter';
import {
  findNextIndex,
  findPreviousIndex,
  findTextRanges,
  replaceAll,
  replaceOne,
  type TextRange,
} from './findText';
import { computeDocumentPagination, getPageAtPosition } from './pagination';
import { getHeadings, type HeadingItem } from './outline';
import { getSuggestions } from './spell/checker';
import { addUserWord } from './spell/userDictionary';

interface DocumentEditorProps {
  content: JSONContent;
  onChange: (doc: JSONContent) => void;
  zoom?: number;
  onEditorReady?: (editor: any) => void;
  onSaveShortcut?: () => void;
  findSignal?: number;
  onPageInfoChange?: (info: { page: number; totalPages: number }) => void;
  showOutline?: boolean;
  onToggleOutline?: () => void;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  content,
  onChange,
  zoom = 100,
  onEditorReady,
  onSaveShortcut,
  findSignal = 0,
  onPageInfoChange,
  showOutline = false,
  onToggleOutline,
}) => {
  const onPageInfoChangeRef = useRef(onPageInfoChange);
  onPageInfoChangeRef.current = onPageInfoChange;

  const updatePageInfo = (ed: any) => {
    if (!ed || !ed.view) return;
    try {
      const setup = pageSetupFromDoc(ed.getJSON());
      const { gapPositions, totalPages } = computeDocumentPagination(
        ed.state.doc,
        setup,
        (offset) => {
          const dom = ed.view.nodeDOM(offset);
          return dom instanceof HTMLElement ? dom.offsetHeight : 0;
        }
      );
      const page = getPageAtPosition(gapPositions, ed.state.selection.from);
      onPageInfoChangeRef.current?.({ page, totalPages });
    } catch {
      // safe fallback
    }
  };
  const [showFind, setShowFind] = useState(false);
  const [findFocus, setFindFocus] = useState<'find' | 'replace'>('find');
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [matchCase, setMatchCase] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const matchesRef = useRef<TextRange[]>([]);
  const [preview, setPreview] = useState<PageSetup | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; target: 'docText' | 'docTable'; spelling?: any } | null>(null);
  const [miniToolbarPos, setMiniToolbarPos] = useState<{ x: number; y: number } | null>(null);
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [footnotes, setFootnotes] = useState<Array<{ id: string; text: string }>>([]);

  const editor = useEditor({
    extensions: documentExtensions,
    content: content || defaultDocumentModel,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
      updatePageInfo(editor);
      setHeadings(getHeadings(editor.state.doc));
      setFootnotes(editor.state.doc.attrs.footnotes || []);
    },
    onSelectionUpdate: ({ editor }) => {
      bandState.setFocus(null);
      const painter = formatPainter.getState();
      if (painter.armed && painter.docPayload && !editor.state.selection.empty) {
        applyDocumentFormat(editor, painter.docPayload);
        formatPainter.didApply();
      }
      updatePageInfo(editor);
      if (editor.state.selection.empty) {
        setMiniToolbarPos(null);
      }
    },
  });

  useEffect(() => {
    if (editor) {
      bandState.setView(editor.view);
      if (onEditorReady) {
        onEditorReady(editor);
      }
      updatePageInfo(editor);
      setHeadings(getHeadings(editor.state.doc));
      setFootnotes(editor.state.doc.attrs.footnotes || []);
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
      setFootnotes(editor.state.doc.attrs.footnotes || []);
    }
  }, [content, editor]);

  const seenFindSignal = useRef(findSignal);
  useEffect(() => {
    if (findSignal !== seenFindSignal.current) {
      seenFindSignal.current = findSignal;
      setShowFind(true);
      setFindFocus('find');
    }
  }, [findSignal]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowFind(true);
        setFindFocus('find');
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setShowFind(true);
        setFindFocus('replace');
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSaveShortcut?.();
      }
      if (e.key === 'Escape') {
        if (showFind) setShowFind(false);
        setMiniToolbarPos(null);
        formatPainter.cancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFind, onSaveShortcut]);

  const selectMatch = (idx: number, ranges: TextRange[]) => {
    if (!editor || !ranges[idx]) return;
    const match = ranges[idx];
    editor.commands.setTextSelection({ from: match.from, to: match.to });
    editor.commands.scrollIntoView();
  };

  const handleFind = () => {
    if (!editor || !findText) {
      setMatchCount(0);
      setCurrentIndex(-1);
      matchesRef.current = [];
      return;
    }
    const ranges = findTextRanges(editor.state.doc, findText, { matchCase });
    matchesRef.current = ranges;
    setMatchCount(ranges.length);
    if (ranges.length > 0) {
      setCurrentIndex(0);
      selectMatch(0, ranges);
    } else {
      setCurrentIndex(-1);
    }
  };

  const handleFindNext = () => {
    if (!editor || !findText) return;
    const ranges = findTextRanges(editor.state.doc, findText, { matchCase });
    matchesRef.current = ranges;
    setMatchCount(ranges.length);
    if (ranges.length === 0) {
      setCurrentIndex(-1);
      return;
    }
    const nextIdx = findNextIndex(ranges.length, currentIndex);
    setCurrentIndex(nextIdx);
    selectMatch(nextIdx, ranges);
  };

  const handleFindPrevious = () => {
    if (!editor || !findText) return;
    const ranges = findTextRanges(editor.state.doc, findText, { matchCase });
    matchesRef.current = ranges;
    setMatchCount(ranges.length);
    if (ranges.length === 0) {
      setCurrentIndex(-1);
      return;
    }
    const prevIdx = findPreviousIndex(ranges.length, currentIndex);
    setCurrentIndex(prevIdx);
    selectMatch(prevIdx, ranges);
  };

  const handleReplaceOne = () => {
    if (!editor || !findText) return;
    const ranges = findTextRanges(editor.state.doc, findText, { matchCase });
    if (ranges.length === 0) return;
    const targetIdx = currentIndex >= 0 && currentIndex < ranges.length ? currentIndex : 0;
    replaceOne(editor, ranges[targetIdx], replaceText);
    const newRanges = findTextRanges(editor.state.doc, findText, { matchCase });
    matchesRef.current = newRanges;
    setMatchCount(newRanges.length);
    if (newRanges.length > 0) {
      const nextIdx = targetIdx % newRanges.length;
      setCurrentIndex(nextIdx);
      selectMatch(nextIdx, newRanges);
    } else {
      setCurrentIndex(-1);
    }
  };

  const handleReplaceAll = () => {
    if (!editor || !findText) return;
    replaceAll(editor, findText, replaceText, { matchCase });
    const newRanges = findTextRanges(editor.state.doc, findText, { matchCase });
    matchesRef.current = newRanges;
    setMatchCount(newRanges.length);
    setCurrentIndex(-1);
  };

  const committed = pageSetupFromDoc(content);
  const display = preview ?? committed;
  const basePage = PAGE_MM[display.size];
  const isLandscape = display.orientation === 'landscape';
  const page = isLandscape
    ? { width: basePage.height, height: basePage.width }
    : basePage;
  const pageW = mmToPx(page.width);
  const pageH = mmToPx(page.height);
  const scale = zoom / 100;
  const visualW = pageW * scale;
  const visualH = pageH * scale;
  const lang = i18n.language;
  const marginText = (mm: number) => `${formatMargin(mm, lang)} ${lang.toLowerCase().startsWith('uk') ? t('ribbon.unitCm') : t('ribbon.unitIn')}`;

  const commitSetup = (partial: Partial<PageSetup>) => {
    editor?.commands.setPageSetup(partial);
    setPreview(null);
  };

  return (
    <div
      className="folio-document-workspace"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {showOutline && (
        <aside
          className="folio-outline-pane"
          data-testid="outline-pane"
          style={{
            width: 240,
            flexShrink: 0,
            borderRight: '1px solid var(--folio-border)',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            zIndex: 5,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: '1px solid var(--folio-border-light)',
              fontWeight: 600,
              fontSize: 13,
              color: 'var(--folio-ink)',
            }}
          >
            <span>{t('document.headings')}</span>
            {onToggleOutline && (
              <button
                type="button"
                aria-label={t('settings.close')}
                onClick={onToggleOutline}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 2,
                  color: 'var(--folio-ink-muted)',
                  borderRadius: 4,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {headings.length === 0 ? (
              <div
                className="folio-outline-empty"
                style={{
                  padding: '16px 14px',
                  color: 'var(--folio-ink-muted)',
                  fontSize: 12,
                  fontStyle: 'italic',
                }}
              >
                {t('document.noHeadings')}
              </div>
            ) : (
              headings.map((item, idx) => (
                <button
                  key={`${item.pos}-${idx}`}
                  type="button"
                  className="folio-outline-item"
                  data-heading-level={item.level}
                  data-heading-pos={item.pos}
                  onClick={() => {
                    if (editor) {
                      const posInside = Math.min(item.pos + 1, editor.state.doc.content.size);
                      editor.chain().focus().setTextSelection(posInside).scrollIntoView().run();
                    }
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: '6px 14px',
                    paddingLeft: (item.level - 1) * 12 + 14,
                    fontSize: item.level === 1 ? 13 : item.level === 2 ? 12.5 : 12,
                    fontWeight: item.level === 1 ? 600 : item.level === 2 ? 500 : 400,
                    color: 'var(--folio-ink)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.text || `Heading ${item.level}`}
                </button>
              ))
            )}
          </div>
        </aside>
      )}

      <div
        className="folio-doc-viewport"
        onMouseUp={() => {
          setTimeout(() => {
            if (editor && !editor.state.selection.empty && !contextMenu) {
              try {
                const { from, to } = editor.state.selection;
                const start = editor.view.coordsAtPos(from);
                const end = editor.view.coordsAtPos(to);
                setMiniToolbarPos({
                  x: (start.left + end.right) / 2,
                  y: Math.min(start.top, end.top),
                });
              } catch {
                setMiniToolbarPos(null);
              }
            } else {
              setMiniToolbarPos(null);
            }
          }, 20);
        }}
        onScroll={() => {
          setMiniToolbarPos(null);
        }}
        onContextMenu={(e) => {
        setMiniToolbarPos(null);
        const target = e.target as HTMLElement;
        if (target.closest('.ProseMirror')) {
          e.preventDefault();
          const isTable = editor?.isActive?.('table') || Boolean(target.closest('table'));
          const misElem = target.closest('.folio-misspelling') as HTMLElement | null;
          let spelling: any = undefined;
          if (misElem && editor) {
            const word = misElem.getAttribute('data-misspelled-word') || misElem.textContent || '';
            const suggestions = getSuggestions(word, i18n.language);
            spelling = {
              word,
              suggestions,
              onSelect: (replacement: string) => {
                try {
                  const pos = editor.view.posAtDOM(misElem, 0);
                  if (pos != null) {
                    editor.chain().focus().setTextSelection({ from: pos, to: pos + word.length }).insertContent(replacement).run();
                  }
                } catch {
                  // fallback
                }
              },
              onAdd: (w: string) => {
                addUserWord(w);
              },
            };
          }
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            target: isTable ? 'docTable' : 'docText',
            spelling,
          });
        }
      }}
      style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: 'var(--folio-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '36px 16px',
        position: 'relative',
        ['--folio-page-break-label' as string]: `"${t('find.pageBreak')}"`,
      }}
    >
      {/* Find & Replace Floating Panel */}
      <FindPanel
        open={showFind}
        onClose={() => setShowFind(false)}
        initialFocus={findFocus}
        supportsReplace={true}
        findText={findText}
        setFindText={setFindText}
        replaceText={replaceText}
        setReplaceText={setReplaceText}
        matchCase={matchCase}
        setMatchCase={(mc) => {
          setMatchCase(mc);
          if (editor && findText) {
            const ranges = findTextRanges(editor.state.doc, findText, { matchCase: mc });
            matchesRef.current = ranges;
            setMatchCount(ranges.length);
            if (ranges.length > 0) {
              setCurrentIndex(0);
              selectMatch(0, ranges);
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
        onReplaceOne={handleReplaceOne}
        onReplaceAll={handleReplaceAll}
      />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          commandIds={getContextMenuItems(contextMenu.target)}
          context={{ kind: 'document', editor, spelling: contextMenu.spelling }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {miniToolbarPos && editor && !contextMenu && (
        <MiniToolbar
          editor={editor}
          position={miniToolbarPos}
          onClose={() => setMiniToolbarPos(null)}
        />
      )}

      <style>{`@page { size: ${display.size === 'a4' ? 'A4' : 'letter'} ${isLandscape ? 'landscape' : 'portrait'}; margin: ${display.marginTop}mm ${display.marginRight}mm ${display.marginBottom}mm ${display.marginLeft}mm; }`}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '0 auto 48px' }}>
        <div style={{ paddingTop: 30 }}>
          <MarginRuler
            axis="vertical"
            length={visualH}
            pageMm={page.height}
            startMm={display.marginTop}
            endMm={display.marginBottom}
            startLabel={t('ribbon.marginTop')}
            endLabel={t('ribbon.marginBottom')}
            startText={marginText(display.marginTop)}
            endText={marginText(display.marginBottom)}
            onPreview={(partial) => setPreview(mergePageSetup(committed, partial))}
            onCommit={commitSetup}
          />
        </div>
        <div style={{ width: visualW }}>
          <MarginRuler
            axis="horizontal"
            length={visualW}
            pageMm={page.width}
            startMm={display.marginLeft}
            endMm={display.marginRight}
            startLabel={t('ribbon.marginLeft')}
            endLabel={t('ribbon.marginRight')}
            startText={marginText(display.marginLeft)}
            endText={marginText(display.marginRight)}
            onPreview={(partial) => setPreview(mergePageSetup(committed, partial))}
            onCommit={commitSetup}
          />
          <div style={{ height: 8 }} />
          <div style={{ width: visualW, overflow: 'visible' }}>
            <div
              className="folio-paper-sheet"
              style={{
                width: pageW,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            >
              <div
                className="folio-prose"
                style={
                  {
                    ['--folio-margin-top' as string]: `${mmToPx(display.marginTop)}px`,
                    ['--folio-margin-right' as string]: `${mmToPx(display.marginRight)}px`,
                    ['--folio-margin-bottom' as string]: `${mmToPx(display.marginBottom)}px`,
                    ['--folio-margin-left' as string]: `${mmToPx(display.marginLeft)}px`,
                    ['--folio-page-height' as string]: `${pageH}px`,
                    ['--folio-column-count' as string]: `${display.columns || 1}`,
                  } as React.CSSProperties
                }
              >
                <EditorContent editor={editor} />
              </div>
              {footnotes.length > 0 && (
                <div
                  className="folio-footnotes-area"
                  style={{
                    padding: `16px ${mmToPx(display.marginRight)}px 24px ${mmToPx(display.marginLeft)}px`,
                    borderTop: '1px solid #d8d3c8',
                    marginTop: 16,
                    background: '#ffffff',
                    boxShadow: 'var(--folio-shadow-paper)',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--folio-ink-muted)', marginBottom: 8 }}>
                    {t('document.footnote')}
                  </div>
                  {footnotes.map((fn) => (
                    <div
                      key={fn.id}
                      className="folio-footnote-item"
                      style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: '12px' }}
                    >
                      <span style={{ fontWeight: 600, minWidth: 20, color: 'var(--folio-teal)' }}>{fn.id}.</span>
                      <input
                        type="text"
                        className="folio-footnote-input"
                        data-footnote-id={fn.id}
                        value={fn.text}
                        placeholder={t('document.footnotePlaceholder') || 'Footnote text...'}
                        onChange={(e) => {
                          const val = e.target.value;
                          (editor?.commands as any).updateFootnoteText(fn.id, val);
                          setFootnotes((prev) =>
                            prev.map((item) => (item.id === fn.id ? { ...item, text: val } : item))
                          );
                        }}
                        style={{
                          flex: 1,
                          border: 'none',
                          borderBottom: '1px solid #e0deda',
                          padding: '2px 4px',
                          fontSize: '12px',
                          background: 'transparent',
                          outline: 'none',
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .folio-prose .ProseMirror {
          position: relative;
          outline: none;
          min-height: var(--folio-page-height, 1056px);
          padding: var(--folio-margin-top, 96px) var(--folio-margin-right, 96px) var(--folio-margin-bottom, 96px) var(--folio-margin-left, 96px);
          background: #ffffff;
          box-shadow: var(--folio-shadow-paper);
          border: 1px solid var(--folio-border-light);
          box-sizing: border-box;
          color: var(--folio-ink);
          font-family: Georgia, 'Times New Roman', Cambria, serif;
          font-size: 11pt;
          line-height: 1.6;
          column-count: var(--folio-column-count, 1);
          column-gap: 24px;
        }
        .folio-header-top-band {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          padding-left: var(--folio-margin-left, 96px);
          padding-right: var(--folio-margin-right, 96px);
          box-sizing: border-box;
          pointer-events: auto;
          user-select: text;
          z-index: 2;
        }
        .folio-footer-bottom-band {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding-left: var(--folio-margin-left, 96px);
          padding-right: var(--folio-margin-right, 96px);
          box-sizing: border-box;
          pointer-events: auto;
          user-select: text;
          z-index: 2;
        }
        .folio-page-gap {
          margin-left: calc(-1 * var(--folio-margin-left, 96px));
          margin-right: calc(-1 * var(--folio-margin-right, 96px));
          user-select: none;
        }
        .folio-page-gap-end,
        .folio-page-gap-start {
          background: #ffffff;
          padding-left: var(--folio-margin-left, 96px);
          padding-right: var(--folio-margin-right, 96px);
          box-sizing: border-box;
          pointer-events: auto;
          user-select: text;
        }
        .folio-page-gap-desk {
          height: 28px;
          background: var(--folio-bg);
          pointer-events: none;
        }
        .folio-band-container {
          pointer-events: auto !important;
          user-select: text !important;
        }
        .folio-prose .ProseMirror p {
          margin-bottom: 0.8em;
        }
        .folio-prose .ProseMirror [data-style-name="Title"] {
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 26pt !important;
          font-weight: 700 !important;
          line-height: 1.2;
          margin-top: 0.8em;
          margin-bottom: 0.4em;
        }
        .folio-prose .ProseMirror blockquote {
          border-left: 3px solid var(--folio-teal);
          padding-left: 16px;
          margin-left: 0;
          margin-right: 0;
          color: var(--folio-ink-muted);
          font-style: italic;
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
          content: var(--folio-page-break-label, 'Page Break');
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
        .folio-misspelling {
          text-decoration: underline wavy #ef4444;
          text-decoration-skip-ink: none;
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
    </div>
  );
};

