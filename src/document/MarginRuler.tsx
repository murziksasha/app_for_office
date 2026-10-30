import React, { useRef } from 'react';
import type { PageSetup } from './pageSetup';

type MarginKey = 'marginTop' | 'marginRight' | 'marginBottom' | 'marginLeft';

interface MarginRulerProps {
  axis: 'horizontal' | 'vertical';
  length: number;
  pageMm: number;
  startMm: number;
  endMm: number;
  startLabel: string;
  endLabel: string;
  startText: string;
  endText: string;
  onPreview: (partial: Partial<PageSetup>) => void;
  onCommit: (partial: Partial<PageSetup>) => void;
}

export const MarginRuler: React.FC<MarginRulerProps> = ({
  axis,
  length,
  pageMm,
  startMm,
  endMm,
  startLabel,
  endLabel,
  startText,
  endText,
  onPreview,
  onCommit,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const startKey: MarginKey = axis === 'horizontal' ? 'marginLeft' : 'marginTop';
  const endKey: MarginKey = axis === 'horizontal' ? 'marginRight' : 'marginBottom';
  const startPct = pageMm > 0 ? (startMm / pageMm) * 100 : 0;
  const endPct = pageMm > 0 ? (endMm / pageMm) * 100 : 0;

  const mmFromPointer = (client: number, edge: 'start' | 'end') => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || pageMm <= 0) return 0;
    const span = axis === 'horizontal' ? rect.width : rect.height;
    const origin = axis === 'horizontal' ? rect.left : rect.top;
    const ratio = span > 0 ? (client - origin) / span : 0;
    const clamped = Math.min(1, Math.max(0, ratio));
    return edge === 'start' ? clamped * pageMm : (1 - clamped) * pageMm;
  };

  const beginDrag = (edge: 'start' | 'end') => (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const thumb = event.currentTarget;
    thumb.setPointerCapture(event.pointerId);
    const key = edge === 'start' ? startKey : endKey;
    const move = (ev: PointerEvent) => {
      const point = axis === 'horizontal' ? ev.clientX : ev.clientY;
      onPreview({ [key]: mmFromPointer(point, edge) });
    };
    const up = (ev: PointerEvent) => {
      thumb.removeEventListener('pointermove', move);
      thumb.removeEventListener('pointerup', up);
      const point = axis === 'horizontal' ? ev.clientX : ev.clientY;
      onCommit({ [key]: mmFromPointer(point, edge) });
    };
    thumb.addEventListener('pointermove', move);
    thumb.addEventListener('pointerup', up);
  };

  const nudge = (edge: 'start' | 'end', current: number) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const dir =
      event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    event.preventDefault();
    const step = event.shiftKey ? 5 : 1;
    const delta = edge === 'start' ? dir * step : -dir * step;
    const key = edge === 'start' ? startKey : endKey;
    onCommit({ [key]: current + delta });
  };

  const thumb = (edge: 'start' | 'end', pct: number, label: string, text: string, current: number) => (
    <button
      type="button"
      role="slider"
      aria-label={label}
      aria-orientation={axis}
      aria-valuemin={0}
      aria-valuemax={Math.max(0, Math.round(pageMm))}
      aria-valuenow={Math.round(current)}
      aria-valuetext={text}
      title={text}
      className="folio-margin-thumb no-print"
      onPointerDown={beginDrag(edge)}
      onKeyDown={nudge(edge, current)}
      style={{
        position: 'absolute',
        width: 14,
        height: 14,
        padding: 0,
        borderRadius: 2,
        background: 'var(--folio-teal)',
        border: '2px solid #ffffff',
        boxShadow: '0 0 0 1px var(--folio-teal)',
        cursor: axis === 'horizontal' ? 'ew-resize' : 'ns-resize',
        touchAction: 'none',
        zIndex: 2,
        ...(axis === 'horizontal'
          ? { left: `calc(${pct}% - 7px)`, top: 4 }
          : { top: `calc(${pct}% - 7px)`, left: 4 }),
      }}
    />
  );

  return (
    <div
      ref={trackRef}
      className="folio-margin-ruler no-print"
      style={{
        position: 'relative',
        flex: '0 0 auto',
        width: axis === 'horizontal' ? length : 22,
        height: axis === 'horizontal' ? 22 : length,
        background: '#ffffff',
        border: '1px solid var(--folio-border)',
        borderRadius: 2,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          position: 'absolute',
          background: 'rgba(15, 118, 110, 0.14)',
          ...(axis === 'horizontal'
            ? { left: 0, top: 0, bottom: 0, width: `${startPct}%` }
            : { top: 0, left: 0, right: 0, height: `${startPct}%` }),
        }}
      />
      <div
        style={{
          position: 'absolute',
          background: 'rgba(15, 118, 110, 0.14)',
          ...(axis === 'horizontal'
            ? { right: 0, top: 0, bottom: 0, width: `${endPct}%` }
            : { bottom: 0, left: 0, right: 0, height: `${endPct}%` }),
        }}
      />
      {thumb('start', startPct, startLabel, startText, startMm)}
      {thumb('end', 100 - endPct, endLabel, endText, endMm)}
    </div>
  );
};
