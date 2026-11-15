import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../src/i18n/locales/en.json';
import uk from '../src/i18n/locales/uk.json';
import { initI18n } from '../src/i18n';
import { i18n } from '../src/i18n/instance';
import { resolveUiLanguage } from '../src/i18n/resolve';

const store = new Map<string, string>();
const memoryStorage = {
  getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
  setItem: (key: string, value: string) => {
    store.set(key, String(value));
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
  clear: () => {
    store.clear();
  },
};

function flatKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatKeys(child, prefix ? `${prefix}.${key}` : key)
  );
}

describe('ui language', () => {
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', memoryStorage);
  });

  afterEach(async () => {
    store.clear();
    await i18n.changeLanguage('en');
    vi.unstubAllGlobals();
  });

  it('gives English and Ukrainian the same keys', () => {
    expect(flatKeys(uk).sort()).toEqual(flatKeys(en).sort());
  });

  it('uses short Ukrainian office labels', () => {
    expect(uk.ribbon.save).toBe('Зберегти');
    expect(uk.ribbon.open).toBe('Відкрити');
    expect(uk.ribbon.home).toBe('Основне');
    expect(uk.ribbon.insert).toBe('Вставлення');
    expect(uk.ribbon.layout).toBe('Макет');
    expect(JSON.stringify(uk)).not.toMatch(/Сохранить|Открыть|Главная|Вставка/);
  });

  it('lets a saved choice win, then country, then display language', () => {
    expect(resolveUiLanguage({ saved: 'uk', country: 'US', displayLanguage: 'en-US' })).toBe('uk');
    expect(resolveUiLanguage({ saved: 'en', country: 'UA', displayLanguage: 'uk-UA' })).toBe('en');
    expect(resolveUiLanguage({ saved: null, country: 'UA', displayLanguage: 'en-US' })).toBe('uk');
    expect(resolveUiLanguage({ saved: 'ru', country: 'DE', displayLanguage: 'uk-UA' })).toBe('uk');
    expect(resolveUiLanguage({ saved: null, country: 'US', displayLanguage: 'en-US' })).toBe('en');
    expect(resolveUiLanguage({ saved: null, country: null, displayLanguage: 'uk' })).toBe('uk');
  });

  it('restores a saved choice without a country lookup in the browser', async () => {
    localStorage.setItem('folio_ui_lang', 'uk');
    await expect(initI18n()).resolves.toBe('uk');
    expect(i18n.language).toBe('uk');
  });
});
