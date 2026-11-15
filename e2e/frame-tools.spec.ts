import { test, expect } from '@playwright/test';

test.describe('Wave 5 — Office Frame Tools E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('folio_ui_lang', 'en');
    });
  });

  test('Backstage opens from File tab, shows statistics, and closes with Back button and Escape', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('heading', { name: 'New Document' }).click();
    const editor = page.locator('.folio-prose .ProseMirror');
    await expect(editor).toBeVisible();

    // Type text into editor
    await editor.click();
    await page.keyboard.type('Hello Office Frame Backstage');

    // Click File tab on ribbon
    const fileTab = page.locator('.folio-ribbon').getByRole('button', { name: 'File', exact: true });
    await expect(fileTab).toBeVisible();
    await fileTab.click();

    // Backstage overlay appears
    const backstage = page.locator('[data-testid="folio-backstage"]');
    await expect(backstage).toBeVisible();

    // Check Info section shows word count and format
    const wordsStat = backstage.locator('[data-testid="backstage-stat-words"]');
    await expect(wordsStat).toBeVisible();
    await expect(wordsStat).toContainText('4'); // "Hello Office Frame Backstage" = 4 words

    const formatBadge = backstage.locator('[data-testid="backstage-info-format"]');
    await expect(formatBadge).toContainText('DOCX');

    // Click Back button to return to document
    const backBtn = backstage.locator('[data-testid="folio-backstage-back"]');
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    // Backstage closed, editor visible with text
    await expect(backstage).not.toBeVisible();
    await expect(editor).toContainText('Hello Office Frame Backstage');

    // Open File again and test Escape closes it
    await fileTab.click();
    await expect(backstage).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(backstage).not.toBeVisible();
  });

  test('Backstage New section creates a template as a dirty untitled document', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'New Document' }).click();

    // Open Backstage
    await page.locator('.folio-ribbon').getByRole('button', { name: 'File', exact: true }).click();
    const backstage = page.locator('[data-testid="folio-backstage"]');
    await expect(backstage).toBeVisible();

    // Switch to New section
    const navNew = backstage.locator('[data-testid="backstage-nav-new"]');
    await navNew.click();

    // Click Project Report template
    const reportTpl = backstage.locator('[data-testid="backstage-template-doc-report"]');
    await expect(reportTpl).toBeVisible();
    await reportTpl.click();

    // Backstage closed, a new tab opened
    await expect(backstage).not.toBeVisible();

    // Verify document contains template contents
    const editor = page.locator('.folio-prose .ProseMirror');
    await expect(editor).toContainText('Project Status Report');
    await expect(editor).toContainText('Executive Summary');
    await expect(editor).toContainText('Action Items');

    // Verify tab is dirty
    const activeTab = page.locator('[data-testid="tab-strip"] button[title*="Document"]').last();
    await expect(activeTab).toContainText('●');
  });

  test('Command search finds commands and executes them', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'New Document' }).click();

    const searchInput = page.locator('[data-testid="folio-command-search-input"]');
    await expect(searchInput).toBeVisible();

    // Type query "bold"
    await searchInput.fill('bold');

    // Results dropdown appears
    const results = page.locator('[data-testid="folio-command-search-results"]');
    await expect(results).toBeVisible();

    const boldItem = page.locator('[data-testid="command-search-item-bold"]');
    await expect(boldItem).toBeVisible();

    // Click Bold command
    await boldItem.click();
    await expect(results).not.toBeVisible();

    // Type text and assert it has bold mark
    const editor = page.locator('.folio-prose .ProseMirror');
    await editor.click();
    await page.keyboard.type('Bold text');
    await expect(page.locator('.folio-prose .ProseMirror strong')).toBeVisible();
  });

  test('Alt key toggles Key Tips, tab letter advances, Escape steps back', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'New Document' }).click();

    // Press Alt to show key tips
    await page.keyboard.press('Alt');

    // Verify badges appear over tabs: F, H, I, L
    const fileBadge = page.locator('[data-testid="keytip-tab-file"]');
    const homeBadge = page.locator('[data-testid="keytip-tab-home"]');
    await expect(fileBadge).toBeVisible();
    await expect(homeBadge).toBeVisible();
    await expect(fileBadge).toHaveText('F');
    await expect(homeBadge).toHaveText('H');

    // Press 'H' to enter Home tab command mode
    await page.keyboard.press('h');

    // Badges over Home commands (e.g. B for Bold) appear
    const boldBadge = page.locator('[data-testid="keytip-command-B"]');
    await expect(boldBadge).toBeVisible();
    await expect(boldBadge).toHaveText('B');

    // Press Escape to step back one level (returns to tab badges)
    await page.keyboard.press('Escape');
    await expect(boldBadge).not.toBeVisible();
    await expect(fileBadge).toBeVisible();

    // Press Escape again to exit key tips completely
    await page.keyboard.press('Escape');
    await expect(fileBadge).not.toBeVisible();
  });
});

