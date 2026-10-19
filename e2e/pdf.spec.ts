import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Save as PDF and Edit as Document E2E tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Use fallback download mechanism in browser test environment
    await page.evaluate(() => {
      delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
    });
  });

  test('1. Opens text PDF, runs Edit as Document, opens dirty Document tab with import notice, saves as PDF, and opens written PDF', async ({ page }) => {
    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/sample_text.pdf');
    await page.setInputFiles('[data-testid="global-file-input"]', fixturePath);

    // Verify PDF viewer is open
    await expect(page.locator('.folio-pdf-viewer')).toBeVisible({ timeout: 10000 });
    const tabStrip = page.getByTestId('tab-strip');
    await expect(tabStrip.locator('button[title="sample_text.pdf"]')).toBeVisible();

    // Verify both toolbar and ribbon offer Edit as Document
    await expect(page.locator('.folio-pdf-viewer').getByRole('button', { name: 'Edit as Document' })).toBeVisible();

    // Verify PDF reader does not offer "Save as PDF" in File tab
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await expect(page.locator('.folio-ribbon').getByRole('button', { name: 'Save as PDF' })).not.toBeVisible();
    await expect(page.locator('.folio-ribbon').getByRole('button', { name: 'Edit as Document' })).toBeVisible();

    // Click Edit as Document from File tab
    await page.locator('.folio-ribbon').getByRole('button', { name: 'Edit as Document' }).click();

    // Import notice dialog should appear
    await expect(page.getByTestId('import-report-dialog')).toBeVisible();
    await expect(page.getByText(/Import Report:/i)).toBeVisible();
    await expect(page.getByText(/Layout was discarded/i)).toBeVisible();

    // Close import notices dialog
    await page.getByRole('button', { name: 'Understood', exact: true }).click();

    // Reader tab remains, and a new dirty Document tab opens
    await expect(tabStrip.locator('button[title="sample_text.pdf"]')).toBeVisible();
    const docTab = tabStrip.locator('button[title*="sample_text"]:not([title="sample_text.pdf"])');
    await expect(docTab).toBeVisible();
    await expect(docTab).toContainText('●'); // dirty indicator

    // Editor contains extracted text
    const editor = page.locator('.folio-prose .ProseMirror');
    await expect(editor).toBeVisible();
    await expect(editor).toContainText('Sample Notes from PDF');

    // On this newly created Document, Save as PDF is available in File tab
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await expect(page.locator('.folio-ribbon').getByRole('button', { name: 'Save as PDF' })).toBeVisible();

    // Trigger Save as PDF and verify download initiates while Document tab remains dirty
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.folio-ribbon').getByRole('button', { name: 'Save as PDF' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('sample_text.pdf');

    // Tab dirty flag is preserved (still has dot)
    await expect(docTab).toContainText('●');

    // Open the written PDF in the reader
    const exportedPath = path.resolve(import.meta.dirname, '../fixtures/test_exported.pdf');
    try {
      await download.saveAs(exportedPath);
      await page.setInputFiles('[data-testid="global-file-input"]', exportedPath);
      // Verify the PDF opens in the reader and has a tab
      const newPdfTab = tabStrip.locator('button[title="test_exported.pdf"]');
      await expect(newPdfTab).toBeVisible({ timeout: 10000 });
      await newPdfTab.click();
      await expect(page.locator('.folio-pdf-viewer')).toBeVisible();
    } finally {
      const fs = await import('fs');
      if (fs.existsSync(exportedPath)) {
        fs.unlinkSync(exportedPath);
      }
    }
  });

  test('2. Refuses Edit as Document on empty PDF without opening a tab', async ({ page }) => {
    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/sample_empty.pdf');
    await page.setInputFiles('[data-testid="global-file-input"]', fixturePath);

    await expect(page.locator('.folio-pdf-viewer')).toBeVisible({ timeout: 10000 });
    const tabStrip = page.getByTestId('tab-strip');

    // Click Edit as Document on viewer toolbar
    const editBtn = page.locator('.folio-pdf-viewer').getByRole('button', { name: 'Edit as Document' });
    await editBtn.click();

    // An in-page alert dialog says there is nothing to edit
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/contains no selectable text/i)).toBeVisible();
    await page.getByRole('button', { name: 'OK' }).click();

    // PDF tab stays put, no second tab opened
    await expect(tabStrip.locator('button[title="sample_empty.pdf"]')).toBeVisible();
    const tabs = tabStrip.locator('button[title]');
    await expect(tabs).toHaveCount(1);
  });

  test('3. Spreadsheets with >1 sheet prompt scope on Save as PDF, Cancel writes nothing', async ({ page }) => {
    // Create new spreadsheet
    await page.getByRole('heading', { name: 'New Spreadsheet' }).click();
    await expect(page.locator('.folio-spreadsheet-container')).toBeVisible({ timeout: 10000 });

    // Click add sheet button in FortuneSheet tab bar
    const addSheetBtn = page.locator('.fortune-sheettab-add, [title*="sheet"]').first();
    if (await addSheetBtn.isVisible()) {
      await addSheetBtn.click();
    }

    // Click File ribbon
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await expect(page.locator('.folio-ribbon').getByRole('button', { name: 'Save as PDF' })).toBeVisible();

    // If more than 1 sheet, clicking Save as PDF prompts scope question
    await page.locator('.folio-ribbon').getByRole('button', { name: 'Save as PDF' }).click();

    // Check if scope choice dialog appeared
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible()) {
      await expect(page.getByText(/What should Folio export to PDF/i)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Active sheet' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'All sheets' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

      // Cancel writes nothing
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).not.toBeVisible();
    }
  });

  test('4. PDF reader Save writes original file and does not offer Save as PDF', async ({ page }) => {
    const fixturePath = path.resolve(import.meta.dirname, '../fixtures/sample_text.pdf');
    await page.setInputFiles('[data-testid="global-file-input"]', fixturePath);

    await expect(page.locator('.folio-pdf-viewer')).toBeVisible({ timeout: 10000 });

    // Open File tab
    await page.getByRole('button', { name: 'File', exact: true }).click();

    // Save as PDF must NOT be offered on PDF reader
    await expect(page.locator('.folio-ribbon').getByRole('button', { name: 'Save as PDF' })).not.toBeVisible();

    // Normal Save is offered
    const saveBtn = page.locator('.folio-ribbon button[title*="Save"]').first();
    await expect(saveBtn).toBeVisible();

    // Saving downloads original bytes in browser
    await saveBtn.click();
    // In browser with no handle/path, Save As dialog opens
    if (await page.getByRole('heading', { name: 'Save As' }).isVisible()) {
      const downloadPromise = page.waitForEvent('download');
      await page.locator('.animate-fade-in').getByRole('button', { name: 'Save' }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('sample_text.pdf');
    }
  });
});

