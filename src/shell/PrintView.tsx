import React, { useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { EditorState, PresentationModel, Slide } from '../types';
import { FortuneSheetData } from '../spreadsheet/adapters';
import { mmToPx, PAGE_MM, pageSetupFromDoc, type PageSetup } from '../document/pageSetup';
import { documentToHtml } from '../document/model';
import {
  chromeFromDoc,
  formatFieldRun,
  isStoryEmpty,
  resolveStoryForPage,
  type ChromeRun,
  type ChromeStory,
} from '../document/chrome';

interface PrintViewProps {
  tab: EditorState;
  scope: 'current' | 'all';
  slideIndex: number;
  pdfPage: number;
  onDone: () => void;
}

function sheetCells(sheet: FortuneSheetData): string[][] {
  const rows = sheet.data || [];
  let maxRow = 0;
  let maxCol = 0;
  rows.forEach((row, r) => {
    (row || []).forEach((cell, c) => {
      const text = cell?.m ?? (cell?.v != null ? String(cell.v) : '');
      if (text !== '') {
        maxRow = Math.max(maxRow, r);
        maxCol = Math.max(maxCol, c);
      }
    });
  });
  const grid: string[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    const line: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const cell = rows[r]?.[c];
      line.push(cell?.m ?? (cell?.v != null ? String(cell.v) : ''));
    }
    grid.push(line);
  }
  return grid.length ? grid : [['']];
}

function SlidePage({ slide, slideSize }: { slide: Slide; slideSize?: '16:9' | '16:10' | '4:3' }) {
  const height = slideSize === '4:3' ? 720 : slideSize === '16:10' ? 600 : 540;
  return (
    <div
      className="folio-print-slide"
      style={{
        position: 'relative',
        width: '960px',
        height: `${height}px`,
        background: slide.background || '#fff',
        breakAfter: 'page',
        overflow: 'hidden',
      }}
    >
      {slide.elements.map((elem) => {
        if (elem.type === 'image' && elem.src) {
          return (
            <img
              key={elem.id}
              src={elem.src}
              alt=""
              style={{
                position: 'absolute',
                left: `${elem.x}%`,
                top: `${elem.y}%`,
                width: `${elem.width}%`,
                height: `${elem.height}%`,
              }}
            />
          );
        }
        if (elem.type === 'table' && elem.rows) {
          return (
            <table
              key={elem.id}
              style={{
                position: 'absolute',
                left: `${elem.x}%`,
                top: `${elem.y}%`,
                width: `${elem.width}%`,
                height: `${elem.height}%`,
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
                backgroundColor: '#ffffff',
              }}
            >
              <tbody>
                {elem.rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cellText, cIdx) => (
                      <td
                        key={cIdx}
                        style={{
                          border: '1px solid #000000',
                          padding: '4px',
                          fontSize: '12px',
                          verticalAlign: 'top',
                          overflow: 'hidden',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {cellText}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        if (elem.type === 'rect') {
          const isLine = elem.shape === 'line';
          return (
            <div
              key={elem.id}
              style={{
                position: 'absolute',
                left: `${elem.x}%`,
                top: `${elem.y}%`,
                width: `${elem.width}%`,
                height: `${elem.height}%`,
                boxSizing: 'border-box',
              }}
            >
              {isLine ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '100%', borderTop: `${elem.borderWidth || 2}px solid ${elem.borderColor || '#0f766e'}` }} />
                </div>
              ) : elem.shape === 'triangle' ? (
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0 }}
                >
                  <polygon
                    points="50,0 100,100 0,100"
                    fill={elem.fill || '#d6f3ef'}
                    stroke={elem.borderColor || 'none'}
                    strokeWidth={elem.borderColor ? elem.borderWidth || 1 : 0}
                  />
                </svg>
              ) : elem.shape === 'ellipse' ? (
                <div
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    top: 0,
                    left: 0,
                    borderRadius: '50%',
                    backgroundColor: elem.fill || '#d6f3ef',
                    border: elem.borderColor ? `${elem.borderWidth || 1}px solid ${elem.borderColor}` : undefined,
                    boxSizing: 'border-box',
                  }}
                />
              ) : elem.shape === 'roundRect' ? (
                <div
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    top: 0,
                    left: 0,
                    borderRadius: '12px',
                    backgroundColor: elem.fill || '#d6f3ef',
                    border: elem.borderColor ? `${elem.borderWidth || 1}px solid ${elem.borderColor}` : undefined,
                    boxSizing: 'border-box',
                  }}
                />
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    top: 0,
                    left: 0,
                    backgroundColor: elem.fill || '#e2ded6',
                    border: elem.borderColor ? `${elem.borderWidth || 1}px solid ${elem.borderColor}` : undefined,
                    boxSizing: 'border-box',
                  }}
                />
              )}
              {elem.text && !isLine && (
                <div
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: elem.align === 'left' ? 'flex-start' : elem.align === 'right' ? 'flex-end' : 'center',
                    textAlign: elem.align || 'center',
                    fontFamily: elem.fontFamily || 'system-ui, sans-serif',
                    fontSize: `${elem.fontSize || 18}px`,
                    fontWeight: elem.bold ? 700 : 400,
                    fontStyle: elem.italic ? 'italic' : 'normal',
                    textDecoration: elem.underline ? 'underline' : 'none',
                    color: elem.color || '#1e2022',
                    padding: '8px',
                    boxSizing: 'border-box',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {elem.text}
                </div>
              )}
            </div>
          );
        }
        if (elem.type === 'video') {
          return null;
        }
        return (
          <div
            key={elem.id}
            style={{
              position: 'absolute',
              left: `${elem.x}%`,
              top: `${elem.y}%`,
              width: `${elem.width}%`,
              minHeight: `${elem.height}%`,
              fontFamily: elem.fontFamily || 'system-ui, sans-serif',
              fontSize: `${elem.fontSize || 18}px`,
              fontWeight: elem.bold ? 700 : 400,
              fontStyle: elem.italic ? 'italic' : 'normal',
              textDecoration: elem.underline ? 'underline' : 'none',
              color: elem.color || '#1e2022',
              textAlign: elem.align || 'left',
              whiteSpace: 'pre-wrap',
            }}
          >
            {elem.text || ''}
          </div>
        );
      })}
    </div>
  );
}

function PrintBandView({
  story,
  pageNumber,
  totalPages,
  heightMm,
  paddingLeftMm,
  paddingRightMm,
}: {
  story: ChromeStory;
  pageNumber: number;
  totalPages: number;
  heightMm: number;
  paddingLeftMm: number;
  paddingRightMm: number;
}) {
  if (isStoryEmpty(story)) {
    return <div style={{ height: `${heightMm}mm` }} />;
  }
  const l0 = story.line0;
  const renderRuns = (runs: ChromeRun[]) =>
    runs.map((r, i) => {
      if (r.type === 'image') {
        return (
          <img
            key={i}
            src={r.src}
            alt=""
            style={{ maxHeight: '20px', verticalAlign: 'middle', marginRight: 4 }}
          />
        );
      }
      const text = r.type === 'field' ? formatFieldRun(r.field, pageNumber, totalPages) : r.text;
      return (
        <span
          key={i}
          style={{
            fontWeight: r.bold ? 700 : 400,
            fontStyle: r.italic ? 'italic' : 'normal',
            textDecoration: r.underline ? 'underline' : 'none',
            color: r.color || 'inherit',
            fontSize: r.fontSize ? `${r.fontSize}pt` : '10pt',
            fontFamily: r.fontFamily || 'inherit',
          }}
        >
          {text}
        </span>
      );
    });

  return (
    <div
      style={{
        height: `${heightMm}mm`,
        paddingLeft: `${paddingLeftMm}mm`,
        paddingRight: `${paddingRightMm}mm`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        boxSizing: 'border-box',
        fontSize: '10pt',
      }}
    >
      <div style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
        <div style={{ flex: 1, textAlign: l0.left.align || 'left' }}>{renderRuns(l0.left.runs)}</div>
        <div style={{ flex: 1, textAlign: l0.center.align || 'center' }}>{renderRuns(l0.center.runs)}</div>
        <div style={{ flex: 1, textAlign: l0.right.align || 'right' }}>{renderRuns(l0.right.runs)}</div>
      </div>
      {story.lines.map((l, li) => (
        <div key={li} style={{ width: '100%', textAlign: l.align || 'left' }}>
          {renderRuns(l.runs)}
        </div>
      ))}
    </div>
  );
}

function paginateDocumentNodes(nodes: any[], setup: PageSetup, pageH: number): any[][] {
  const innerPx = mmToPx(pageH - setup.marginTop - setup.marginBottom);
  const pages: any[][] = [[]];
  let used = 0;

  for (const node of nodes) {
    if (node.type === 'pageBreak') {
      pages.push([]);
      used = 0;
      continue;
    }

    let estHeight = 24;
    if (node.type === 'heading') {
      const lvl = node.attrs?.level || 1;
      estHeight = lvl === 1 ? 48 : lvl === 2 ? 36 : 28;
    } else if (node.type === 'table') {
      const rowCount = (node.content || []).length;
      estHeight = Math.max(30, rowCount * 28);
    } else if (node.type === 'image') {
      estHeight = 150;
    } else if (node.type === 'paragraph') {
      const textLen = (node.content || []).reduce(
        (sum: number, c: any) => sum + (c.text?.length || 0),
        0
      );
      const lines = Math.max(1, Math.ceil(textLen / 70));
      estHeight = lines * 22;
    }

    if (used > 0 && used + estHeight > innerPx) {
      pages.push([node]);
      used = estHeight;
    } else {
      pages[pages.length - 1].push(node);
      used += estHeight;
    }
  }

  return pages.length > 0 ? pages : [[]];
}

function DocumentPrintStack({ tab }: { tab: EditorState }) {
  const content = tab.documentContent;
  const setup = pageSetupFromDoc(content);
  const page = PAGE_MM[setup.size];
  const chrome = chromeFromDoc(content);
  const nodes = content?.content || [];
  const pages = paginateDocumentNodes(nodes, setup, page.height);
  const totalPages = pages.length;

  return (
    <div className="folio-print-doc-stack">
      {pages.map((pageNodes, pIdx) => {
        const pageNumber = pIdx + 1;
        const headerStory = resolveStoryForPage(chrome, 'header', pageNumber);
        const footerStory = resolveStoryForPage(chrome, 'footer', pageNumber);
        const html = documentToHtml({ type: 'doc', content: pageNodes });

        return (
          <div
            key={pageNumber}
            className="folio-print-page"
            style={{
              width: `${page.width}mm`,
              minHeight: `${page.height}mm`,
              maxHeight: `${page.height}mm`,
              overflow: 'hidden',
              pageBreakAfter: pageNumber === totalPages ? 'auto' : 'always',
              breakAfter: pageNumber === totalPages ? 'auto' : 'page',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              background: '#ffffff',
            }}
          >
            <PrintBandView
              story={headerStory}
              pageNumber={pageNumber}
              totalPages={totalPages}
              heightMm={setup.marginTop}
              paddingLeftMm={setup.marginLeft}
              paddingRightMm={setup.marginRight}
            />
            <div
              className="folio-print-page-body"
              style={{
                flex: 1,
                paddingLeft: `${setup.marginLeft}mm`,
                paddingRight: `${setup.marginRight}mm`,
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
            <PrintBandView
              story={footerStory}
              pageNumber={pageNumber}
              totalPages={totalPages}
              heightMm={setup.marginBottom}
              paddingLeftMm={setup.marginLeft}
              paddingRightMm={setup.marginRight}
            />
          </div>
        );
      })}
    </div>
  );
}

export const PrintView: React.FC<PrintViewProps> = ({ tab, scope, slideIndex, pdfPage, onDone }) => {
  const [pdfUrls, setPdfUrls] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    const finish = () => {
      if (cancelled) return;
      document.body.dataset.folioPrint = 'extra';
      window.print();
      delete document.body.dataset.folioPrint;
      onDone();
    };

    const renderPdf = async () => {
      if (!tab.pdfData) {
        finish();
        return;
      }
      const doc = await pdfjsLib.getDocument({ data: tab.pdfData.slice(0) }).promise;
      const pages = scope === 'all' ? Array.from({ length: doc.numPages }, (_, i) => i + 1) : [pdfPage];
      for (const pageNumber of pages) {
        const page = await doc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        if (!context) continue;
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        urls.push(canvas.toDataURL('image/png'));
      }
      if (!cancelled) setPdfUrls(urls);
      requestAnimationFrame(() => finish());
    };

    if (tab.kind === 'pdf') {
      renderPdf().catch((err) => {
        console.error(err);
        finish();
      });
    } else {
      requestAnimationFrame(() => finish());
    }

    return () => {
      cancelled = true;
    };
  }, [tab, scope, pdfPage, onDone]);

  if (tab.kind === 'document') {
    return (
      <div className="folio-print-root">
        <DocumentPrintStack tab={tab} />
      </div>
    );
  }

  if (tab.kind === 'spreadsheet') {
    const sheets = (tab.spreadsheetData || []) as FortuneSheetData[];
    const active = sheets.find((sheet) => sheet.status === 1) || sheets[0];
    const chosen = scope === 'all' ? sheets : active ? [active] : [];
    return (
      <div className="folio-print-root">
        {chosen.map((sheet) => (
          <table key={sheet.id || sheet.name} className="folio-print-sheet" style={{ breakAfter: 'page', borderCollapse: 'collapse', width: '100%' }}>
            <caption style={{ textAlign: 'left', fontWeight: 700, marginBottom: '8px' }}>{sheet.name}</caption>
            <tbody>
              {sheetCells(sheet).map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} style={{ border: '1px solid #ccc', padding: '4px 6px', fontSize: '12px' }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    );
  }

  if (tab.kind === 'presentation') {
    const presentation = (tab.presentationData || { title: '', slides: [] }) as PresentationModel;
    const slides = scope === 'all' ? presentation.slides : [presentation.slides[slideIndex] || presentation.slides[0]].filter(Boolean);
    return (
      <div className="folio-print-root">
        {slides.map((slide) => (
          <SlidePage key={slide.id} slide={slide} slideSize={presentation.slideSize} />
        ))}
      </div>
    );
  }

  return (
    <div className="folio-print-root">
      {pdfUrls.map((url, index) => (
        <img key={index} src={url} alt="" className="folio-print-pdf-page" style={{ width: '100%', breakAfter: 'page' }} />
      ))}
    </div>
  );
};
