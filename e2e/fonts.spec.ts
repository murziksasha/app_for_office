import { test, expect } from '@playwright/test';

test.describe('Font library', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('folio_ui_lang', 'en');
    });
  });

  test('opens the document font picker and dismisses it with Escape', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'New Document' }).click();
    const picker = page.getByTestId('font-picker');
    await expect(picker).toBeVisible();
    await expect(picker).toContainText('Noto Serif');
    await picker.click();
    const menu = page.getByTestId('font-picker-menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Serif' })).toBeVisible();
    await page.keyboard.type('noto');
    await expect(menu.getByText('Search fonts: noto')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(page.locator('.ProseMirror')).toBeVisible();
  });

  test('uses Noto Sans for a new spreadsheet', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'New Spreadsheet' }).click();
    await expect(page.getByTestId('font-picker')).toContainText('Noto Sans');
  });

  test('uses Noto Sans for a new presentation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'New Presentation' }).click();
    await expect(page.getByTestId('font-picker')).toContainText('Noto Sans');
  });

  test('keeps document selection, Ukrainian labels, dark theme, and a short window', async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 640 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Українська' }).click();
    await page.getByTestId('start-settings-button').click();
    await page.getByTestId('theme-dark').click();
    await expect(page.getByTestId('settings-fonts')).toContainText('Шрифти');
    await page.getByTestId('settings-close-button').click();
    await page.getByRole('heading', { name: 'Новий документ' }).click();
    const editor = page.locator('.folio-prose .ProseMirror');
    await editor.click();
    await page.keyboard.type('Вибір шрифту');
    await page.keyboard.press('Control+A');
    await page.getByTestId('font-picker').click();
    await expect(page.getByTestId('font-picker-menu').getByRole('button', { name: 'Усі' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('button[title*="Жирний"]').click();
    await expect(editor.locator('strong')).toContainText('Вибір шрифту');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('lists fonts in Settings and keeps built-in families read-only', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('start-settings-button').click();
    const section = page.getByTestId('settings-fonts');
    await expect(section).toBeVisible();
    await expect(section.getByTestId('settings-font-import')).toBeVisible();
    await expect(section.getByText('Built-in families stay in Folio and cannot be removed.')).toBeVisible();
    await expect(section.getByRole('button', { name: 'Remove' })).toHaveCount(0);
  });
});
