import { test, expect } from '@playwright/test';

test.describe('Presentation Tools E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('folio_ui_lang', 'en');
    });
  });

  test('Starts slideshow, navigates forward and back, and exits with Escape', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('heading', { name: 'New Presentation' }).click();
    await expect(page.locator('.folio-ribbon')).toBeVisible();

    // Add a second slide using ribbon "New Slide"
    const newSlideBtn = page.locator('.folio-ribbon').getByRole('button', { name: 'New Slide' }).first();
    await expect(newSlideBtn).toBeVisible();
    await newSlideBtn.click();

    // Verify "From Beginning" button exists in ribbon
    const fromBeginningBtn = page.locator('.folio-ribbon').getByRole('button', { name: 'From Beginning' });
    await expect(fromBeginningBtn).toBeVisible();

    // Click From Beginning
    await fromBeginningBtn.click();

    // Slideshow overlay should appear
    const slideshow = page.locator('[data-testid="folio-slideshow"]');
    await expect(slideshow).toBeVisible();

    // Check slide indicator shows slide 1 of 2
    await expect(slideshow).toContainText('1 / 2');

    // Clicking right half of slideshow advances to slide 2
    const box = await slideshow.boundingBox();
    if (!box) throw new Error('slideshow has no bounding box');

    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.5);
    await expect(slideshow).toContainText('2 / 2');

    // Clicking left half steps back to slide 1
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.5);
    await expect(slideshow).toContainText('1 / 2');

    // Press ArrowRight to advance to slide 2
    await page.keyboard.press('ArrowRight');
    await expect(slideshow).toContainText('2 / 2');

    // Press Escape to exit slideshow
    await page.keyboard.press('Escape');
    await expect(slideshow).not.toBeVisible();
  });

  test('F5 starts slideshow from beginning, Shift+F5 from current slide', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('heading', { name: 'New Presentation' }).click();
    const newSlideBtn = page.locator('.folio-ribbon').getByRole('button', { name: 'New Slide' }).first();
    await newSlideBtn.click(); // Now on slide 2

    // Press F5 to start from beginning
    await page.keyboard.press('F5');
    const slideshow = page.locator('[data-testid="folio-slideshow"]');
    await expect(slideshow).toBeVisible();
    await expect(slideshow).toContainText('1 / 2');

    // Exit with Escape
    await page.keyboard.press('Escape');
    await expect(slideshow).not.toBeVisible();

    // Press Shift+F5 to start from current slide (slide 2)
    await page.keyboard.press('Shift+F5');
    await expect(slideshow).toBeVisible();
    await expect(slideshow).toContainText('2 / 2');

    // Exit with exit button
    const exitBtn = page.locator('[data-testid="folio-slideshow-exit"]');
    await exitBtn.click();
    await expect(slideshow).not.toBeVisible();
  });

  test('Slide object context menu has Bring Forward and Send Backward, ribbon aligns', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'New Presentation' }).click();

    // Default slide has Title text box. Let's right-click it.
    const titleBox = page.locator('.folio-slide-canvas div[style*="position: absolute"]').first();
    await expect(titleBox).toBeVisible();
    await titleBox.click({ button: 'right' });

    // Verify context menu shows Duplicate, Delete, Bring Forward, Send Backward
    const menu = page.locator('.folio-context-menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Bring Forward' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Send Backward' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeVisible();

    // Dismiss context menu
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();

    // Test Ribbon Arrange Align Left button
    const alignLeftBtn = page.locator('.folio-ribbon').getByRole('button', { name: 'Align Left' }).last();
    await expect(alignLeftBtn).toBeVisible();
    await alignLeftBtn.click();
    await expect(titleBox).toHaveCSS('left', '0px');
  });

  test('Selects Two Content layout from New Slide dropdown, creating 3 elements', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'New Presentation' }).click();

    // Click layout dropdown button
    const layoutDropdown = page.locator('[data-testid="folio-slide-layout-dropdown"]');
    await expect(layoutDropdown).toBeVisible();
    await layoutDropdown.click();

    // Menu opens
    const menu = page.locator('[data-testid="folio-slide-layout-menu"]');
    await expect(menu).toBeVisible();

    // Click Two Content layout
    const twoContentBtn = page.locator('[data-testid="folio-layout-twoContent"]');
    await expect(twoContentBtn).toBeVisible();
    await twoContentBtn.click();

    // Assert menu closed
    await expect(menu).not.toBeVisible();

    // Verify slide 2 has 3 elements on canvas
    const elements = page.locator('.folio-slide-canvas > div[style*="position: absolute"]');
    await expect(elements).toHaveCount(3);
  });

  test('Slide Sorter view toggles and navigates, View ribbon applies palettes', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'New Presentation' }).click();

    // Add a second slide
    const newSlideBtn = page.locator('.folio-ribbon').getByRole('button', { name: 'New Slide' }).first();
    await newSlideBtn.click();

    // Switch to View tab
    const viewTab = page.locator('.folio-ribbon').getByRole('button', { name: 'View' });
    await viewTab.click();

    // Click Slide Sorter
    const sorterBtn = page.locator('.folio-ribbon').getByRole('button', { name: 'Slide Sorter' });
    await expect(sorterBtn).toBeVisible();
    await sorterBtn.click();

    // Verify Sorter is visible with 2 slide cards
    const sorter = page.locator('[data-testid="folio-slide-sorter"]');
    await expect(sorter).toBeVisible();
    await expect(page.locator('[data-testid="sorter-slide-0"]')).toBeVisible();
    const slide1Card = page.locator('[data-testid="sorter-slide-1"]');
    await expect(slide1Card).toBeVisible();

    // Click slide 1 (the second slide) to select it and return to normal view
    await slide1Card.click();
    await expect(sorter).not.toBeVisible();

    // Sorter button now shows "Slide Sorter" again
    // In View tab, click Teal palette
    const tealBtn = page.locator('.folio-ribbon').getByRole('button', { name: 'Teal' });
    await expect(tealBtn).toBeVisible();
    await tealBtn.click();

    // Slide canvas background should be updated to teal (#f0fdfa / rgb(240, 253, 250))
    const canvas = page.locator('.folio-slide-canvas');
    await expect(canvas).toHaveCSS('background-color', 'rgb(240, 253, 250)');

    // Click Ink palette
    const inkBtn = page.locator('.folio-ribbon').getByRole('button', { name: 'Ink' });
    await inkBtn.click();
    await expect(canvas).toHaveCSS('background-color', 'rgb(30, 32, 34)');
  });
});
