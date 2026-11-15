import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WordCountDialog } from '../src/document/WordCountDialog';
import type { DocumentWordCountStats } from '../src/document/wordCount';
import '../src/i18n/instance';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('WordCountDialog component', () => {
  let container: HTMLDivElement;
  let root: Root;

  const sampleStats: DocumentWordCountStats = {
    document: {
      pages: 3,
      words: 450,
      charactersNoSpaces: 2100,
      charactersWithSpaces: 2600,
      paragraphs: 12,
      lines: 48,
    },
    selection: null,
    hasSelection: false,
  };

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

  it('renders complete document statistics in dialog', () => {
    act(() => {
      root.render(<WordCountDialog stats={sampleStats} onClose={vi.fn()} />);
    });

    const dialog = container.querySelector('[data-testid="word-count-dialog"]');
    expect(dialog).not.toBeNull();

    // Check that numbers are present
    expect(container.textContent).toContain('450');
    expect(container.textContent).toMatch(/2[\s, ]100/);
    expect(container.textContent).toContain('12');
  });

  it('shows selection column when hasSelection is true', () => {
    const statsWithSel: DocumentWordCountStats = {
      ...sampleStats,
      hasSelection: true,
      selection: {
        pages: 1,
        words: 55,
        charactersNoSpaces: 280,
        charactersWithSpaces: 340,
        paragraphs: 2,
        lines: 6,
      },
    };

    act(() => {
      root.render(<WordCountDialog stats={statsWithSel} onClose={vi.fn()} />);
    });

    expect(container.textContent).toContain('55');
    expect(container.textContent).toContain('450');
  });

  it('triggers onClose when clicking close button or pressing Escape', () => {
    const onClose = vi.fn();
    act(() => {
      root.render(<WordCountDialog stats={sampleStats} onClose={onClose} />);
    });

    const closeBtn = container.querySelector('[data-testid="word-count-close-btn"]') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    act(() => {
      closeBtn.click();
    });
    expect(onClose).toHaveBeenCalled();

    // Test Escape key
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
