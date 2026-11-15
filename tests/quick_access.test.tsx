import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QuickAccess } from '../src/shell/QuickAccess';
import type { EditorState } from '../src/types';
import '../src/i18n/instance';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('QuickAccess Toolbar Customization', () => {
  let container: HTMLDivElement;
  let root: Root;

  const dummyState: EditorState = {
    kind: 'document',
    fileName: 'Report.docx',
    format: 'docx',
    isDirty: false,
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    localStorage.clear();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    localStorage.clear();
  });

  it('renders default quick access buttons and customize button', () => {
    act(() => {
      root.render(
        <QuickAccess
          editorState={dummyState}
          onSave={vi.fn()}
          onPrint={vi.fn()}
        />
      );
    });

    const toolbar = container.querySelector('[role="toolbar"]');
    expect(toolbar).not.toBeNull();
    const customizeBtn = container.querySelector('[data-testid="folio-qa-customize"]');
    expect(customizeBtn).not.toBeNull();

    // Default buttons: Save, Undo, Redo, Print
    expect(container.querySelector('.folio-qa-save')).not.toBeNull();
    expect(container.querySelector('.folio-qa-undo')).not.toBeNull();
    expect(container.querySelector('.folio-qa-redo')).not.toBeNull();
    expect(container.querySelector('.folio-qa-print')).not.toBeNull();
  });

  it('opens customization menu on customize click and toggles tool', () => {
    const onNew = vi.fn();
    act(() => {
      root.render(
        <QuickAccess
          editorState={dummyState}
          onSave={vi.fn()}
          onPrint={vi.fn()}
          onNew={onNew}
        />
      );
    });

    const customizeBtn = container.querySelector('[data-testid="folio-qa-customize"]') as HTMLButtonElement;
    act(() => {
      customizeBtn.click();
    });

    const menu = container.querySelector('[data-testid="folio-qa-menu"]');
    expect(menu).not.toBeNull();

    // Toggle 'new' tool
    const newToggle = container.querySelector('[data-testid="qat-item-toggle-new"]') as HTMLButtonElement;
    expect(newToggle).not.toBeNull();
    act(() => {
      newToggle.click();
    });

    // Now 'new' button should appear in the toolbar
    const newBtn = container.querySelector('.folio-qa-new') as HTMLButtonElement;
    expect(newBtn).not.toBeNull();

    // Click 'new' button
    act(() => {
      newBtn.click();
    });
    expect(onNew).toHaveBeenCalled();
  });

  it('resets to default items when clicking reset', () => {
    act(() => {
      root.render(
        <QuickAccess
          editorState={dummyState}
          onSave={vi.fn()}
          onPrint={vi.fn()}
        />
      );
    });

    const customizeBtn = container.querySelector('[data-testid="folio-qa-customize"]') as HTMLButtonElement;
    act(() => {
      customizeBtn.click();
    });

    // Toggle 'new'
    const newToggle = container.querySelector('[data-testid="qat-item-toggle-new"]') as HTMLButtonElement;
    act(() => {
      newToggle.click();
    });
    expect(container.querySelector('.folio-qa-new')).not.toBeNull();

    // Click reset
    const resetBtn = container.querySelector('[data-testid="qat-reset-btn"]') as HTMLButtonElement;
    act(() => {
      resetBtn.click();
    });
    expect(container.querySelector('.folio-qa-new')).toBeNull();
  });
});
