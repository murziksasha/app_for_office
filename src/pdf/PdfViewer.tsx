import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Search, X } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface PdfViewerProps {
  pdfData: Uint8Array;
  onPageInfo?: (info: { page: number; pages: number }) => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ pdfData, onPageInfo }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [searchText, setSearchText] = useState('');
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [searchStatus, setSearchStatus] = useState<string>('');
  const renderTaskRef = useRef<any>(null);

  // Load PDF document
  useEffect(() => {
    let isCancelled = false;
    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        const doc = await loadingTask.promise;
        if (!isCancelled) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setCurrentPage(1);
        }
      } catch (err) {
        console.error('Failed to load PDF document:', err);
      }
    };

    loadPdf();
    return () => {
      isCancelled = true;
    };
  }, [pdfData]);

  // Render current page to canvas
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }

    try {
      const page = await pdfDoc.getPage(currentPage);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      const viewport = page.getViewport({ scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport,
      };

      const task = page.render(renderContext);
      renderTaskRef.current = task;
      await task.promise;
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Error rendering PDF page:', err);
      }
    }
  }, [pdfDoc, currentPage, scale]);

  useEffect(() => {
    onPageInfo?.({ page: currentPage, pages: numPages });
  }, [currentPage, numPages, onPageInfo]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Search through all pages
  const handleSearch = async () => {
    if (!pdfDoc || !searchText.trim()) {
      setSearchMatches([]);
      setSearchStatus('');
      return;
    }

    setSearchStatus('Searching...');
    const matches: number[] = [];
    const term = searchText.toLowerCase();

    for (let p = 1; p <= numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ')
        .toLowerCase();

      if (pageText.includes(term)) {
        matches.push(p);
      }
    }

    setSearchMatches(matches);
    if (matches.length > 0) {
      setSearchStatus(`Found on page(s): ${matches.join(', ')}`);
      // Jump to first matching page
      setCurrentPage(matches[0]);
    } else {
      setSearchStatus('No matches found');
    }
  };

  return (
    <div
      className="folio-pdf-viewer"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--folio-bg)',
      }}
    >
      {/* Top Toolbar */}
      <div
        style={{
          padding: '8px 16px',
          background: 'var(--folio-panel)',
          borderBottom: '1px solid var(--folio-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {/* Page navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            style={{
              padding: '4px',
              borderRadius: '4px',
              opacity: currentPage <= 1 ? 0.3 : 1,
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontSize: '12px', color: 'var(--folio-ink)' }}>
            Page {currentPage} of {numPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            style={{
              padding: '4px',
              borderRadius: '4px',
              opacity: currentPage >= numPages ? 0.3 : 1,
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
            style={{ padding: '4px', borderRadius: '4px' }}
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <span style={{ fontSize: '12px', minWidth: '40px', textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
            style={{ padding: '4px', borderRadius: '4px' }}
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="text"
            placeholder="Search in PDF..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyUp={(e) => e.key === 'Enter' && handleSearch()}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              border: '1px solid var(--folio-border)',
              borderRadius: '4px',
              outline: 'none',
              width: '140px',
            }}
          />
          <button
            onClick={handleSearch}
            style={{
              padding: '4px 8px',
              background: 'var(--folio-teal)',
              color: 'white',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          >
            <Search size={14} />
          </button>
          {searchStatus && (
            <span style={{ fontSize: '11px', color: 'var(--folio-ink-muted)' }}>{searchStatus}</span>
          )}
        </div>
      </div>

      {/* Canvas Viewport */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '32px 16px',
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            boxShadow: 'var(--folio-shadow-paper)',
            borderRadius: '2px',
            border: '1px solid var(--folio-border-light)',
            overflow: 'hidden',
          }}
        >
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
};

