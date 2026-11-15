import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DocumentEditor } from '../src/document/DocumentEditor';
import '../src/i18n/instance';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function setInputValue(input: HTMLInputElement, value: string) {
  const tracker = (input as any)._valueTracker;
  if (tracker) {
    tracker.setValue('');
  }
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('Document Navigation Pane', () => {
  let container: HTMLDivElement;
  let root: Root;

  const sampleDoc = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Section Alpha' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'This paragraph mentions apple and banana fruit.' }],
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Section Beta' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Another paragraph talking about orange and apple.' }],
      },
    ],
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

  it('renders 3 navigation tabs and displays headings by default', () => {
    act(() => {
      root.render(
        <DocumentEditor
          content={sampleDoc}
          onChange={vi.fn()}
          showOutline={true}
        />
      );
    });

    const pane = container.querySelector('[data-testid="outline-pane"]');
    expect(pane).not.toBeNull();

    // Check tabs
    expect(container.querySelector('[data-testid="nav-tab-headings"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="nav-tab-pages"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="nav-tab-search"]')).not.toBeNull();

    // Headings tab is active by default
    const headings = container.querySelectorAll('.folio-outline-item');
    expect(headings.length).toBe(2);
    expect(headings[0].textContent).toContain('Section Alpha');
    expect(headings[1].textContent).toContain('Section Beta');
  });

  it('switches to Pages tab and displays page list', () => {
    act(() => {
      root.render(
        <DocumentEditor
          content={sampleDoc}
          onChange={vi.fn()}
          showOutline={true}
        />
      );
    });

    const pagesTab = container.querySelector('[data-testid="nav-tab-pages"]') as HTMLButtonElement;
    act(() => {
      pagesTab.click();
    });

    const pageItem = container.querySelector('[data-testid="nav-page-item-1"]');
    expect(pageItem).not.toBeNull();
  });

  it('switches to Search tab, searches text, and displays matching results', () => {
    act(() => {
      root.render(
        <DocumentEditor
          content={sampleDoc}
          onChange={vi.fn()}
          showOutline={true}
        />
      );
    });

    const searchTab = container.querySelector('[data-testid="nav-tab-search"]') as HTMLButtonElement;
    act(() => {
      searchTab.click();
    });

    const searchInput = container.querySelector('[data-testid="nav-search-input"]') as HTMLInputElement;
    expect(searchInput).not.toBeNull();

    act(() => {
      setInputValue(searchInput, 'apple');
    });

    // Check match count
    const match0 = container.querySelector('[data-testid="nav-search-match-0"]');
    expect(match0).not.toBeNull();
    expect(match0?.textContent).toContain('apple');
  });
});
