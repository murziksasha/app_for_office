import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ZoomPopover } from '../src/shell/ZoomPopover';
import { StatusBar } from '../src/shell/StatusBar';
import type { EditorState } from '../src/types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('ZoomPopover & StatusBar Enhancements', () => {
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

  it('renders zoom presets and triggers onSelectZoom', () => {
    const handleSelect = vi.fn();
    const handleClose = vi.fn();

    act(() => {
      root.render(
        <ZoomPopover
          zoom={100}
          onSelectZoom={handleSelect}
          onClose={handleClose}
          isDoc={true}
        />
      );
    });

    const popover = container.querySelector('[data-testid="zoom-popover"]');
    expect(popover).not.toBeNull();

    const buttons = Array.from(container.querySelectorAll('button'));
    const btn150 = buttons.find((b) => b.textContent?.includes('150%'));
    expect(btn150).toBeDefined();

    act(() => {
      btn150?.click();
    });

    expect(handleSelect).toHaveBeenCalledWith(150);
    expect(handleClose).toHaveBeenCalled();
  });

  it('renders document-specific page width preset', () => {
    const handleSelect = vi.fn();
    const handleClose = vi.fn();

    act(() => {
      root.render(
        <ZoomPopover
          zoom={100}
          onSelectZoom={handleSelect}
          onClose={handleClose}
          isDoc={true}
        />
      );
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const pageWidthBtn = buttons.find((b) => b.textContent?.includes('width') || b.textContent?.includes('ширині'));
    expect(pageWidthBtn).toBeDefined();

    act(() => {
      pageWidthBtn?.click();
    });

    expect(handleSelect).toHaveBeenCalledWith(130);
  });

  it('renders saved timestamp in StatusBar when provided', () => {
    const mockState: EditorState = {
      id: 'tab1',
      fileName: 'Doc1.docx',
      kind: 'document',
      format: 'docx',
      isDirty: false,
    };

    act(() => {
      root.render(
        <StatusBar
          editorState={mockState}
          zoom={100}
          onZoomChange={vi.fn()}
          lastSavedTime="14:30"
        />
      );
    });

    const indicator = container.querySelector('[data-testid="status-save-indicator"]');
    expect(indicator?.textContent).toContain('14:30');
  });

  it('renders saving state in StatusBar when saving', () => {
    const mockState: EditorState = {
      id: 'tab1',
      fileName: 'Doc1.docx',
      kind: 'document',
      format: 'docx',
      isDirty: true,
    };

    act(() => {
      root.render(
        <StatusBar
          editorState={mockState}
          zoom={100}
          onZoomChange={vi.fn()}
          saveState="saving"
        />
      );
    });

    const indicator = container.querySelector('[data-testid="status-save-indicator"]');
    expect(indicator?.textContent).toContain('Saving');
  });
});
