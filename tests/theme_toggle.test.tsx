import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ThemeToggle } from '../src/shell/ThemeToggle';
import { applyTheme, setThemePreference, THEME_STORAGE_KEY } from '../src/shell/theme';
import '../src/i18n/instance';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('ThemeToggle component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    localStorage.clear();
    applyTheme('light', false);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    localStorage.clear();
  });

  it('renders quick theme toggle button with accessible label and tooltip', () => {
    act(() => {
      root.render(<ThemeToggle />);
    });

    const button = container.querySelector('[data-testid="theme-toggle"]') as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-label')).toBeTruthy();
    expect(button?.getAttribute('title')).toBeTruthy();
  });

  it('toggles theme on click and saves explicit choice into folio_theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    applyTheme('light', false);

    act(() => {
      root.render(<ThemeToggle />);
    });

    const button = container.querySelector('[data-testid="theme-toggle"]') as HTMLButtonElement;
    expect(document.documentElement.dataset.theme).toBe('light');

    act(() => {
      button.click();
    });

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    act(() => {
      button.click();
    });

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('saves explicit opposite choice when system mode was selected prior to click', () => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    // When resolved system theme is dark
    applyTheme('system', true);
    expect(document.documentElement.dataset.theme).toBe('dark');

    act(() => {
      root.render(<ThemeToggle />);
    });

    const button = container.querySelector('[data-testid="theme-toggle"]') as HTMLButtonElement;

    act(() => {
      button.click();
    });

    // Clicking from dark resolves to light and explicitly sets 'light'
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('synchronizes state when theme preference changes via settings', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    applyTheme('light', false);

    act(() => {
      root.render(<ThemeToggle />);
    });

    const button = container.querySelector('[data-testid="theme-toggle"]') as HTMLButtonElement;
    const initialLabel = button.getAttribute('aria-label');

    act(() => {
      setThemePreference('dark');
    });

    const updatedLabel = button.getAttribute('aria-label');
    expect(updatedLabel).not.toBe(initialLabel);
  });
});
