import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as about from '../src/shell/about';

describe('About Module', () => {
  it('contains the four identity lines', () => {
    // 1. Author Name (identical Latin spelling)
    expect(about.AUTHOR_NAME).toBe('Oleksandr Hryhoriev');
    expect(about.ABOUT_IDENTITY.name).toBe('Oleksandr Hryhoriev');

    // 2. Email
    expect(about.AUTHOR_EMAIL).toBe('1versuses1@gmail.com');
    expect(about.ABOUT_IDENTITY.email).toBe('1versuses1@gmail.com');

    // 3. Phone
    expect(about.AUTHOR_PHONE).toBe('063 556 70 90');
    expect(about.ABOUT_IDENTITY.phone).toBe('063 556 70 90');

    // 4. Place (English & Ukrainian)
    expect(about.AUTHOR_PLACE_EN).toBe('Ukraine, Chornomorsk');
    expect(about.AUTHOR_PLACE_UK).toBe('Україна, Чорноморськ');
    expect(about.ABOUT_IDENTITY.placeEn).toBe('Ukraine, Chornomorsk');
    expect(about.ABOUT_IDENTITY.placeUk).toBe('Україна, Чорноморськ');

    expect(about.getAuthorPlace('en')).toBe('Ukraine, Chornomorsk');
    expect(about.getAuthorPlace('uk')).toBe('Україна, Чорноморськ');
    expect(about.getAuthorPlace('uk-UA')).toBe('Україна, Чорноморськ');
    expect(about.getAuthorPlace(undefined)).toBe('Ukraine, Chornomorsk');
  });

  it('exports app name, version constant, and tagline', () => {
    expect(about.APP_NAME).toBe('Folio');
    expect(about.APP_VERSION).toBe('1.0.0');
    expect(about.APP_TAGLINE).toBe('Local-first office suite for documents, spreadsheets, and presentations');
  });

  it('does not include Word, Excel, PowerPoint, or Microsoft in any strings or file content', () => {
    const forbidden = ['word', 'excel', 'powerpoint', 'microsoft'];

    // Check exported string values
    const stringValues = Object.values(about).filter((val) => typeof val === 'string');
    for (const val of stringValues) {
      for (const term of forbidden) {
        expect(val.toLowerCase()).not.toContain(term);
      }
    }

    // Check the raw about.ts source file
    const filePath = path.resolve(__dirname, '../src/shell/about.ts');
    const source = fs.readFileSync(filePath, 'utf8');
    for (const term of forbidden) {
      expect(source.toLowerCase()).not.toContain(term);
    }
  });
});

