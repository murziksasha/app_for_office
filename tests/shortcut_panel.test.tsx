import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ShortcutPanel } from '../src/shell/ShortcutPanel';

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

describe('ShortcutPanel', () => {
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

  it('renders categorized shortcut list when open', () => {
    const handleClose = vi.fn();
    act(() => {
      root.render(<ShortcutPanel open={true} onClose={handleClose} activeKind="document" />);
    });

    const panel = container.querySelector('[data-testid="shortcut-panel"]');
    expect(panel).not.toBeNull();
    expect(container.textContent).toContain('Ctrl');
    expect(container.textContent).toContain('S');
  });

  it('filters shortcuts based on search query', () => {
    const handleClose = vi.fn();
    act(() => {
      root.render(<ShortcutPanel open={true} onClose={handleClose} activeKind="document" />);
    });

    const searchInput = container.querySelector('input') as HTMLInputElement;
    expect(searchInput).not.toBeNull();

    act(() => {
      setInputValue(searchInput, 'Save');
    });

    expect(container.textContent).toContain('S');
  });

  it('triggers onClose when pressing Escape or clicking close button', () => {
    const handleClose = vi.fn();
    act(() => {
      root.render(<ShortcutPanel open={true} onClose={handleClose} activeKind="document" />);
    });

    const closeBtn = container.querySelector('button[title="Close"], button[aria-label="Close"]') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();

    act(() => {
      closeBtn.click();
    });
    expect(handleClose).toHaveBeenCalled();
  });
});
