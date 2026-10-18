import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Folio Smoke Test Suite', () => {
  test('1. Loads app and verifies start screen', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Folio/i);
    await expect(page.getByRole('heading', { name: 'Folio' })).toBeVisible();
    await expect(page.getByText('Local-first office suite')).toBeVisible();

    await expect(page.getByRole('heading', { name: 'New Document' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New Spreadsheet' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New Presentation' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Open Existing' })).toBeVisible();
  });

  test('2. Creates a new document, types text, and applies bold formatting', async ({ page }) => {
    await page.goto('/');

    // Click New Document card
    await page.getByRole('heading', { name: 'New Document' }).click();

    // Editor should load
    const editor = page.locator('.folio-prose .ProseMirror');
    await expect(editor).toBeVisible();

    // Focus and type text
    await editor.click();
    await page.keyboard.type('Hello Folio Local Office');

    // Select text and click Bold in ribbon
    await page.keyboard.press('Control+A');
    const boldBtn = page.locator('button[title*="Bold"]');
    await boldBtn.click();

    // Verify <strong> tag exists in the editor DOM
    const boldText = editor.locator('strong');
    await expect(boldText).toContainText('Hello Folio Local Office');

    // Status bar / Ribbon should show unsaved changes
    await expect(page.getByText('Unsaved changes').first()).toBeVisible();
  });

  test('3. Opens fixture DOCX and displays imported content', async ({ page }) => {
    await page.goto('/');

    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/sample.docx');
    await page.setInputFiles('[data-testid="global-file-input"]', fixturePath);

    // Document editor should be displayed
    const editor = page.locator('.folio-prose .ProseMirror');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Verify imported text
    await expect(editor).toContainText('Executive Summary');
    await expect(editor.locator('strong')).toContainText('bold statement');
  });

  test('4. Opens fixture XLSX and displays spreadsheet grid', async ({ page }) => {
    await page.goto('/');

    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/sample.xlsx');
    await page.setInputFiles('[data-testid="global-file-input"]', fixturePath);

    // Spreadsheet workspace should be displayed
    const sheetContainer = page.locator('.folio-spreadsheet-container');
    await expect(sheetContainer).toBeVisible({ timeout: 10000 });

    // Status bar should indicate spreadsheet mode
    await expect(page.getByText(/Spreadsheet · \d+ sheet/i)).toBeVisible();
  });

  test('5. Opens fixture PPTX and displays presentation editor', async ({ page }) => {
    await page.goto('/');

    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/sample.pptx');
    await page.setInputFiles('[data-testid="global-file-input"]', fixturePath);

    // Slides workspace should be displayed
    const slidesWorkspace = page.locator('.folio-slides-workspace');
    await expect(slidesWorkspace).toBeVisible({ timeout: 10000 });

    // Slide canvas should contain presentation title
    const canvas = page.locator('.folio-slide-canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas).toContainText('Folio Presentation Deck');
  });
});
