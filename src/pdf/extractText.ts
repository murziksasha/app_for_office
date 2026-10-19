import * as pdfjsLib from 'pdfjs-dist';

export interface ExtractResult {
  html: string;
  skippedPages: number[];
  paragraphsCount: number;
}

interface Fragment {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LineGroup {
  y: number;
  height: number;
  fragments: Fragment[];
}

interface AssembledLine {
  text: string;
  y: number;
  height: number;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Pure function extracting selectable text from PDF bytes.
 * Clusters text into lines and paragraphs.
 * Returns HTML paragraphs, skipped empty page numbers, and total paragraph count.
 */
export async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<ExtractResult> {
  if (!pdfBytes || pdfBytes.length === 0) {
    throw new Error('This PDF is protected or unreadable');
  }

  let doc: any;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: pdfBytes.slice(),
      useSystemFonts: true,
    });
    doc = await loadingTask.promise;
  } catch (err: any) {
    throw new Error('This PDF is protected or unreadable');
  }

  const numPages = doc.numPages || 0;
  if (numPages === 0) {
    return { html: '', skippedPages: [], paragraphsCount: 0 };
  }

  const skippedPages: number[] = [];
  const paragraphs: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items = (content.items || []) as any[];

    const fragments: Fragment[] = [];
    for (const item of items) {
      if (item && typeof item.str === 'string') {
        const x = item.transform ? item.transform[4] : 0;
        const y = item.transform ? item.transform[5] : 0;
        const width = item.width || 0;
        const height = item.height || (item.transform ? Math.abs(item.transform[3]) : 12);
        fragments.push({ str: item.str, x, y, width, height });
      }
    }

    if (fragments.length === 0 || fragments.every((f) => !f.str.trim())) {
      skippedPages.push(pageNum);
      continue;
    }

    // Cluster fragments onto baselines
    // Tolerance for grouping onto the same baseline
    fragments.sort((a, b) => b.y - a.y);

    const lines: LineGroup[] = [];
    for (const frag of fragments) {
      const tol = Math.max(2, frag.height * 0.35);
      const match = lines.find((line) => Math.abs(line.y - frag.y) <= tol);
      if (match) {
        match.fragments.push(frag);
        if (frag.height > match.height) {
          match.height = frag.height;
        }
      } else {
        lines.push({
          y: frag.y,
          height: frag.height || 12,
          fragments: [frag],
        });
      }
    }

    // Order lines from top to bottom (descending Y in PDF coordinates)
    lines.sort((a, b) => b.y - a.y);

    const assembledLines: AssembledLine[] = [];
    for (const line of lines) {
      // Order fragments left to right
      line.fragments.sort((a, b) => a.x - b.x);

      let lineText = '';
      for (let i = 0; i < line.fragments.length; i++) {
        const frag = line.fragments[i];
        if (i > 0) {
          const prev = line.fragments[i - 1];
          const gap = frag.x - (prev.x + prev.width);
          if (!lineText.endsWith(' ') && !frag.str.startsWith(' ') && (gap > 1 || prev.width === 0)) {
            lineText += ' ';
          }
        }
        lineText += frag.str;
      }

      const trimmed = lineText.trim();
      if (trimmed.length > 0) {
        assembledLines.push({
          text: trimmed,
          y: line.y,
          height: line.height,
        });
      }
    }

    if (assembledLines.length === 0) {
      skippedPages.push(pageNum);
      continue;
    }

    // Group lines into paragraphs:
    // Start a new paragraph when the vertical gap is clearly larger than the line height.
    // Join lines in a paragraph with a space. Keep a hyphen at the end of a line.
    let currentParaLines: string[] = [assembledLines[0].text];

    for (let i = 1; i < assembledLines.length; i++) {
      const prev = assembledLines[i - 1];
      const curr = assembledLines[i];
      const gap = prev.y - curr.y;
      const refHeight = (prev.height + curr.height) / 2 || 12;

      if (gap > refHeight * 1.45) {
        paragraphs.push(currentParaLines.join(' '));
        currentParaLines = [curr.text];
      } else {
        currentParaLines.push(curr.text);
      }
    }

    if (currentParaLines.length > 0) {
      paragraphs.push(currentParaLines.join(' '));
    }
  }

  const cleanParagraphs = paragraphs
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const html = cleanParagraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('');

  return {
    html,
    skippedPages,
    paragraphsCount: cleanParagraphs.length,
  };
}
