import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Presentation Editing Tools Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('folio_ui_lang', 'en');
    });
  });

  test('new Presentation, switch to 4:3, insert oval and table, type notes, duplicate slide, verify thumbnail aspect and notes copy, open sample.pptx', async ({ page }) => {
    await page.goto('http://localhost:5188/');

    // 1. Click New Presentation
    await page.getByRole('heading', { name: 'New Presentation' }).click();

    const canvas = page.locator('.folio-slide-canvas');
    await expect(canvas).toBeVisible();

    // Default canvas aspect: 960x540
    let box = await canvas.boundingBox();
    expect(box?.width).toBe(960);
    expect(box?.height).toBe(540);

    // 2. Switch to 4:3 in Ribbon Home Slides group
    const sizeSelect = page.locator('select[title="Slide size"]');
    await expect(sizeSelect).toBeVisible();
    await sizeSelect.selectOption('4:3');

    // Canvas should now be 960x720
    box = await canvas.boundingBox();
    expect(box?.width).toBe(960);
    expect(box?.height).toBe(720);

    // Verify thumbnail aspect ratio
    const thumbnail = page.locator('.folio-slides-sidebar div[style*="aspect-ratio"]').first();
    const styleAttr = await thumbnail.getAttribute('style');
    expect(styleAttr).toContain('aspect-ratio: 4 / 3');

    // 3. Switch to Insert tab
    await page.getByRole('button', { name: 'Insert' }).click();

    // Insert Oval
    const ovalBtn = page.locator('button[title="Oval"]');
    await expect(ovalBtn).toBeVisible();
    await ovalBtn.click();

    // Verify oval is on canvas
    const ovalElem = canvas.locator('div[style*="border-radius: 50%"]');
    await expect(ovalElem).toBeVisible();

    // Insert Table
    const tableBtn = page.locator('button[title*="Table"]');
    await expect(tableBtn).toBeVisible();
    await tableBtn.click();

    // Verify table is on canvas
    const tableElem = canvas.locator('table');
    await expect(tableElem).toBeVisible();

    // 4. Type notes
    const notesTextarea = page.locator('textarea[placeholder="Click to add notes..."]');
    await expect(notesTextarea).toBeVisible();
    await notesTextarea.fill('Key presentation speaker notes for slide 1');

    // 5. Switch back to Home tab and duplicate the slide
    await page.getByRole('button', { name: 'Home' }).click();
    const duplicateBtn = page.locator('button[title="Duplicate slide"]');
    await expect(duplicateBtn).toBeVisible();
    await duplicateBtn.click();

    // Verify 2 slides now
    await expect(page.locator('.folio-slides-sidebar')).toContainText('Slide 2');

    // Verify second slide has the copied notes
    await expect(notesTextarea).toHaveValue('Key presentation speaker notes for slide 1');

    // Verify thumbnail aspect for slide 2 as well
    const thumbnail2 = page.locator('.folio-slides-sidebar div[style*="aspect-ratio"]').nth(1);
    const styleAttr2 = await thumbnail2.getAttribute('style');
    expect(styleAttr2).toContain('aspect-ratio: 4 / 3');

    // 6. Open fixtures/sample.pptx and confirm title slide renders
    const fixturePath = path.resolve(process.cwd(), 'fixtures/sample.pptx');
    await page.setInputFiles('[data-testid="global-file-input"]', fixturePath);

    // Switch to sample.pptx tab if needed
    const sampleTab = page.getByRole('button', { name: 'sample.pptx', exact: true });
    await expect(sampleTab).toBeVisible({ timeout: 10000 });
    await sampleTab.click();

    // Confirm existing title slide still renders
    const sampleCanvas = page.locator('.folio-slide-canvas');
    await expect(sampleCanvas).toBeVisible({ timeout: 10000 });
    await expect(sampleCanvas).toContainText('Folio Presentation Deck');
    await expect(sampleCanvas).toContainText('A modern local-first office suite.');
  });
});
