import { test, expect } from '@playwright/test';

test.describe('Document Tools E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('folio_ui_lang', 'en');
    });
  });

  test('Find and replace on text preserves formatting marks', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('heading', { name: 'New Document' }).click();
    const editor = page.locator('.folio-prose .ProseMirror');
    await expect(editor).toBeVisible();

    await editor.click();
    // Type bold word
    await page.keyboard.press('Control+B');
    await page.keyboard.type('apple');
    await page.keyboard.press('Control+B');
    await page.keyboard.type(' banana');

    // Verify 'apple' is bold and 'banana' is plain
    await expect(editor.locator('strong')).toHaveText('apple');
    await expect(editor.locator('p')).toHaveText('apple banana');

    // Open find with Ctrl+F
    await page.keyboard.press('Control+F');
    const findPanel = page.locator('div[role="dialog"][aria-label="Find & Replace"]');
    await expect(findPanel).toBeVisible();

    // Fill find and replace
    const findInput = findPanel.locator('input[placeholder="Find text..."]');
    const replaceInput = findPanel.locator('input[placeholder="Replace with..."]');

    await findInput.fill('apple');
    await replaceInput.fill('orange');

    // Click Find
    await findPanel.getByRole('button', { name: 'Find' }).click();

    // Click Replace
    await findPanel.getByRole('button', { name: 'Replace', exact: true }).click();

    // Verify 'orange' replaced 'apple' and remained bold, while 'banana' remains plain
    await expect(editor.locator('p')).toHaveText('orange banana');
    await expect(editor.locator('strong')).toHaveText('orange');

    // Close find panel with Escape
    await page.keyboard.press('Escape');
    await expect(findPanel).not.toBeVisible();
  });

  test('Format painter paints bold from one sentence onto another', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('heading', { name: 'New Document' }).click();
    const editor = page.locator('.folio-prose .ProseMirror');
    await expect(editor).toBeVisible();

    await editor.click();
    await page.keyboard.type('Bold sentence.');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Plain sentence.');

    // Select the first sentence with triple click and apply bold
    await editor.locator('p').first().click({ clickCount: 3 });
    await page.keyboard.press('Control+B');
    await expect(editor.locator('strong')).toHaveText('Bold sentence.');

    // Click inside the bold sentence to place caret there
    await editor.locator('p').first().click();

    // Click Format Painter in ribbon
    const painterBtn = page.locator('button[title*="Format Painter"]');
    await expect(painterBtn).toBeVisible();
    await painterBtn.click();

    // Select the second sentence with triple click
    await editor.locator('p').nth(1).click({ clickCount: 3 });

    // Second sentence should now be bold
    await expect(editor.locator('strong').nth(1)).toContainText('Plain sentence.');
  });

  test('Toggles superscript and sees mark active', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('heading', { name: 'New Document' }).click();
    const editor = page.locator('.folio-prose .ProseMirror');
    await expect(editor).toBeVisible();

    await editor.click();
    await page.keyboard.type('mc');

    // Click Superscript button
    const supBtn = page.locator('button[title*="Superscript"]');
    await expect(supBtn).toBeVisible();
    await supBtn.click();

    await page.keyboard.type('2');

    // Verify <sup> tag rendered with '2'
    await expect(editor.locator('sup')).toHaveText('2');
  });

  test('Right-clicks a typed word and applies bold', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('heading', { name: 'New Document' }).click();
    const editor = page.locator('.folio-prose .ProseMirror');
    await expect(editor).toBeVisible();

    const p = editor.locator('p');
    await p.click();
    await page.keyboard.type('Hello world');

    // Select the word 'Hello'
    await page.keyboard.press('Home');
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }

    // Right-click inside the paragraph to trigger context menu without deselecting
    await p.dispatchEvent('contextmenu', { clientX: 300, clientY: 200 });

    // Expect context menu to appear
    const contextMenu = page.locator('.folio-context-menu');
    await expect(contextMenu).toBeVisible();

    // Click 'Bold' menuitem
    await contextMenu.getByRole('menuitem', { name: 'Bold' }).click();

    // Verify 'Hello' is now bold
    await expect(editor.locator('strong')).toHaveText('Hello');
  });

  test('Inserts a page break and reads Page 2 of 2 in status bar', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('heading', { name: 'New Document' }).click();
    const editor = page.locator('.folio-prose .ProseMirror');
    await expect(editor).toBeVisible();

    await editor.click();
    await page.keyboard.type('Page 1 content');

    // Initially reads Page 1 of 1
    const statusBar = page.locator('.folio-status-bar');
    await expect(statusBar).toContainText('Page 1 of 1');

    // Click "Insert" tab on ribbon
    await page.locator('.folio-ribbon').getByRole('button', { name: 'Insert', exact: true }).click();

    // Click "Page break" button
    await page.locator('button[title*="Page break"]').click();

    // Type on page 2
    await page.keyboard.type('Page 2 content');

    // Status bar reads "Page 2 of 2"
    await expect(statusBar).toContainText('Page 2 of 2');
  });

  test('Quick-access row: Save opens save dialog and Undo restores empty paragraph', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('heading', { name: 'New Document' }).click();
    const editor = page.locator('.folio-prose .ProseMirror');
    await expect(editor).toBeVisible();

    const qaRow = page.locator('.folio-quick-access');
    await expect(qaRow).toBeVisible();

    // Type text into document
    await editor.click();
    await page.keyboard.type('Temporary text');
    await expect(editor.locator('p')).toContainText('Temporary text');

    // Click quick-access Undo
    await qaRow.locator('.folio-qa-undo').click();
    await expect(editor.locator('p')).not.toContainText('Temporary text');

    // Trigger in-app save dialog fallback
    await page.evaluate(() => {
      delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
    });

    // Click quick-access Save on untitled document
    await qaRow.locator('.folio-qa-save').click();

    // Expect Save As dialog to be visible
    const saveDialog = page.locator('div[role="dialog"]');
    await expect(saveDialog).toBeVisible();
    await expect(saveDialog).toContainText('Save As');
  });

  test('Toggles outline pane, types a heading, sees it in pane, clicks it, and lands caret on heading', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('heading', { name: 'New Document' }).click();
    const editor = page.locator('.folio-prose .ProseMirror');
    await expect(editor).toBeVisible();

    // Click View tab in ribbon
    await page.locator('.folio-ribbon').getByRole('button', { name: 'View', exact: true }).click();

    // Click Headings button
    const headingsBtn = page.getByRole('button', { name: 'Headings' });
    await expect(headingsBtn).toBeVisible();
    await headingsBtn.click();

    // Outline pane appears with empty state "No headings"
    const outlinePane = page.locator('[data-testid="outline-pane"]');
    await expect(outlinePane).toBeVisible();
    await expect(outlinePane.getByText('No headings')).toBeVisible();

    // Focus editor and set heading 1 via StyleChip on Home tab
    await page.locator('.folio-ribbon').getByRole('button', { name: 'Home', exact: true }).click();
    await editor.click();
    await page.getByRole('button', { name: 'Heading 1' }).click();
    await page.keyboard.type('Project Overview');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Some paragraph text after the heading.');

    // In the outline pane, 'Project Overview' should appear
    const outlineItem = outlinePane.getByRole('button', { name: 'Project Overview' });
    await expect(outlineItem).toBeVisible();

    // Click the outline item
    await outlineItem.click();

    // Verify caret landed on the heading (selection parent is h1)
    const isInHeading = await editor.evaluate(() => {
      const sel = window.getSelection();
      if (!sel || !sel.anchorNode) return false;
      const node = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : (sel.anchorNode as HTMLElement);
      return Boolean(node?.closest('h1'));
    });
    expect(isInHeading).toBe(true);
  });

  test('Picks Title in styles gallery and sees node become a Title', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('heading', { name: 'New Document' }).click();
    const editor = page.locator('.folio-prose .ProseMirror');
    await expect(editor).toBeVisible();

    await editor.click();
    await page.keyboard.type('My Grand Manuscript');

    // Click Title style chip in Home ribbon
    const titleBtn = page.getByRole('button', { name: 'Title', exact: true });
    await expect(titleBtn).toBeVisible();
    await titleBtn.click();

    // The node is styled as Title with data-style-name="Title"
    const titleElem = editor.locator('[data-style-name="Title"]');
    await expect(titleElem).toBeVisible();
    await expect(titleElem).toHaveText('My Grand Manuscript');
  });

  test('Inserts Table of Contents and sees headings listed', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('heading', { name: 'New Document' }).click();
    const editor = page.locator('.folio-prose .ProseMirror');
    await expect(editor).toBeVisible();

    // Type a heading first
    await editor.click();
    await page.getByRole('button', { name: 'Heading 1' }).click();
    await page.keyboard.type('First Main Section');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Paragraph text.');
    await page.keyboard.press('Enter');

    // Switch to Insert tab and click Table of Contents
    await page.locator('.folio-ribbon').getByRole('button', { name: 'Insert', exact: true }).click();
    const tocBtn = page.getByRole('button', { name: 'Table of Contents' });
    await expect(tocBtn).toBeVisible();
    await tocBtn.click();

    // Verify TOC element appears and lists the heading
    const tocBlock = editor.locator('.folio-toc-block');
    await expect(tocBlock).toBeVisible();
    await expect(tocBlock.getByText('First Main Section')).toBeVisible();
  });

  test('Inserts footnote and edits footnote text', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('heading', { name: 'New Document' }).click();
    const editor = page.locator('.folio-prose .ProseMirror');
    await expect(editor).toBeVisible();

    await editor.click();
    await page.keyboard.type('Claims requiring a citation');

    // Switch to Insert tab and click Footnote
    await page.locator('.folio-ribbon').getByRole('button', { name: 'Insert', exact: true }).click();
    const fnBtn = page.getByRole('button', { name: 'Footnote' });
    await expect(fnBtn).toBeVisible();
    await fnBtn.click();

    // Verify footnote ref [1] appears in editor text
    const fnRef = editor.locator('.folio-footnote-ref');
    await expect(fnRef).toBeVisible();
    await expect(fnRef).toHaveText('[1]');

    // Footnote input appears in footnotes area at bottom
    const fnInput = page.locator('.folio-footnote-input');
    await expect(fnInput).toBeVisible();
    await fnInput.fill('Source: Primary archival record 1924.');
    await expect(fnInput).toHaveValue('Source: Primary archival record 1924.');
  });

  test('Changes orientation to Landscape and columns to Two in Layout ribbon', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('heading', { name: 'New Document' }).click();
    const editor = page.locator('.folio-prose .ProseMirror');
    await expect(editor).toBeVisible();

    // Switch to Layout tab
    await page.locator('.folio-ribbon').getByRole('button', { name: 'Layout', exact: true }).click();

    // Select Landscape in orientation select
    const orientSelect = page.locator('select[aria-label="Orientation"]');
    await expect(orientSelect).toBeVisible();
    await orientSelect.selectOption('landscape');

    // Select Two in columns select
    const colsSelect = page.locator('select[aria-label="Columns"]');
    await expect(colsSelect).toBeVisible();
    await colsSelect.selectOption('2');

    // Verify prose has --folio-column-count: 2
    const prose = page.locator('.folio-prose');
    await expect(prose).toHaveCSS('--folio-column-count', '2');

    // Verify paper sheet is wider in landscape
    const paperSheet = page.locator('.folio-paper-sheet');
    const width = await paperSheet.evaluate((el) => parseFloat(window.getComputedStyle(el).width));
    // Letter portrait is ~816px, Letter landscape (11 in * 96) is ~1056px
    expect(width).toBeGreaterThan(900);
  });

  test('Surfaces contextual Table tab when cursor is in table and hides it when outside', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('heading', { name: 'New Document' }).click();
    const editor = page.locator('.folio-prose .ProseMirror');
    await expect(editor).toBeVisible();

    await editor.click();
    await page.keyboard.type('Paragraph before table.');
    await page.keyboard.press('Enter');

    // Insert Table from Insert tab
    await page.locator('.folio-ribbon').getByRole('button', { name: 'Insert', exact: true }).click();
    const tableInsertBtn = page.getByRole('button', { name: 'Table', exact: true });
    await expect(tableInsertBtn).toBeVisible();
    await tableInsertBtn.click();

    // Table tab appears in ribbon tabs
    const tableTab = page.locator('[data-testid="ribbon-tab-table"]');
    await expect(tableTab).toBeVisible();

    // Click the Table tab to view table commands
    await tableTab.click();
    await expect(page.getByRole('button', { name: 'Add row above' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete table' })).toBeVisible();

    // Click first paragraph outside table
    await editor.locator('p').first().click();

    // Contextual Table tab disappears
    await expect(tableTab).not.toBeVisible();
  });

  test('Flags misspelled word and applies suggestion from context menu', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('heading', { name: 'New Document' }).click();
    const editor = page.locator('.folio-prose .ProseMirror');
    await expect(editor).toBeVisible();

    await editor.click();
    await page.keyboard.type('This is a documnt');

    // Misspelled word has squiggly underline
    const misspelling = page.locator('.folio-misspelling[data-misspelled-word="documnt"]');
    await expect(misspelling).toBeVisible();
    await expect(misspelling).toHaveText('documnt');

    // Right click the misspelled word
    await misspelling.click({ button: 'right' });

    // Context menu displays suggestion
    const sugBtn = page.getByRole('menuitem', { name: 'document' });
    await expect(sugBtn).toBeVisible();
    await sugBtn.click();

    // Word is replaced and error decoration disappears
    await expect(editor.locator('p')).toContainText('This is a document');
    await expect(page.locator('.folio-misspelling')).not.toBeVisible();
  });
});
