import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EditorState, DocumentKind, SupportedFormat, RecentItem, DraftItem } from './types';
import {
  pickFileToOpen,
  verifyPermission,
  readFileFromPath,
  setWindowTitle,
  setupCloseGuard,
  setupFileDropHandler,
  setupOpenRequestHandler,
  isDesktopPlatform,
} from './platform';
import { loadFileToEditor } from './files/open';
import { saveEditorContent } from './files/save';
import { saveDraft, clearDraft } from './files/drafts';
import { defaultDocumentModel } from './document/model';
import { StartScreen } from './shell/StartScreen';
import { Ribbon } from './shell/Ribbon';
import { StatusBar } from './shell/StatusBar';
import { ImportReportDialog } from './shell/ImportReportDialog';
import { SaveAsDialog } from './shell/SaveAsDialog';
import { DocumentEditor } from './document/DocumentEditor';
import { SpreadsheetEditor } from './spreadsheet/SpreadsheetEditor';
import { createEmptySheet } from './spreadsheet/adapters';
import { SlideEditor } from './slides/SlideEditor';
import { createEmptySlide } from './slides/pptxAdapter';
import { PdfViewer } from './pdf/PdfViewer';

export const App: React.FC = () => {
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [documentEditorInstance, setDocumentEditorInstance] = useState<any>(null);
  const [pageSize, setPageSize] = useState<'letter' | 'a4'>('letter');
  const [zoom, setZoom] = useState<number>(100);
  const [showSaveAs, setShowSaveAs] = useState<boolean>(false);
  const [showImportReport, setShowImportReport] = useState<boolean>(false);

  const autosaveTimeoutRef = useRef<any>(null);

  // Update window title (shows file name and dirty mark)
  useEffect(() => {
    const title = editorState
      ? `Folio - ${editorState.fileName}${editorState.isDirty ? ' *' : ''}`
      : 'Folio';
    setWindowTitle(title);
  }, [editorState?.fileName, editorState?.isDirty]);

  // Unsaved guard before closing window (Tauri close-requested & browser beforeunload)
  useEffect(() => {
    const cleanup = setupCloseGuard(() => Boolean(editorState?.isDirty));
    return cleanup;
  }, [editorState?.isDirty]);

  // Desktop native file drop listener (using Tauri's file-drop event and folio_read)
  useEffect(() => {
    const cleanup = setupFileDropHandler(async (file, path) => {
      try {
        const loaded = await loadFileToEditor(file, file.name, undefined, path);
        setEditorState(loaded);
        if (loaded.importReport && (loaded.importReport.warnings.length > 0 || loaded.importReport.fallbackUsed)) {
          setShowImportReport(true);
        }
      } catch (err: any) {
        alert(err.message || 'Failed to open dropped file');
      }
    });
    return cleanup;
  }, []);

  // Desktop second-launch / CLI open request listener
  useEffect(() => {
    const cleanup = setupOpenRequestHandler(async (path) => {
      try {
        const loadedFile = await readFileFromPath(path);
        const loaded = await loadFileToEditor(loadedFile.file, loadedFile.name, undefined, path);
        setEditorState(loaded);
        if (loaded.importReport && (loaded.importReport.warnings.length > 0 || loaded.importReport.fallbackUsed)) {
          setShowImportReport(true);
        }
      } catch (err: any) {
        console.error('Failed to open requested path:', err);
      }
    });
    return cleanup;
  }, []);

  // Browser Drag & Drop handler (DataTransfer.files)
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        try {
          const loaded = await loadFileToEditor(file, file.name);
          setEditorState(loaded);
          if (loaded.importReport && (loaded.importReport.warnings.length > 0 || loaded.importReport.fallbackUsed)) {
            setShowImportReport(true);
          }
        } catch (err: any) {
          alert(err.message || 'Failed to open file');
        }
      }
    };
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  // Autosave draft to IndexedDB when dirty
  useEffect(() => {
    if (!editorState || !editorState.isDirty) return;

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(async () => {
      const draftPayload =
        editorState.kind === 'document'
          ? editorState.documentContent
          : editorState.kind === 'spreadsheet'
          ? editorState.spreadsheetData
          : editorState.kind === 'presentation'
          ? editorState.presentationData
          : null;

      if (draftPayload) {
        await saveDraft({
          id: editorState.fileName,
          name: editorState.fileName,
          kind: editorState.kind,
          format: editorState.format,
          content: draftPayload,
          updatedAt: Date.now(),
        });
      }
    }, 1500);

    return () => {
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    };
  }, [editorState]);

  // Create New File
  const handleNew = (kind: DocumentKind) => {
    if (editorState?.isDirty) {
      const confirmDiscard = window.confirm('You have unsaved changes. Create new file without saving?');
      if (!confirmDiscard) return;
    }

    let defaultName = 'Document1.docx';
    let defaultFormat: SupportedFormat = 'docx';
    let docContent = defaultDocumentModel;
    let sheets = [createEmptySheet('Sheet1')];
    let presentation = { title: 'Presentation1', slides: [createEmptySlide(1)] };

    if (kind === 'spreadsheet') {
      defaultName = 'Workbook1.xlsx';
      defaultFormat = 'xlsx';
    } else if (kind === 'presentation') {
      defaultName = 'Presentation1.pptx';
      defaultFormat = 'pptx';
    }

    setEditorState({
      kind,
      fileName: defaultName,
      format: defaultFormat,
      isDirty: false,
      lastSavedAt: new Date(),
      documentContent: docContent,
      spreadsheetData: sheets,
      presentationData: presentation,
    });
  };

  // Open File
  const handleOpen = async () => {
    if (editorState?.isDirty) {
      const confirmDiscard = window.confirm('You have unsaved changes. Open another file without saving?');
      if (!confirmDiscard) return;
    }

    const picked = await pickFileToOpen();
    if (!picked) return;

    try {
      const loaded = await loadFileToEditor(picked.file, picked.file.name, picked.handle, picked.path);
      setEditorState(loaded);
      if (loaded.importReport && (loaded.importReport.warnings.length > 0 || loaded.importReport.fallbackUsed)) {
        setShowImportReport(true);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to open file');
    }
  };

  // Open Recent File
  const handleOpenRecent = async (item: RecentItem) => {
    if (editorState?.isDirty) {
      const confirmDiscard = window.confirm('You have unsaved changes. Open another file without saving?');
      if (!confirmDiscard) return;
    }

    // In desktop, if path exists, open directly with no extra prompt
    if (isDesktopPlatform() && item.path) {
      try {
        const result = await readFileFromPath(item.path);
        const loaded = await loadFileToEditor(result.file, result.name, undefined, result.path);
        setEditorState(loaded);
        if (loaded.importReport && (loaded.importReport.warnings.length > 0 || loaded.importReport.fallbackUsed)) {
          setShowImportReport(true);
        }
        return;
      } catch (err: any) {
        console.warn('Could not open via path:', err);
        alert(`Failed to open recent file: ${err.message || String(err)}`);
        return;
      }
    }

    // In browser, if handle exists, request permission again on reopen
    if (item.handle) {
      try {
        const permitted = await verifyPermission(item.handle, false);
        if (permitted) {
          const file = await item.handle.getFile();
          const loaded = await loadFileToEditor(file, file.name, item.handle);
          setEditorState(loaded);
          if (loaded.importReport && (loaded.importReport.warnings.length > 0 || loaded.importReport.fallbackUsed)) {
            setShowImportReport(true);
          }
          return;
        }
      } catch (err) {
        console.warn('Could not open via stored file handle:', err);
      }
    }

    // Fallback if handle expired or inaccessible
    handleOpen();
  };

  // Restore Draft
  const handleRestoreDraft = (draft: DraftItem) => {
    setEditorState({
      kind: draft.kind,
      fileName: draft.name,
      format: draft.format,
      isDirty: true,
      lastSavedAt: new Date(draft.updatedAt),
      documentContent: draft.kind === 'document' ? draft.content : defaultDocumentModel,
      spreadsheetData: draft.kind === 'spreadsheet' ? draft.content : undefined,
      presentationData: draft.kind === 'presentation' ? draft.content : undefined,
    });
  };

  // Save current file
  const handleSave = useCallback(async () => {
    if (!editorState) return;
    try {
      const result = await saveEditorContent(editorState);
      if (result.success && result.updatedState) {
        setEditorState(result.updatedState);
        await clearDraft(editorState.fileName);
      }
    } catch (err: any) {
      alert(`Save failed: ${err.message || String(err)}`);
    }
  }, [editorState]);

  // Save As
  const handleSaveAsConfirm = async (targetFormat: SupportedFormat, newName: string) => {
    if (!editorState) return;
    try {
      const result = await saveEditorContent(editorState, {
        format: targetFormat,
        fileName: newName,
        saveAs: true,
      });
      if (result.success && result.updatedState) {
        setEditorState(result.updatedState);
        setShowSaveAs(false);
        await clearDraft(editorState.fileName);
      }
    } catch (err: any) {
      alert(`Save As failed: ${err.message || String(err)}`);
    }
  };

  // Close File
  const handleCloseFile = () => {
    if (editorState?.isDirty) {
      const confirmClose = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmClose) return;
    }
    setEditorState(null);
    setDocumentEditorInstance(null);
  };

  // Print Document
  const handlePrint = () => {
    window.print();
  };

  // Keyboard shortcut Ctrl+S at window level
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <input
        type="file"
        data-testid="global-file-input"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            try {
              const loaded = await loadFileToEditor(file, file.name);
              setEditorState(loaded);
              if (loaded.importReport && (loaded.importReport.warnings.length > 0 || loaded.importReport.fallbackUsed)) {
                setShowImportReport(true);
              }
            } catch (err: any) {
              alert(err.message || 'Failed to open file');
            }
          }
        }}
      />
      {!editorState ? (
        <StartScreen
          onNew={handleNew}
          onOpen={handleOpen}
          onOpenRecent={handleOpenRecent}
          onRestoreDraft={handleRestoreDraft}
          onFileDrop={async (file) => {
            try {
              const loaded = await loadFileToEditor(file, file.name);
              setEditorState(loaded);
              if (loaded.importReport && (loaded.importReport.warnings.length > 0 || loaded.importReport.fallbackUsed)) {
                setShowImportReport(true);
              }
            } catch (err: any) {
              alert(err.message || 'Failed to open file');
            }
          }}
        />
      ) : (
        <>
          {/* Ribbon */}
          <Ribbon
            editorState={editorState}
            documentEditor={documentEditorInstance}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            zoom={zoom}
            onZoomChange={setZoom}
            onSave={handleSave}
            onSaveAs={() => setShowSaveAs(true)}
            onPrint={handlePrint}
            onCloseFile={handleCloseFile}
            onNew={handleNew}
            onOpen={handleOpen}
            onOpenReport={() => setShowImportReport(true)}
          />

          {/* Active Workspace / Editor */}
          <main style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
            {editorState.kind === 'document' && (
              <DocumentEditor
                content={editorState.documentContent || defaultDocumentModel}
                pageSize={pageSize}
                zoom={zoom}
                onChange={(doc) => {
                  setEditorState((prev) => (prev ? { ...prev, documentContent: doc, isDirty: true } : prev));
                }}
                onEditorReady={setDocumentEditorInstance}
                onSaveShortcut={handleSave}
              />
            )}

            {editorState.kind === 'spreadsheet' && (
              <SpreadsheetEditor
                sheets={editorState.spreadsheetData || [createEmptySheet('Sheet1')]}
                onChange={(sheets) => {
                  setEditorState((prev) => (prev ? { ...prev, spreadsheetData: sheets, isDirty: true } : prev));
                }}
                onSaveShortcut={handleSave}
              />
            )}

            {editorState.kind === 'presentation' && (
              <SlideEditor
                presentation={
                  editorState.presentationData || {
                    title: editorState.fileName,
                    slides: [createEmptySlide(1)],
                  }
                }
                onChange={(pres) => {
                  setEditorState((prev) => (prev ? { ...prev, presentationData: pres, isDirty: true } : prev));
                }}
                onSaveShortcut={handleSave}
              />
            )}

            {editorState.kind === 'pdf' && editorState.pdfData && <PdfViewer pdfData={editorState.pdfData} />}
          </main>

          {/* Status Bar */}
          <StatusBar
            editorState={editorState}
            documentEditor={documentEditorInstance}
            pageSize={pageSize}
            zoom={zoom}
            onZoomChange={setZoom}
          />
        </>
      )}

      {/* Import Report Dialog */}
      {showImportReport && editorState?.importReport && (
        <ImportReportDialog report={editorState.importReport} onClose={() => setShowImportReport(false)} />
      )}

      {/* Save As Dialog */}
      {showSaveAs && editorState && (
        <SaveAsDialog
          currentKind={editorState.kind}
          currentFormat={editorState.format}
          currentFileName={editorState.fileName}
          onSave={handleSaveAsConfirm}
          onClose={() => setShowSaveAs(false)}
        />
      )}
    </div>
  );
};
