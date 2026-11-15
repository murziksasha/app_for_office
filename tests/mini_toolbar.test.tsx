import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MiniToolbar } from '../src/shell/MiniToolbar';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('MiniToolbar', () => {
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

  const mockEditor = {
    getAttributes: vi.fn(() => ({ fontSize: '12pt' })),
    isActive: vi.fn((name: string) => name === 'bold'),
    chain: vi.fn(() => ({
      focus: vi.fn(() => ({
        setFontSize: vi.fn(() => ({ run: vi.fn() })),
        toggleBold: vi.fn(() => ({ run: vi.fn() })),
        toggleItalic: vi.fn(() => ({ run: vi.fn() })),
        toggleUnderline: vi.fn(() => ({ run: vi.fn() })),
        toggleHighlight: vi.fn(() => ({ run: vi.fn() })),
      })),
    })),
  };

  it('renders mini toolbar with formatting actions', () => {
    const handleClose = vi.fn();
    act(() => {
      root.render(
        <MiniToolbar
          editor={mockEditor}
          position={{ x: 200, y: 150 }}
          onClose={handleClose}
        />
      );
    });

    const toolbar = container.querySelector('[data-testid="mini-toolbar"]');
    expect(toolbar).not.toBeNull();
    const boldBtn = container.querySelector('[data-testid="mini-toolbar-bold"]');
    expect(boldBtn).not.toBeNull();
  });

  it('calls toggleBold when bold button is clicked', () => {
    const handleClose = vi.fn();
    act(() => {
      root.render(
        <MiniToolbar
          editor={mockEditor}
          position={{ x: 200, y: 150 }}
          onClose={handleClose}
        />
      );
    });

    const boldBtn = container.querySelector('[data-testid="mini-toolbar-bold"]') as HTMLButtonElement;
    act(() => {
      boldBtn.click();
    });
    expect(mockEditor.chain).toHaveBeenCalled();
  });

  it('closes on Escape key press', () => {
    const handleClose = vi.fn();
    act(() => {
      root.render(
        <MiniToolbar
          editor={mockEditor}
          position={{ x: 200, y: 150 }}
          onClose={handleClose}
        />
      );
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(handleClose).toHaveBeenCalled();
  });
});
