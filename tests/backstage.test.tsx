import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Backstage, type BackstageProps } from '../src/shell/Backstage';
import type { EditorState } from '../src/types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Backstage component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const baseDocumentState: EditorState = {
    id: 'doc-1',
    fileName: 'Report.docx',
    path: '/path/to/Report.docx',
    format: 'docx',
    isDirty: false,
    dirty: false,
    kind: 'document',
    documentContent: { type: 'doc', content: [{ type: 'paragraph' }] },
  };

  const defaultProps: BackstageProps = {
    editorState: baseDocumentState,
    docPageInfo: { page: 1, totalPages: 3, words: 450 },
    onClose: vi.fn(),
    onNew: vi.fn(),
    onOpen: vi.fn(),
    onSave: vi.fn(),
    onSaveAs: vi.fn(),
    onSavePdf: vi.fn(),
    onPrint: vi.fn(),
    onCloseFile: vi.fn(),
    onOpenSettings: vi.fn(),
  };

  it('renders Info section with file path, format, and document stats (words and pages)', () => {
    act(() => {
      root.render(<Backstage {...defaultProps} />);
    });

    expect(container.querySelector('[data-testid="folio-backstage"]')).not.toBeNull();
    const loc = container.querySelector('[data-testid="backstage-info-location"]');
    expect(loc?.textContent).toContain('/path/to/Report.docx');
    const format = container.querySelector('[data-testid="backstage-info-format"]');
    expect(format?.textContent).toContain('DOCX');
    const words = container.querySelector('[data-testid="backstage-stat-words"]');
    expect(words?.textContent).toBe('450');
    const pages = container.querySelector('[data-testid="backstage-stat-pages"]');
    expect(pages?.textContent).toBe('3');
  });

  it('renders spreadsheet stats (sheets count) and presentation stats (slides count)', () => {
    const sheetState: EditorState = {
      id: 'sheet-1',
      fileName: 'Budget.xlsx',
      path: '/path/to/Budget.xlsx',
      format: 'xlsx',
      isDirty: true,
      dirty: true,
      kind: 'spreadsheet',
      spreadsheetData: [{ name: 'Q1' }, { name: 'Q2' }] as any,
    };

    act(() => {
      root.render(<Backstage {...defaultProps} editorState={sheetState} />);
    });
    const sheets = container.querySelector('[data-testid="backstage-stat-sheets"]');
    expect(sheets?.textContent).toBe('2');

    const presState: EditorState = {
      id: 'pres-1',
      fileName: 'Deck.pptx',
      path: '/path/to/Deck.pptx',
      format: 'pptx',
      isDirty: false,
      dirty: false,
      kind: 'presentation',
      presentationData: {
        title: 'Deck',
        slides: [{ id: 's1', elements: [] }, { id: 's2', elements: [] }, { id: 's3', elements: [] }],
      } as any,
    };

    act(() => {
      root.render(<Backstage {...defaultProps} editorState={presState} />);
    });
    const slides = container.querySelector('[data-testid="backstage-stat-slides"]');
    expect(slides?.textContent).toBe('3');
  });

  it('navigates between Info, New, and Open sections from the left rail', () => {
    act(() => {
      root.render(<Backstage {...defaultProps} />);
    });

    expect(container.querySelector('[data-testid="backstage-section-info"]')).not.toBeNull();

    // Switch to New
    const navNew = container.querySelector('[data-testid="backstage-nav-new"]') as HTMLButtonElement;
    act(() => {
      navNew.click();
    });
    expect(container.querySelector('[data-testid="backstage-section-new"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="backstage-new-document"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="backstage-new-spreadsheet"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="backstage-new-presentation"]')).not.toBeNull();

    // Switch to Open
    const navOpen = container.querySelector('[data-testid="backstage-nav-open"]') as HTMLButtonElement;
    act(() => {
      navOpen.click();
    });
    expect(container.querySelector('[data-testid="backstage-section-open"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="backstage-open-browse"]')).not.toBeNull();
  });

  it('closes Backstage when clicking Back button or pressing Escape', () => {
    const onClose = vi.fn();
    act(() => {
      root.render(<Backstage {...defaultProps} onClose={onClose} />);
    });

    // Click back button
    const backBtn = container.querySelector('[data-testid="folio-backstage-back"]') as HTMLButtonElement;
    act(() => {
      backBtn.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Press Escape
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('triggers onNew and closes when clicking blank template card', () => {
    const onNew = vi.fn();
    const onClose = vi.fn();
    act(() => {
      root.render(<Backstage {...defaultProps} onNew={onNew} onClose={onClose} />);
    });

    // Go to New section
    const navNew = container.querySelector('[data-testid="backstage-nav-new"]') as HTMLButtonElement;
    act(() => {
      navNew.click();
    });

    // Click Blank Spreadsheet
    const blankSheet = container.querySelector('[data-testid="backstage-new-spreadsheet"]') as HTMLDivElement;
    act(() => {
      blankSheet.click();
    });
    expect(onNew).toHaveBeenCalledWith('spreadsheet');
    expect(onClose).toHaveBeenCalled();
  });

  it('triggers Save, Save As, Export PDF, and Close action handlers', () => {
    const onSave = vi.fn();
    const onSaveAs = vi.fn();
    const onSavePdf = vi.fn();
    const onCloseFile = vi.fn();
    const onClose = vi.fn();

    act(() => {
      root.render(
        <Backstage
          {...defaultProps}
          onSave={onSave}
          onSaveAs={onSaveAs}
          onSavePdf={onSavePdf}
          onCloseFile={onCloseFile}
          onClose={onClose}
        />,
      );
    });

    const saveBtn = container.querySelector('[data-testid="backstage-action-save"]') as HTMLButtonElement;
    act(() => {
      saveBtn.click();
    });
    expect(onSave).toHaveBeenCalled();

    const saveAsBtn = container.querySelector('[data-testid="backstage-action-save-as"]') as HTMLButtonElement;
    act(() => {
      saveAsBtn.click();
    });
    expect(onSaveAs).toHaveBeenCalled();

    const exportPdfBtn = container.querySelector('[data-testid="backstage-action-export-pdf"]') as HTMLButtonElement;
    act(() => {
      exportPdfBtn.click();
    });
    expect(onSavePdf).toHaveBeenCalled();

    const closeBtn = container.querySelector('[data-testid="backstage-action-close"]') as HTMLButtonElement;
    act(() => {
      closeBtn.click();
    });
    expect(onCloseFile).toHaveBeenCalled();
  });
});
