import { describe, expect, it } from 'vitest';
import { tabsFor } from '../src/shell/ribbon/tabs';

describe('Ribbon tabs', () => {
  it('exposes only tabs that have commands', () => {
    expect(tabsFor('document')).toEqual(['file', 'home', 'insert', 'layout', 'references', 'view']);
    expect(tabsFor('spreadsheet')).toEqual(['file', 'home', 'insert', 'layout', 'data', 'view']);
    expect(tabsFor('presentation')).toEqual(['file', 'home', 'insert', 'design', 'slideshow', 'view']);
    expect(tabsFor('pdf')).toEqual(['file']);
  });
});
