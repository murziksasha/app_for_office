import { describe, expect, it } from 'vitest';
import { applyTheme, readThemePreference, resolveTheme } from '../src/shell/theme';

describe('Theme preference', () => {
  it('resolves system from the system scheme and keeps an explicit choice', () => {
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('defaults to system and applies an explicit choice', () => {
    const memory = {
      stored: null as string | null,
      getItem() {
        return this.stored;
      },
    };
    expect(readThemePreference(memory)).toBe('system');
    memory.stored = 'dark';
    expect(readThemePreference(memory)).toBe('dark');
    expect(readThemePreference({ getItem: () => 'nope' })).toBe('system');
    applyTheme('dark', false);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.themePreference).toBe('dark');
    applyTheme('light', true);
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
