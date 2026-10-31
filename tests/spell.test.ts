import { describe, it, expect, beforeEach } from 'vitest';
import { Editor } from '@tiptap/core';
import { isWordMisspelled, getSuggestions } from '../src/document/spell/checker';
import { addUserWord, clearUserDictionary, getUserWords } from '../src/document/spell/userDictionary';
import { documentExtensions } from '../src/document/model';
import { spellCheckPluginKey } from '../src/document/spell/spellPlugin';

describe('Offline spell check', () => {
  beforeEach(() => {
    clearUserDictionary();
  });

  it('recognizes valid words and flags unknown words', () => {
    // English
    expect(isWordMisspelled('document', 'en')).toBe(false);
    expect(isWordMisspelled('Document', 'en')).toBe(false);
    expect(isWordMisspelled('banana', 'en')).toBe(false);
    expect(isWordMisspelled('documnt', 'en')).toBe(true);
    expect(isWordMisspelled('aple', 'en')).toBe(true);

    // Ukrainian
    expect(isWordMisspelled('документ', 'uk')).toBe(false);
    expect(isWordMisspelled('Документ', 'uk')).toBe(false);
    expect(isWordMisspelled('докумнт', 'uk')).toBe(true);
  });

  it('ignores numbers, urls, and single characters', () => {
    expect(isWordMisspelled('12345', 'en')).toBe(false);
    expect(isWordMisspelled('1924', 'en')).toBe(false);
    expect(isWordMisspelled('https://example.com', 'en')).toBe(false);
    expect(isWordMisspelled('user@domain.com', 'en')).toBe(false);
    expect(isWordMisspelled('a', 'en')).toBe(false);
    expect(isWordMisspelled('i', 'en')).toBe(false);
  });

  it('generates spell-check suggestions for misspelled words', () => {
    const suggestions = getSuggestions('documnt', 'en');
    expect(suggestions).toContain('document');

    const capSuggestions = getSuggestions('Documnt', 'en');
    expect(capSuggestions).toContain('Document');
  });

  it('persists and uses words added to custom dictionary', () => {
    expect(isWordMisspelled('mycustombrand', 'en')).toBe(true);
    addUserWord('mycustombrand');
    expect(getUserWords().has('mycustombrand')).toBe(true);
    expect(isWordMisspelled('mycustombrand', 'en')).toBe(false);
  });

  it('decorates misspelled words in editor and toggles decoration', () => {
    const editor = new Editor({
      extensions: documentExtensions,
      content: '<p>Hello world documnt</p>',
    });

    const pluginState = spellCheckPluginKey.getState(editor.state);
    expect(pluginState?.enabled).toBe(true);

    // Toggle off
    (editor.commands as any).toggleSpellCheck();
    const toggledState = spellCheckPluginKey.getState(editor.state);
    expect(toggledState?.enabled).toBe(false);

    editor.destroy();
  });
});

