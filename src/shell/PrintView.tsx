import React, { useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { EditorState, PresentationModel, Slide } from '../types';
import { FortuneSheetData } from '../spreadsheet/adapters';

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

function SlidePage({ slide }: { slide: Slide }) {
  return (
    <div
      className="folio-print-slide"
      style={{
        position: 'relative',
        width: '960px',
        height: '540px',
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
          <SlidePage key={slide.id} slide={slide} />
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
