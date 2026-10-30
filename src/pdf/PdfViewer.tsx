import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Search, X, FileText } from 'lucide-react';
import { t } from '../i18n/instance';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

function searchLabel(status: string): string {
  if (status === 'searching') return t('pdf.searching');
  if (status === 'none') return t('pdf.none');
  if (status.startsWith('found:')) return t('pdf.found', { pages: status.slice('found:'.length) });
  return status;
}

interface PdfViewerProps {
  pdfData: Uint8Array;
  onPageInfo?: (info: { page: number; pages: number }) => void;
  onEditAsDocument?: () => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ pdfData, onPageInfo, onEditAsDocument }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
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
        setLoadError(null);
        const loadingTask = pdfjsLib.getDocument({ data: pdfData.slice() });
        const doc = await loadingTask.promise;
        if (!isCancelled) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setCurrentPage(1);
        }
      } catch (err) {
        console.error('Failed to load PDF document:', err);
        if (!isCancelled) {
          setPdfDoc(null);
          setLoadError('protected');
        }
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

    setSearchStatus('searching');
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
      setSearchStatus(`found:${matches.join(', ')}`);
      // Jump to first matching page
      setCurrentPage(matches[0]);
    } else {
      setSearchStatus('none');
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
            {t('pdf.page', { current: currentPage, total: numPages })}
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
            title={t('pdf.zoomOut')}
          >
            <ZoomOut size={16} />
          </button>
          <span style={{ fontSize: '12px', minWidth: '40px', textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
            style={{ padding: '4px', borderRadius: '4px' }}
            title={t('pdf.zoomIn')}
          >
            <ZoomIn size={16} />
          </button>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="text"
            placeholder={t('pdf.searchPlaceholder')}
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
            <span style={{ fontSize: '11px', color: 'var(--folio-ink-muted)' }}>{searchLabel(searchStatus)}</span>
          )}
        </div>

        {/* Edit as Document button on toolbar */}
        {onEditAsDocument && (
          <button
            onClick={onEditAsDocument}
            disabled={Boolean(loadError) || !pdfDoc}
            title={t('pdf.edit')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '4px',
              backgroundColor: 'var(--folio-bg)',
              color: 'var(--folio-ink)',
              fontSize: '12px',
              cursor: Boolean(loadError) || !pdfDoc ? 'not-allowed' : 'pointer',
              opacity: Boolean(loadError) || !pdfDoc ? 0.4 : 1,
            }}
          >
            <FileText size={14} /> {t('pdf.edit')}
          </button>
        )}
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
        {loadError ? (
          <div
            data-testid="pdf-error-banner"
            style={{
              padding: '24px 32px',
              backgroundColor: '#fff3cd',
              color: '#664d03',
              border: '1px solid #ffe69c',
              borderRadius: '6px',
              textAlign: 'center',
              maxWidth: '480px',
              marginTop: '40px',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '8px' }}>
              {t('pdf.protected')}
            </div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>
              {t('pdf.protectedDetail')}
            </div>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
};

