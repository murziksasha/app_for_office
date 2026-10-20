import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Folio Smoke Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('folio_ui_lang', 'en');
    });
  });

  test('1. Loads app and verifies start screen', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Folio/i);
    await expect(page.getByRole('heading', { name: 'Folio' })).toBeVisible();
    await expect(page.getByText('Local-first office suite')).toBeVisible();

    await expect(page.getByRole('heading', { name: 'New Document' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New Spreadsheet' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New Presentation' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Open Existing' })).toBeVisible();
    await expect(page.getByText('Open from this computer')).toBeVisible();
    await expect(page.getByText(/drag file here/i)).toHaveCount(0);
    await expect(page.getByText(/\.tmdx, \.pmdx, \.prdx/)).toBeVisible();
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

    // Home instrument groups are labeled
    const ribbon = page.locator('.folio-ribbon');
    for (const caption of ['Clipboard', 'Font', 'Paragraph', 'Styles']) {
      await expect(ribbon.locator('.folio-ribbon-caption', { hasText: caption })).toBeVisible();
    }

    // Select text and click Bold in ribbon
    await page.keyboard.press('Control+A');
    const boldBtn = page.locator('button[title*="Bold"]');
    await boldBtn.click();

    // Verify <strong> tag exists in the editor DOM
    const boldText = editor.locator('strong');
    await expect(boldText).toContainText('Hello Folio Local Office');

    await ribbon.getByRole('button', { name: 'Find' }).click();
    await expect(page.getByText('Find & Replace')).toBeVisible();

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

    // Folio ribbon replaces FortuneSheet's toolbar
    await expect(page.locator('.fortune-toolbar')).toHaveCount(0);
    const ribbon = page.locator('.folio-ribbon');
    await expect(ribbon.locator('.folio-ribbon-caption', { hasText: 'Font' })).toBeVisible();
    await expect(ribbon.locator('.folio-ribbon-caption', { hasText: 'Number' })).toBeVisible();
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

  test('5b. New slide from the ribbon adds a thumbnail', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'New Presentation' }).click();
    await expect(page.getByText('SLIDES (1)')).toBeVisible();
    await page.locator('.folio-ribbon').getByRole('button', { name: 'New slide' }).click();
    await expect(page.getByText('SLIDES (2)')).toBeVisible();
  });

  test('6. Opens a second tab without a prompt and closes a dirty tab', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'New Document' }).click();

    const editor = page.locator('.folio-prose .ProseMirror');
    await editor.click();
    await page.keyboard.type('First file');
    await expect(page.getByText('Unsaved changes').first()).toBeVisible();

    await page.keyboard.press('Control+n');
    await expect(page.getByTestId('tab-strip').getByRole('button', { name: 'Document2.docx', exact: true })).toBeVisible();
    await expect(page.getByTestId('choice-dialog')).toHaveCount(0);

    await page.getByRole('button', { name: 'Close Document2.docx' }).click();
    await expect(page.getByTestId('choice-dialog')).toHaveCount(0);
    await expect(editor).toContainText('First file');

    await page.getByRole('button', { name: 'Close Document1.docx' }).click();
    const dialog = page.getByTestId('choice-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('choice-Save')).toBeVisible();
    await expect(dialog.getByTestId("choice-Don't save")).toBeVisible();
    await expect(dialog.getByTestId('choice-Cancel')).toBeVisible();

    await dialog.getByTestId('choice-Cancel').click();
    await expect(editor).toContainText('First file');
    await expect(page.getByTestId('tab-strip')).toBeVisible();

    await page.getByRole('button', { name: 'Close Document1.docx' }).click();
    await page.getByTestId('choice-dialog').getByTestId("choice-Don't save").click();
    await expect(page.getByRole('heading', { name: 'Folio' })).toBeVisible();
    await expect(page.getByTestId('tab-strip')).toHaveCount(0);
  });

  test('7. Ctrl+S on a new dirty document downloads it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'New Document' }).click();
    const editor = page.locator('.folio-prose .ProseMirror');
    await editor.click();
    await page.keyboard.type('Save me');
    await page.evaluate(() => {
      delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
    });
    await page.keyboard.press('Control+s');
    await expect(page.getByRole('heading', { name: 'Save As' })).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.animate-fade-in').getByRole('button', { name: 'Save' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Document1.docx');
  });

  test('8. Opens Home tab from file-tab +, creates a second file, and closes Home', async ({ page }) => {
    await page.goto('/');

    // Create a document
    await page.getByRole('heading', { name: 'New Document' }).click();
    await expect(page.getByRole('button', { name: 'Document1.docx', exact: true })).toBeVisible();

    // Click +
    await page.getByTestId('tab-new').click();

    // See the Home chip and "New Document" while the document chip remains
    await expect(page.getByTestId('tab-home')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New Document' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Document1.docx', exact: true })).toBeVisible();

    // Create a spreadsheet from that screen
    await page.getByRole('heading', { name: 'New Spreadsheet' }).click();

    // Land in the spreadsheet with both file chips and Home still present
    await expect(page.locator('.folio-spreadsheet-container')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Document1.docx', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Workbook1.xlsx', exact: true })).toBeVisible();
    await expect(page.getByTestId('tab-home')).toBeVisible();

    // Close Home
    await page.getByRole('button', { name: 'Close Home' }).click();

    // Confirm the spreadsheet is still there
    await expect(page.locator('.folio-spreadsheet-container')).toBeVisible();
    await expect(page.getByTestId('tab-home')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Workbook1.xlsx', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Document1.docx', exact: true })).toBeVisible();

    // The existing last-tab close still expects no chip row
    await page.getByRole('button', { name: 'Close Workbook1.xlsx' }).click();
    await page.getByRole('button', { name: 'Close Document1.docx' }).click();
    await expect(page.getByRole('heading', { name: 'Folio' })).toBeVisible();
    await expect(page.getByTestId('tab-strip')).toHaveCount(0);
  });

  test('collapses the ribbon, keeps it collapsed after reload, then expands from the tab', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'New Document' }).click();
    const ribbon = page.locator('.folio-ribbon');
    await expect(ribbon.getByText('Clipboard')).toBeVisible();
    await ribbon.getByRole('button', { name: 'Collapse the ribbon' }).click();
    await expect(ribbon.getByText('Clipboard')).toHaveCount(0);
    await expect(ribbon.getByRole('button', { name: 'Home', exact: true })).toBeVisible();

    await page.reload();
    await page.getByRole('heading', { name: 'New Document' }).click();
    await expect(ribbon.getByText('Clipboard')).toHaveCount(0);
    await ribbon.getByRole('button', { name: 'Home', exact: true }).click();
    await expect(ribbon.getByText('Clipboard')).toBeVisible();
  });

  test('switches to Ukrainian without changing document text', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'New Document' }).click();
    const editor = page.locator('.folio-prose .ProseMirror');
    await editor.click();
    await page.keyboard.type('Hello Folio Local Office');
    await page.getByRole('button', { name: 'Українська' }).click();
    await expect(page.locator('.folio-ribbon').getByRole('button', { name: 'Основне' })).toBeVisible();
    await expect(page.locator('.folio-ribbon').getByRole('button', { name: 'Зберегти' }).first()).toBeVisible();
    await expect(editor).toContainText('Hello Folio Local Office');
  });

  test('opens a drop on the Home box and ignores a drop outside it', async ({ page }) => {
    await page.goto('/');
    const fixture = fs.readFileSync(path.resolve(import.meta.dirname, '../fixtures/sample.md'), 'utf8');
    const opened = await page.evaluate(async (body) => {
      const file = new File([body], 'sample.md', { type: 'text/markdown' });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const box = document.querySelector('[data-folio-drop-target]');
      if (!box) return false;
      box.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      box.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      return true;
    }, fixture);
    expect(opened).toBe(true);
    await expect(page.getByRole('button', { name: 'sample.md', exact: true })).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const file = new File(['outside'], 'outside.md', { type: 'text/markdown' });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      document.body.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
    await expect(page.getByRole('button', { name: 'outside.md', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'sample.md', exact: true })).toBeVisible();
  });

  test('opens a drop on the Home recent list', async ({ page }) => {
    await page.goto('/');
    const fixture = fs.readFileSync(path.resolve(import.meta.dirname, '../fixtures/sample.md'), 'utf8');
    const opened = await page.evaluate(async (body) => {
      const file = new File([body], 'recent-drop.md', { type: 'text/markdown' });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const recent = document.querySelector('[data-folio-recent]');
      if (!recent) return false;
      recent.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      recent.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      return true;
    }, fixture);
    expect(opened).toBe(true);
    await expect(page.getByRole('button', { name: 'recent-drop.md', exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('moves the left page margin from the ruler and undoes it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'New Document' }).click();
    const prose = page.locator('.folio-prose .ProseMirror');
    await expect(prose).toBeVisible();
    const before = await prose.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
    const slider = page.getByRole('slider', { name: 'Left margin' });
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => prose.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft))).toBeGreaterThan(before);
    await page.getByRole('button', { name: 'Layout', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Left margin' })).toHaveValue('1.04');
    await prose.click();
    await page.keyboard.press('Control+z');
    await expect.poll(async () => prose.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft))).toBeLessThan(before + 1);
    await expect(page.getByRole('textbox', { name: 'Left margin' })).toHaveValue('1.00');
  });
});
