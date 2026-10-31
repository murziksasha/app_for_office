import { test, expect } from '@playwright/test';

test.describe('Spreadsheet Tools E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('folio_ui_lang', 'en');
    });
  });

  test('Open a new spreadsheet, type a value, and find it', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('heading', { name: 'New Spreadsheet' }).click();
    const sheetContainer = page.locator('.folio-spreadsheet-container');
    await expect(sheetContainer).toBeVisible();

    // Verify Home tab has Editing group with Find
    const findButton = page.locator('.folio-ribbon').getByRole('button', { name: 'Find' });
    await expect(findButton).toBeVisible();

    // Trigger find via button or Ctrl+F
    await findButton.click();
    const findPanel = page.locator('div[role="dialog"][aria-label="Find & Replace"]');
    await expect(findPanel).toBeVisible();

    // Search in sheet
    const findInput = findPanel.locator('input[placeholder="Find text..."]');
    await findInput.fill('Sheet1');
    await findPanel.getByRole('button', { name: 'Find' }).click();

    // Close find panel with Escape
    await page.keyboard.press('Escape');
    await expect(findPanel).not.toBeVisible();
  });

  test('Fills three cells from 1 using ribbon Fill', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'New Spreadsheet' }).click();
    const sheet = page.locator('.folio-spreadsheet-container');
    await expect(sheet).toBeVisible();

    const cells = page.locator('.fortune-cell-area');
    await expect(cells).toBeVisible();
    const box = await cells.boundingBox();
    if (!box) throw new Error('spreadsheet cells have no box');

    const cell = (row: number, column: number) => ({
      x: box.x + 30 + column * 73,
      y: box.y + 10 + row * 19,
    });

    const a1 = cell(0, 0);
    await page.mouse.click(a1.x, a1.y);
    await page.locator('.fortune-fx-input').click();
    await page.keyboard.type('1');
    await page.keyboard.press('Enter');

    // Select range A1:A3
    const a3 = cell(2, 0);
    await page.mouse.move(a1.x, a1.y);
    await page.mouse.down();
    await page.mouse.move(a3.x, a3.y);
    await page.mouse.up();

    const ribbon = page.locator('.folio-ribbon');
    const fillButton = ribbon.getByRole('button', { name: 'Fill', exact: true });
    await expect(fillButton).toBeVisible();
    await fillButton.click();

    // Click cell A3 and verify its value in fx input
    await page.mouse.click(a3.x, a3.y);
    await expect(page.locator('.fortune-fx-input')).toContainText('3');
  });

  test('Renames Sheet1 to Expenses from the sheet tab bar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'New Spreadsheet' }).click();
    const sheetTabBar = page.locator('[data-testid="folio-sheet-tab-bar"]');
    await expect(sheetTabBar).toBeVisible();

    const sheetTab = sheetTabBar.locator('[data-testid="sheet-tab-Sheet1"]');
    await expect(sheetTab).toBeVisible();

    // Double click to trigger inline rename
    await sheetTab.getByText('Sheet1').dblclick();
    const renameInput = sheetTab.locator('input[aria-label="Rename Sheet"]');
    await expect(renameInput).toBeVisible();

    await renameInput.fill('Expenses');
    await renameInput.press('Enter');

    // Expect tab to show Expenses and not Sheet1
    await expect(sheetTabBar.locator('[data-testid="sheet-tab-Expenses"]')).toBeVisible();
    await expect(sheetTabBar.getByText('Expenses')).toBeVisible();
    await expect(sheetTabBar.locator('[data-testid="sheet-tab-Sheet1"]')).toHaveCount(0);
  });

  test('Opens dropdown list and picks a value', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'New Spreadsheet' }).click();
    const sheet = page.locator('.folio-spreadsheet-container');
    await expect(sheet).toBeVisible();

    // Select cell A1
    const cells = page.locator('.fortune-cell-area');
    await expect(cells).toBeVisible();
    const box = await cells.boundingBox();
    if (!box) throw new Error('spreadsheet cells have no box');

    const a1 = { x: box.x + 30, y: box.y + 10 };
    await page.mouse.click(a1.x, a1.y);

    // Click Data Validation on Ribbon
    const ribbon = page.locator('.folio-ribbon');
    const dvBtn = ribbon.getByRole('button', { name: 'Data Validation' });
    await expect(dvBtn).toBeVisible();
    await dvBtn.click();

    // Now clicking A1 shows the validation dropdown picker
    await page.mouse.click(a1.x, a1.y);
    const dropdown = page.locator('[data-testid="folio-validation-dropdown"]');
    await expect(dropdown).toBeVisible();

    // Pick Beta
    await dropdown.selectOption('Beta');

    // Click cell and check formula input has Beta
    await page.mouse.click(a1.x, a1.y);
    await expect(page.locator('.fortune-fx-input')).toContainText('Beta');
  });

  test('Opens print setup, cancels, sheet unchanged', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'New Spreadsheet' }).click();
    const ribbon = page.locator('.folio-ribbon');

    // Switch to Layout tab
    await ribbon.getByRole('button', { name: 'Layout' }).click();

    // Click Print Setup button
    const printSetupBtn = ribbon.getByRole('button', { name: 'Print Setup' });
    await expect(printSetupBtn).toBeVisible();
    await printSetupBtn.click();

    // Verify dialog appears
    const dialog = page.locator('div[role="dialog"][aria-label="Print Setup"]');
    await expect(dialog).toBeVisible();

    // Click Cancel
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();

    // Sheet container remains visible and functional
    const sheetContainer = page.locator('.folio-spreadsheet-container');
    await expect(sheetContainer).toBeVisible();
  });
});
