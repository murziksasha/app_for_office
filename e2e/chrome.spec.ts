import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('folio_ui_lang', 'en');
    localStorage.setItem('folio_theme', 'light');
  });
});

test('light and dark themes recolor chrome and leave the page ink', async ({ page }) => {
  for (const [width, height] of [
    [960, 640],
    [1280, 800],
    [1920, 1080],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.getByRole('heading', { name: 'New Document' }).click();
    const editor = page.locator('.folio-prose .ProseMirror');
    await editor.click();
    await page.keyboard.type('Theme sample');
    await expect(page.locator('.folio-ribbon').getByRole('button', { name: 'Home', exact: true })).toBeVisible();
    await expect(page.locator('.folio-ribbon').getByRole('button', { name: 'Find' })).toBeVisible();

    const lightRibbon = await page.locator('.folio-ribbon').evaluate((el) => getComputedStyle(el).backgroundColor);
    const lightInk = await editor.evaluate((el) => getComputedStyle(el).color);
    expect(lightInk).toBe('rgb(31, 35, 40)');

    await page.getByRole('button', { name: 'File', exact: true }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByTestId('theme-dark').click();
    await page.keyboard.press('Escape');

    const darkRibbon = await page.locator('.folio-ribbon').evaluate((el) => getComputedStyle(el).backgroundColor);
    const darkInk = await editor.evaluate((el) => getComputedStyle(el).color);
    expect(darkRibbon).not.toBe(lightRibbon);
    expect(darkInk).toBe(lightInk);
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
    expect(await page.evaluate(() => document.documentElement.dataset.folioKind)).toBe('document');
  }
});

test('spreadsheet and presentation use their accents and one sheet-tab bar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('heading', { name: 'New Spreadsheet' }).click();
  await expect(page.locator('[data-testid="folio-sheet-tab-bar"]')).toBeVisible();
  await expect(page.locator('[data-testid^="sheet-tab-"]')).toHaveCount(1);
  const sheetAccent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--folio-accent').trim());
  expect(sheetAccent).toBe('#107c41');

  await page.getByRole('button', { name: 'New tab' }).click();
  await page.getByRole('heading', { name: 'New Presentation' }).click();
  const slideAccent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--folio-accent').trim());
  expect(slideAccent).toBe('#c43e1c');
  const redo = page.locator('.folio-qa-redo');
  await expect(redo).toBeDisabled();
});
