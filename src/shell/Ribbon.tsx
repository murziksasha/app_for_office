import React, { useState } from 'react';
import { EditorState, DocumentKind, SupportedFormat } from '../types';
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
  Palette,
} from 'lucide-react';

interface RibbonProps {
  editorState: EditorState;
  documentEditor: any; // Tiptap editor instance
  pageSize: 'letter' | 'a4';
  onPageSizeChange: (size: 'letter' | 'a4') => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onPrint: () => void;
  onCloseFile: () => void;
  onNew: (kind: DocumentKind) => void;
  onOpen: () => void;
  onOpenReport?: () => void;
}

export const Ribbon: React.FC<RibbonProps> = ({
  editorState,
  documentEditor,
  pageSize,
  onPageSizeChange,
  zoom,
  onZoomChange,
  onSave,
  onSaveAs,
  onPrint,
  onCloseFile,
  onNew,
  onOpen,
  onOpenReport,
}) => {
  const [activeTab, setActiveTab] = useState<'home' | 'insert' | 'layout' | 'file'>('home');

  const isDoc = editorState.kind === 'document';

  const insertImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && documentEditor) {
        const reader = new FileReader();
        reader.onload = (re) => {
          const src = re.target?.result as string;
          documentEditor.chain().focus().setImage({ src }).run();
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const insertLink = () => {
    if (!documentEditor) return;
    const previousUrl = documentEditor.getAttributes('link').href;
    const url = window.prompt('Enter link URL', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      documentEditor.chain().focus().unsetLink().run();
      return;
    }
    documentEditor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div
      className="folio-ribbon no-print"
      style={{
        backgroundColor: 'var(--folio-ribbon-bg)',
        borderBottom: '1px solid var(--folio-ribbon-border)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      {/* Top Application Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 16px',
          borderBottom: '1px solid var(--folio-border-light)',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Logo */}
          <div
            onClick={onCloseFile}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontWeight: 700,
              color: 'var(--folio-teal)',
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                backgroundColor: 'var(--folio-teal)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={13} />
            </div>
            <span>Folio</span>
          </div>

          <span style={{ color: 'var(--folio-border)' }}>|</span>

          {/* Document Title & State */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, color: 'var(--folio-ink)' }}>{editorState.fileName}</span>
            {editorState.isDirty && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--folio-amber-light)',
                  color: 'var(--folio-amber)',
                }}
              >
                Unsaved changes
              </span>
            )}
            {editorState.importReport && (
              <button
                onClick={onOpenReport}
                style={{
                  fontSize: '11px',
                  color: 'var(--folio-teal)',
                  textDecoration: 'underline',
                  padding: '0 4px',
                }}
              >
                Import notices
              </button>
            )}
          </div>
        </div>

        {/* Quick Actions Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={onSave}
            title="Save (Ctrl+S)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '4px',
              backgroundColor: editorState.isDirty ? 'var(--folio-teal)' : 'var(--folio-bg)',
              color: editorState.isDirty ? 'white' : 'var(--folio-ink)',
              fontWeight: 500,
            }}
          >
            <Save size={14} /> Save
          </button>
          <button
            onClick={onSaveAs}
            title="Save As..."
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              color: 'var(--folio-ink-muted)',
            }}
          >
            <SaveAll size={14} />
          </button>
          <button
            onClick={onPrint}
            title="Print Document"
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              color: 'var(--folio-ink-muted)',
            }}
          >
            <Printer size={14} />
          </button>
          <button
            onClick={onCloseFile}
            title="Close File"
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              color: 'var(--folio-ink-muted)',
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Ribbon Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '2px',
          padding: '0 12px',
          borderBottom: '1px solid var(--folio-border)',
        }}
      >
        <button
          onClick={() => setActiveTab('file')}
          style={{
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: activeTab === 'file' ? 'var(--folio-teal)' : 'transparent',
            color: activeTab === 'file' ? 'white' : 'var(--folio-teal)',
            borderTopLeftRadius: '4px',
            borderTopRightRadius: '4px',
            transition: 'background-color 0.1s ease',
          }}
        >
          File
        </button>
        <button
          onClick={() => setActiveTab('home')}
          style={{
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: activeTab === 'home' ? 600 : 500,
            color: activeTab === 'home' ? 'var(--folio-ink)' : 'var(--folio-ink-muted)',
            borderBottom: activeTab === 'home' ? '2px solid var(--folio-teal)' : 'none',
            backgroundColor: activeTab === 'home' ? '#ffffff' : 'transparent',
          }}
        >
          Home
        </button>
        <button
          onClick={() => setActiveTab('insert')}
          style={{
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: activeTab === 'insert' ? 600 : 500,
            color: activeTab === 'insert' ? 'var(--folio-ink)' : 'var(--folio-ink-muted)',
            borderBottom: activeTab === 'insert' ? '2px solid var(--folio-teal)' : 'none',
            backgroundColor: activeTab === 'insert' ? '#ffffff' : 'transparent',
          }}
        >
          Insert
        </button>
        <button
          onClick={() => setActiveTab('layout')}
          style={{
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: activeTab === 'layout' ? 600 : 500,
            color: activeTab === 'layout' ? 'var(--folio-ink)' : 'var(--folio-ink-muted)',
            borderBottom: activeTab === 'layout' ? '2px solid var(--folio-teal)' : 'none',
            backgroundColor: activeTab === 'layout' ? '#ffffff' : 'transparent',
          }}
        >
          Page & View
        </button>
      </div>

      {/* Ribbon Command Strip */}
      <div
        style={{
          minHeight: '44px',
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          padding: '6px 14px',
          gap: '12px',
          overflowX: 'auto',
        }}
      >
        {/* FILE TAB */}
        {activeTab === 'file' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onNew('document')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '4px',
                backgroundColor: 'var(--folio-bg)',
              }}
            >
              <FilePlus size={14} /> New Document
            </button>
            <button
              onClick={() => onNew('spreadsheet')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '4px',
                backgroundColor: 'var(--folio-bg)',
              }}
            >
              <TableIcon size={14} /> New Spreadsheet
            </button>
            <button
              onClick={onOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '4px',
                backgroundColor: 'var(--folio-bg)',
              }}
            >
              <FolderOpen size={14} /> Open File...
            </button>
            <button
              onClick={onSave}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '4px',
                backgroundColor: 'var(--folio-bg)',
              }}
            >
              <Save size={14} /> Save
            </button>
            <button
              onClick={onSaveAs}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '4px',
                backgroundColor: 'var(--folio-bg)',
              }}
            >
              <SaveAll size={14} /> Save As...
            </button>
            <button
              onClick={onPrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '4px',
                backgroundColor: 'var(--folio-bg)',
              }}
            >
              <Printer size={14} /> Print
            </button>
          </div>
        )}

        {/* HOME TAB (Rich text when Document is active) */}
        {activeTab === 'home' && isDoc && documentEditor && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* History */}
            <button
              onClick={() => documentEditor.chain().focus().undo().run()}
              disabled={!documentEditor.can().undo()}
              title="Undo (Ctrl+Z)"
              style={{ padding: '4px', borderRadius: '4px', opacity: documentEditor.can().undo() ? 1 : 0.3 }}
            >
              <Undo2 size={16} />
            </button>
            <button
              onClick={() => documentEditor.chain().focus().redo().run()}
              disabled={!documentEditor.can().redo()}
              title="Redo (Ctrl+Y)"
              style={{ padding: '4px', borderRadius: '4px', opacity: documentEditor.can().redo() ? 1 : 0.3 }}
            >
              <Redo2 size={16} />
            </button>

            <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--folio-border)' }} />

            {/* Paragraph / Heading selector */}
            <select
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'p') documentEditor.chain().focus().setParagraph().run();
                else if (val.startsWith('h')) {
                  const level = parseInt(val.replace('h', ''), 10) as any;
                  documentEditor.chain().focus().setHeading({ level }).run();
                }
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid var(--folio-border)',
                outline: 'none',
              }}
            >
              <option value="p">Paragraph</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
            </select>

            {/* Font family */}
            <select
              onChange={(e) => {
                documentEditor.chain().focus().setFontFamily(e.target.value).run();
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid var(--folio-border)',
                outline: 'none',
              }}
            >
              <option value="Georgia, serif">Georgia (Serif)</option>
              <option value="system-ui, sans-serif">Segoe UI (Sans)</option>
              <option value="'Courier New', monospace">Courier (Mono)</option>
            </select>

            <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--folio-border)' }} />

            {/* Formatting marks */}
            <button
              onClick={() => documentEditor.chain().focus().toggleBold().run()}
              title="Bold (Ctrl+B)"
              style={{
                padding: '4px',
                borderRadius: '4px',
                backgroundColor: documentEditor.isActive('bold') ? 'var(--folio-teal-light)' : 'transparent',
              }}
            >
              <Bold size={16} />
            </button>
            <button
              onClick={() => documentEditor.chain().focus().toggleItalic().run()}
              title="Italic (Ctrl+I)"
              style={{
                padding: '4px',
                borderRadius: '4px',
                backgroundColor: documentEditor.isActive('italic') ? 'var(--folio-teal-light)' : 'transparent',
              }}
            >
              <Italic size={16} />
            </button>
            <button
              onClick={() => documentEditor.chain().focus().toggleUnderline().run()}
              title="Underline (Ctrl+U)"
              style={{
                padding: '4px',
                borderRadius: '4px',
                backgroundColor: documentEditor.isActive('underline') ? 'var(--folio-teal-light)' : 'transparent',
              }}
            >
              <Underline size={16} />
            </button>
            <button
              onClick={() => documentEditor.chain().focus().toggleStrike().run()}
              title="Strikethrough"
              style={{
                padding: '4px',
                borderRadius: '4px',
                backgroundColor: documentEditor.isActive('strike') ? 'var(--folio-teal-light)' : 'transparent',
              }}
            >
              <Strikethrough size={16} />
            </button>

            {/* Color picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <input
                type="color"
                title="Text Color"
                onChange={(e) => documentEditor.chain().focus().setColor(e.target.value).run()}
                style={{
                  width: '24px',
                  height: '24px',
                  padding: 0,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                }}
              />
            </div>

            {/* Highlight */}
            <button
              onClick={() => documentEditor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
              title="Highlight Yellow"
              style={{
                padding: '4px',
                borderRadius: '4px',
                backgroundColor: documentEditor.isActive('highlight') ? 'var(--folio-teal-light)' : 'transparent',
              }}
            >
              <Highlighter size={16} />
            </button>

            <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--folio-border)' }} />

            {/* Alignment */}
            <button
              onClick={() => documentEditor.chain().focus().setTextAlign('left').run()}
              title="Align Left"
              style={{
                padding: '4px',
                borderRadius: '4px',
                backgroundColor: documentEditor.isActive({ textAlign: 'left' }) ? 'var(--folio-teal-light)' : 'transparent',
              }}
            >
              <AlignLeft size={16} />
            </button>
            <button
              onClick={() => documentEditor.chain().focus().setTextAlign('center').run()}
              title="Align Center"
              style={{
                padding: '4px',
                borderRadius: '4px',
                backgroundColor: documentEditor.isActive({ textAlign: 'center' }) ? 'var(--folio-teal-light)' : 'transparent',
              }}
            >
              <AlignCenter size={16} />
            </button>
            <button
              onClick={() => documentEditor.chain().focus().setTextAlign('right').run()}
              title="Align Right"
              style={{
                padding: '4px',
                borderRadius: '4px',
                backgroundColor: documentEditor.isActive({ textAlign: 'right' }) ? 'var(--folio-teal-light)' : 'transparent',
              }}
            >
              <AlignRight size={16} />
            </button>
            <button
              onClick={() => documentEditor.chain().focus().setTextAlign('justify').run()}
              title="Align Justify"
              style={{
                padding: '4px',
                borderRadius: '4px',
                backgroundColor: documentEditor.isActive({ textAlign: 'justify' }) ? 'var(--folio-teal-light)' : 'transparent',
              }}
            >
              <AlignJustify size={16} />
            </button>

            <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--folio-border)' }} />

            {/* Lists */}
            <button
              onClick={() => documentEditor.chain().focus().toggleBulletList().run()}
              title="Bullet List"
              style={{
                padding: '4px',
                borderRadius: '4px',
                backgroundColor: documentEditor.isActive('bulletList') ? 'var(--folio-teal-light)' : 'transparent',
              }}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => documentEditor.chain().focus().toggleOrderedList().run()}
              title="Numbered List"
              style={{
                padding: '4px',
                borderRadius: '4px',
                backgroundColor: documentEditor.isActive('orderedList') ? 'var(--folio-teal-light)' : 'transparent',
              }}
            >
              <ListOrdered size={16} />
            </button>
          </div>
        )}

        {/* HOME TAB (When Spreadsheet or Presentation active) */}
        {activeTab === 'home' && !isDoc && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--folio-ink-muted)' }}>
            <span>Tools are available directly in the {editorState.kind} workspace below.</span>
          </div>
        )}

        {/* INSERT TAB */}
        {activeTab === 'insert' && isDoc && documentEditor && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() =>
                documentEditor
                  .chain()
                  .focus()
                  .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                  .run()
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '4px',
                backgroundColor: 'var(--folio-bg)',
              }}
            >
              <TableIcon size={16} /> Table (3x3)
            </button>

            {documentEditor.isActive('table') && (
              <>
                <button
                  onClick={() => documentEditor.chain().focus().addRowAfter().run()}
                  style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--folio-bg)' }}
                >
                  + Row
                </button>
                <button
                  onClick={() => documentEditor.chain().focus().addColumnAfter().run()}
                  style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--folio-bg)' }}
                >
                  + Column
                </button>
                <button
                  onClick={() => documentEditor.chain().focus().deleteTable().run()}
                  style={{ padding: '4px 8px', borderRadius: '4px', color: '#dc2626' }}
                >
                  Delete Table
                </button>
              </>
            )}

            <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--folio-border)' }} />

            <button
              onClick={insertImage}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '4px',
                backgroundColor: 'var(--folio-bg)',
              }}
            >
              <ImageIcon size={16} /> Picture
            </button>

            <button
              onClick={insertLink}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '4px',
                backgroundColor: 'var(--folio-bg)',
              }}
            >
              <LinkIcon size={16} /> Link
            </button>

            <button
              onClick={() => documentEditor.chain().focus().setHorizontalRule().run()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '4px',
                backgroundColor: 'var(--folio-bg)',
              }}
            >
              <Minus size={16} /> Divider
            </button>
          </div>
        )}

        {/* LAYOUT & VIEW TAB */}
        {activeTab === 'layout' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {isDoc && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--folio-ink)' }}>Page Size:</span>
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(e.target.value as 'letter' | 'a4')}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--folio-border)',
                  }}
                >
                  <option value="letter">Letter (8.5 × 11 in)</option>
                  <option value="a4">A4 (210 × 297 mm)</option>
                </select>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--folio-ink)' }}>Zoom:</span>
              {[75, 100, 125, 150].map((z) => (
                <button
                  key={z}
                  onClick={() => onZoomChange(z)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: zoom === z ? 'var(--folio-teal)' : 'var(--folio-bg)',
                    color: zoom === z ? 'white' : 'var(--folio-ink)',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  {z}%
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

