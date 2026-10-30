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
  Header,
  Footer,
  PageNumber,
  ImageRun,
} from 'docx';
import { clampPageSetup, mmToTwip, PAGE_MM, readPageSetup, type PageSetup } from '../pageSetup';
import {
  hasChromeContent,
  isStoryEmpty,
  type ChromeParagraph,
  type ChromeRun,
  type ChromeStory,
  type ChromeZone,
  type DocumentChrome,
} from '../chrome';

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
    if (tag === 's' || tag === 'del' || tag === 'strike') nextCtx.strike = true;

    const style = el.getAttribute('style');
    const color = parseHexColor(style);
    if (color) nextCtx.color = color;

    const size = parseFontSize(style);
    if (size) nextCtx.size = size;

    if (style) {
      const fontMatch = style.match(/font-family:\s*['"]?([^'";,]+)/);
      if (fontMatch) nextCtx.font = fontMatch[1];
    }

    el.childNodes.forEach((child) => {
      runs.push(...extractRuns(child, nextCtx));
    });

    return runs;
  }

  return runs;
}

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
};

function getAlignmentFromStr(align?: 'left' | 'center' | 'right'): (typeof AlignmentType)[keyof typeof AlignmentType] {
  if (align === 'center') return AlignmentType.CENTER;
  if (align === 'right') return AlignmentType.RIGHT;
  return AlignmentType.LEFT;
}

function buildRunsFromChromeRuns(runs: ChromeRun[]): (TextRun | ImageRun)[] {
  const result: (TextRun | ImageRun)[] = [];
  for (const r of runs) {
    if (r.type === 'image') {
      try {
        const comma = r.src.indexOf(',');
        const base64 = comma >= 0 ? r.src.slice(comma + 1) : r.src;
        const buf = Buffer.from(base64, 'base64');
        let type: 'png' | 'jpg' | 'gif' = 'png';
        if (r.src.includes('jpeg') || r.src.includes('jpg')) type = 'jpg';
        else if (r.src.includes('gif')) type = 'gif';
        result.push(
          new ImageRun({
            data: buf,
            type,
            transformation: {
              width: r.width || 48,
              height: r.height || 48,
            },
          })
        );
      } catch (err) {
        console.warn('Could not embed image run in header/footer:', err);
      }
      continue;
    }

    const marks = {
      bold: r.bold,
      italics: r.italic,
      underline: r.underline ? {} : undefined,
      color: r.color ? r.color.replace('#', '') : undefined,
      size: r.fontSize ? r.fontSize * 2 : undefined,
      font: r.fontFamily,
    };

    if (r.type === 'field') {
      if (r.field === 'page') {
        result.push(new TextRun({ children: [PageNumber.CURRENT], ...marks }));
      } else {
        // pageOfTotal
        result.push(new TextRun({ text: 'Page ', ...marks }));
        result.push(new TextRun({ children: [PageNumber.CURRENT], ...marks }));
        result.push(new TextRun({ text: ' of ', ...marks }));
        result.push(new TextRun({ children: [PageNumber.TOTAL_PAGES], ...marks }));
      }
      continue;
    }

    if (r.type === 'text' && r.text) {
      result.push(new TextRun({ text: r.text, ...marks }));
    }
  }
  return result;
}

function buildZoneParagraph(
  zone: ChromeZone,
  defaultAlign: (typeof AlignmentType)[keyof typeof AlignmentType]
): Paragraph {
  const runs = buildRunsFromChromeRuns(zone.runs);
  const align = zone.align ? getAlignmentFromStr(zone.align) : defaultAlign;
  return new Paragraph({
    children: runs,
    alignment: align,
  });
}

function buildStoryChildren(story: ChromeStory): (Table | Paragraph)[] {
  const children: (Table | Paragraph)[] = [];
  const l0 = story.line0;
  const hasLine0 =
    (l0.left.runs && l0.left.runs.length > 0) ||
    (l0.center.runs && l0.center.runs.length > 0) ||
    (l0.right.runs && l0.right.runs.length > 0);

  if (hasLine0) {
    children.push(
      new Table({
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [buildZoneParagraph(l0.left, AlignmentType.LEFT)],
                borders: noBorders,
                width: { size: 3333, type: WidthType.DXA },
              }),
              new TableCell({
                children: [buildZoneParagraph(l0.center, AlignmentType.CENTER)],
                borders: noBorders,
                width: { size: 3334, type: WidthType.DXA },
              }),
              new TableCell({
                children: [buildZoneParagraph(l0.right, AlignmentType.RIGHT)],
                borders: noBorders,
                width: { size: 3333, type: WidthType.DXA },
              }),
            ],
          }),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    );
  }

  for (const line of story.lines) {
    const runs = buildRunsFromChromeRuns(line.runs);
    children.push(
      new Paragraph({
        children: runs,
        alignment: getAlignmentFromStr(line.align),
      })
    );
  }

  if (children.length === 0) {
    children.push(new Paragraph({ text: '' }));
  }

  return children;
}

/**
 * Converts HTML string and page setup into a DOCX Blob.
 */
export async function exportDocx(
  htmlContent: string,
  pageSetup?: PageSetup | null,
  chrome?: DocumentChrome | null
): Promise<Blob> {
  let docElement: HTMLElement;
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(htmlContent, 'text/html');
    docElement = parsed.body;
  } else {
    // Node.js testing environment fallback
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM(htmlContent);
    docElement = dom.window.document.body;
  }

  const paragraphsOrTables: Array<Paragraph | Table> = [];

  const processNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        paragraphsOrTables.push(new Paragraph({ children: [new TextRun(text)] }));
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    // Check page break
    if (tag === 'hr' && el.getAttribute('data-page-break') === 'true') {
      paragraphsOrTables.push(
        new Paragraph({
          pageBreakBefore: true,
        })
      );
      return;
    }

    if (tag === 'p') {
      const align = getAlignment(el.getAttribute('style'));
      paragraphsOrTables.push(
        new Paragraph({
          children: extractRuns(el),
          alignment: align,
          spacing: { before: 100, after: 100 },
        })
      );
    } else if (tag.startsWith('h') && tag.length === 2) {
      const levelNum = parseInt(tag[1], 10);
      const headingLevels: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
      };
      paragraphsOrTables.push(
        new Paragraph({
          children: extractRuns(el),
          heading: headingLevels[levelNum] || HeadingLevel.HEADING_1,
          alignment: getAlignment(el.getAttribute('style')),
          spacing: { before: 240, after: 120 },
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

  const sectionHeaders: Record<string, Header> = {};
  const sectionFooters: Record<string, Footer> = {};

  if (chrome && hasChromeContent(chrome)) {
    if (!isStoryEmpty(chrome.header)) {
      sectionHeaders.default = new Header({ children: buildStoryChildren(chrome.header) });
    }
    if (!isStoryEmpty(chrome.footer)) {
      sectionFooters.default = new Footer({ children: buildStoryChildren(chrome.footer) });
    }
    if (chrome.differentFirstPage) {
      if (chrome.firstHeader && !isStoryEmpty(chrome.firstHeader)) {
        sectionHeaders.first = new Header({ children: buildStoryChildren(chrome.firstHeader) });
      }
      if (chrome.firstFooter && !isStoryEmpty(chrome.firstFooter)) {
        sectionFooters.first = new Footer({ children: buildStoryChildren(chrome.firstFooter) });
      }
    }
  }

  const sectionProps: any = {
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
  };

  if (chrome?.differentFirstPage) {
    sectionProps.titlePage = true;
  }

  const doc = new Document({
    sections: [
      {
        properties: sectionProps,
        headers: Object.keys(sectionHeaders).length > 0 ? sectionHeaders : undefined,
        footers: Object.keys(sectionFooters).length > 0 ? sectionFooters : undefined,
        children: paragraphsOrTables,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
