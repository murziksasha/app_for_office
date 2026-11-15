import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CommandSearch } from '../src/shell/CommandSearch';
import { searchCommands } from '../src/shell/commands';

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

describe('CommandSearch component and searchCommands helper', () => {
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

  describe('searchCommands helper', () => {
    it('returns empty array on empty query', () => {
      expect(searchCommands('', 'document')).toEqual([]);
      expect(searchCommands('   ', 'spreadsheet')).toEqual([]);
    });

    it('filters commands by active document kind', () => {
      // Bold is document-only
      const docResults = searchCommands('bold', 'document');
      expect(docResults.some((c) => c.id === 'bold')).toBe(true);

      const sheetResults = searchCommands('bold', 'spreadsheet');
      expect(sheetResults.some((c) => c.id === 'bold')).toBe(false);
    });

    it('matches commands by command id or translated label', () => {
      const results = searchCommands('save', 'document');
      expect(results.some((c) => c.id === 'save')).toBe(true);
      expect(results.some((c) => c.id === 'saveAs')).toBe(true);
    });
  });

  describe('CommandSearch component UI', () => {
    it('renders search input with placeholder', () => {
      act(() => {
        root.render(<CommandSearch kind="document" />);
      });

      const input = container.querySelector('[data-testid="folio-command-search-input"]') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.placeholder).toContain('Alt+Q');
    });

    it('typing a query opens dropdown with matching command results', () => {
      act(() => {
        root.render(<CommandSearch kind="document" />);
      });

      const input = container.querySelector('[data-testid="folio-command-search-input"]') as HTMLInputElement;
      act(() => {
        setInputValue(input, 'save');
      });

      const results = container.querySelector('[data-testid="folio-command-search-results"]');
      expect(results).not.toBeNull();
      const saveItem = container.querySelector('[data-testid="command-search-item-save"]');
      expect(saveItem).not.toBeNull();
    });

    it('displays no results message when query has no matches', () => {
      act(() => {
        root.render(<CommandSearch kind="document" />);
      });

      const input = container.querySelector('[data-testid="folio-command-search-input"]') as HTMLInputElement;
      act(() => {
        setInputValue(input, 'xyznonexistent123');
      });

      const results = container.querySelector('[data-testid="folio-command-search-results"]');
      expect(results).not.toBeNull();
      expect(results?.textContent).toContain('No matching');
    });

    it('clicking a command result runs the command and closes the search', () => {
      const onCommandRun = vi.fn();
      act(() => {
        root.render(<CommandSearch kind="document" onCommandRun={onCommandRun} />);
      });

      const input = container.querySelector('[data-testid="folio-command-search-input"]') as HTMLInputElement;
      act(() => {
        setInputValue(input, 'save');
      });

      const saveItem = container.querySelector('[data-testid="command-search-item-save"]') as HTMLDivElement;
      act(() => {
        saveItem.click();
      });

      expect(onCommandRun).toHaveBeenCalledWith(expect.objectContaining({ id: 'save' }));
      expect(container.querySelector('[data-testid="folio-command-search-results"]')).toBeNull();
      expect(input.value).toBe('');
    });

    it('pressing Enter runs the first command result', () => {
      const onCommandRun = vi.fn();
      act(() => {
        root.render(<CommandSearch kind="document" onCommandRun={onCommandRun} />);
      });

      const input = container.querySelector('[data-testid="folio-command-search-input"]') as HTMLInputElement;
      act(() => {
        setInputValue(input, 'save');
      });

      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });

      expect(onCommandRun).toHaveBeenCalledWith(expect.objectContaining({ id: 'save' }));
    });

    it('pressing Escape closes the results dropdown', () => {
      act(() => {
        root.render(<CommandSearch kind="document" />);
      });

      const input = container.querySelector('[data-testid="folio-command-search-input"]') as HTMLInputElement;
      act(() => {
        setInputValue(input, 'save');
      });

      expect(container.querySelector('[data-testid="folio-command-search-results"]')).not.toBeNull();

      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });

      expect(container.querySelector('[data-testid="folio-command-search-results"]')).toBeNull();
    });
  });
});
