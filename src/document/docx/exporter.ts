import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Packer,
  ExternalHyperlink,
} from 'docx';
import { clampPageSetup, mmToTwip, PAGE_MM, readPageSetup, type PageSetup } from '../pageSetup';

function getAlignment(styleAttr: string | null): (typeof AlignmentType)[keyof typeof AlignmentType] {
  if (!styleAttr) return AlignmentType.LEFT;
  if (styleAttr.includes('text-align: center')) return AlignmentType.CENTER;
  if (styleAttr.includes('text-align: right')) return AlignmentType.RIGHT;
  if (styleAttr.includes('text-align: justify')) return AlignmentType.JUSTIFIED;
  return AlignmentType.LEFT;
}

function parseHexColor(styleAttr: string | null): string | undefined {
  if (!styleAttr) return undefined;
  const match = styleAttr.match(/color:\s*#?([0-9a-fA-F]{6})/);
  return match ? match[1] : undefined;
}

function parseFontSize(styleAttr: string | null): number | undefined {
  if (!styleAttr) return undefined;
  const ptMatch = styleAttr.match(/font-size:\s*(\d+(\.\d+)?)pt/);
  if (ptMatch) return Math.round(parseFloat(ptMatch[1]) * 2); // docx uses half-points
  const pxMatch = styleAttr.match(/font-size:\s*(\d+(\.\d+)?)px/);
  if (pxMatch) return Math.round(parseFloat(pxMatch[1]) * 1.5);
  return undefined;
}

interface RunStyleContext {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  size?: number;
  font?: string;
}

function extractRuns(node: Node, ctx: RunStyleContext = {}): Array<TextRun | ExternalHyperlink> {
  const runs: Array<TextRun | ExternalHyperlink> = [];

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    if (text) {
      runs.push(
        new TextRun({
          text,
          bold: ctx.bold,
          italics: ctx.italics,
          underline: ctx.underline ? {} : undefined,
          strike: ctx.strike,
          color: ctx.color,
          size: ctx.size,
          font: ctx.font,
        })
      );
    }
    return runs;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'br') {
      runs.push(new TextRun({ break: 1 }));
      return runs;
    }

    if (tag === 'a') {
      const href = el.getAttribute('href') || '#';
      const childRuns: TextRun[] = [];
      el.childNodes.forEach((child) => {
        const sub = extractRuns(child, { ...ctx, underline: true, color: '0f766e' });
        sub.forEach((r) => {
          if (r instanceof TextRun) childRuns.push(r);
        });
      });
      runs.push(
        new ExternalHyperlink({
          children: childRuns.length > 0 ? childRuns : [new TextRun({ text: href, underline: {} })],
          link: href,
        })
      );
      return runs;
    }

    const nextCtx: RunStyleContext = { ...ctx };
    if (tag === 'strong' || tag === 'b') nextCtx.bold = true;
    if (tag === 'em' || tag === 'i') nextCtx.italics = true;
    if (tag === 'u') nextCtx.underline = true;
    if (tag === 's' || tag === 'strike' || tag === 'del') nextCtx.strike = true;

    const style = el.getAttribute('style');
    if (style) {
      const col = parseHexColor(style);
      if (col) nextCtx.color = col;
      const sz = parseFontSize(style);
      if (sz) nextCtx.size = sz;
      const fontMatch = style.match(/font-family:\s*['"]?([^,'";]+)['"]?/);
      if (fontMatch) nextCtx.font = fontMatch[1];
    }

    el.childNodes.forEach((child) => {
      runs.push(...extractRuns(child, nextCtx));
    });
  }

  return runs;
}

export async function exportDocx(htmlContent: string, pageSetup?: PageSetup | null): Promise<Blob> {
  const parser = new (globalThis.DOMParser || DOMParser)();
  const parsedDoc = parser.parseFromString(htmlContent, 'text/html');
  const docElement = parsedDoc.body;

  const paragraphsOrTables: Array<Paragraph | Table> = [];

  const processNode = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const align = getAlignment(el.getAttribute('style'));

    if (tag === 'h1') {
      paragraphsOrTables.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: extractRuns(el),
          alignment: align,
          spacing: { before: 240, after: 120 },
        })
      );
    } else if (tag === 'h2') {
      paragraphsOrTables.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: extractRuns(el),
          alignment: align,
          spacing: { before: 200, after: 100 },
        })
      );
    } else if (tag === 'h3') {
      paragraphsOrTables.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: extractRuns(el),
          alignment: align,
          spacing: { before: 160, after: 80 },
        })
      );
    } else if (tag === 'p') {
      paragraphsOrTables.push(
        new Paragraph({
          children: extractRuns(el),
          alignment: align,
          spacing: { before: 0, after: 140 },
        })
      );
    } else if (tag === 'ul' || tag === 'ol') {
      const isOrdered = tag === 'ol';
      const items = Array.from(el.querySelectorAll(':scope > li'));
      items.forEach((li) => {
        paragraphsOrTables.push(
          new Paragraph({
            children: extractRuns(li),
            bullet: isOrdered ? undefined : { level: 0 },
            spacing: { before: 40, after: 40 },
          })
        );
      });
    } else if (tag === 'table') {
      const rows = Array.from(el.querySelectorAll('tr'));
      const tableRows = rows.map((r) => {
        const cells = Array.from(r.querySelectorAll('th, td'));
        return new TableRow({
          children: cells.map((c) => {
            return new TableCell({
              children: [
                new Paragraph({
                  children: extractRuns(c),
                }),
              ],
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: 'D8D3C8' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D8D3C8' },
                left: { style: BorderStyle.SINGLE, size: 1, color: 'D8D3C8' },
                right: { style: BorderStyle.SINGLE, size: 1, color: 'D8D3C8' },
              },
            });
          }),
        });
      });

      if (tableRows.length > 0) {
        paragraphsOrTables.push(
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
      }
    } else if (tag === 'hr') {
      paragraphsOrTables.push(
        new Paragraph({
          border: { bottom: { color: 'CCCCCC', space: 1, style: BorderStyle.SINGLE, size: 6 } },
          spacing: { before: 120, after: 120 },
        })
      );
    } else {
      // Fallback for divs, blockquotes, etc.
      Array.from(el.childNodes).forEach(processNode);
    }
  };

  Array.from(docElement.childNodes).forEach(processNode);

  if (paragraphsOrTables.length === 0) {
    paragraphsOrTables.push(new Paragraph({ text: '' }));
  }

  const setup = clampPageSetup(pageSetup ?? readPageSetup(null));
  const page = PAGE_MM[setup.size];
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: mmToTwip(page.width),
              height: mmToTwip(page.height),
            },
            margin: {
              top: mmToTwip(setup.marginTop),
              right: mmToTwip(setup.marginRight),
              bottom: mmToTwip(setup.marginBottom),
              left: mmToTwip(setup.marginLeft),
            },
          },
        },
        children: paragraphsOrTables,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
