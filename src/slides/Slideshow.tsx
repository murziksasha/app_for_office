import React, { useEffect, useState } from 'react';
import { Slide, SlideElement } from '../types';
import {
  getInitialSlideIndex,
  getNextSlideIndex,
  getPrevSlideIndex,
  isExitKey,
  isNextSlideKey,
  isPrevSlideKey,
  isRightHalfClick,
} from './slideshowNavigation';
import { X, ChevronLeft, ChevronRight, Target } from 'lucide-react';

interface SlideshowProps {
  slides: Slide[];
  initialIndex?: number;
  mode?: 'beginning' | 'current';
  slideSize?: '16:9' | '16:10' | '4:3';
  onExit: () => void;
}

export const Slideshow: React.FC<SlideshowProps> = ({
  slides,
  initialIndex = 0,
  mode = 'current',
  slideSize = '16:9',
  onExit,
}) => {
  const [index, setIndex] = useState(() =>
    getInitialSlideIndex(mode, initialIndex, slides.length)
  );
  const [laserActive, setLaserActive] = useState(false);
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });

  const baseWidth = 960;
  const baseHeight = slideSize === '4:3' ? 720 : slideSize === '16:10' ? 600 : 540;

  const [windowSize, setWindowSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scale = Math.min(
    (windowSize.width - 24) / baseWidth,
    (windowSize.height - 24) / baseHeight
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isExitKey(e.key)) {
        e.preventDefault();
        onExit();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        setLaserActive((v) => !v);
      } else if (isNextSlideKey(e.key)) {
        e.preventDefault();
        setIndex((i) => getNextSlideIndex(i, slides.length));
      } else if (isPrevSlideKey(e.key)) {
        e.preventDefault();
        setIndex((i) => getPrevSlideIndex(i, slides.length));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slides.length, onExit]);

  const currentSlide: Slide | undefined = slides[index] || slides[0];

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Avoid advancing if clicked on video controls or close button
    const target = e.target as HTMLElement;
    if (target.closest('button, video, input, textarea, [data-folio-no-advance]')) {
      return;
    }
    if (isRightHalfClick(e.clientX, windowSize.width)) {
      setIndex((i) => getNextSlideIndex(i, slides.length));
    } else {
      setIndex((i) => getPrevSlideIndex(i, slides.length));
    }
  };

  return (
    <div
      role="region"
      aria-label="Slide Show"
      data-testid="folio-slideshow"
      onClick={handleClick}
      onMouseMove={(e) => {
        setMousePos({ x: e.clientX, y: e.clientY });
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000000',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        userSelect: 'none',
        cursor: laserActive ? 'none' : 'default',
      }}
    >
      {/* Slide Canvas */}
      <div
        data-testid="slideshow-slide"
        style={{
          width: `${baseWidth}px`,
          height: `${baseHeight}px`,
          backgroundColor: currentSlide?.background || '#ffffff',
          position: 'relative',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
          overflow: 'hidden',
        }}
      >
        {(currentSlide?.elements || []).map((elem) => (
          <SlideshowElement key={elem.id} element={elem} />
        ))}
      </div>

      {/* Controls Overlay */}
      <div
        data-folio-no-advance
        style={{
          position: 'absolute',
          bottom: 12,
          right: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          backgroundColor: 'rgba(20, 24, 28, 0.75)',
          padding: '4px 12px',
          borderRadius: 6,
          color: '#ffffff',
          fontSize: 12,
          zIndex: 10,
        }}
      >
        <button
          type="button"
          aria-label="Previous slide"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => getPrevSlideIndex(i, slides.length));
          }}
          disabled={index === 0}
          style={{
            background: 'none',
            border: 'none',
            color: index === 0 ? '#6b7280' : '#ffffff',
            cursor: index === 0 ? 'default' : 'pointer',
            padding: 2,
          }}
        >
          <ChevronLeft size={16} />
        </button>
        <span data-testid="slideshow-counter">
          {index + 1} / {slides.length}
        </span>
        <button
          type="button"
          aria-label="Next slide"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => getNextSlideIndex(i, slides.length));
          }}
          disabled={index >= slides.length - 1}
          style={{
            background: 'none',
            border: 'none',
            color: index >= slides.length - 1 ? '#6b7280' : '#ffffff',
            cursor: index >= slides.length - 1 ? 'default' : 'pointer',
            padding: 2,
          }}
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          aria-label="Laser pointer"
          data-testid="slideshow-laser-btn"
          onClick={(e) => {
            e.stopPropagation();
            setLaserActive((v) => !v);
          }}
          style={{
            background: laserActive ? 'rgba(239, 68, 68, 0.4)' : 'none',
            border: laserActive ? '1px solid #ef4444' : 'none',
            borderRadius: 4,
            color: laserActive ? '#ef4444' : '#ffffff',
            cursor: 'pointer',
            padding: '2px 4px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
          }}
          title="Laser pointer (L)"
        >
          <Target size={14} />
        </button>
        <button
          type="button"
          aria-label="Exit slideshow"
          data-testid="folio-slideshow-exit"
          onClick={(e) => {
            e.stopPropagation();
            onExit();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#ffffff',
            cursor: 'pointer',
            padding: 2,
            marginLeft: 4,
          }}
        >
          <X size={16} />
        </button>
      </div>

      {laserActive && (
        <div
          data-testid="slideshow-laser"
          className="folio-laser-pointer"
          style={{
            position: 'fixed',
            left: mousePos.x,
            top: mousePos.y,
            width: 14,
            height: 14,
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            boxShadow: '0 0 10px 3px rgba(239, 68, 68, 0.8), 0 0 20px 6px rgba(239, 68, 68, 0.5)',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 100000,
            transition: 'transform 0.05s ease-out',
          }}
        />
      )}
    </div>
  );
};

function SlideshowElement({ element: elem }: { element: SlideElement }) {
  const isLine = elem.shape === 'line';

  return (
    <div
      style={{
        position: 'absolute',
        left: `${elem.x}%`,
        top: `${elem.y}%`,
        width: `${elem.width}%`,
        height: `${elem.height}%`,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {elem.type === 'text' && (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              elem.align === 'left' ? 'flex-start' : elem.align === 'right' ? 'flex-end' : 'center',
            textAlign: elem.align || 'left',
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

      {elem.type === 'image' && elem.src && (
        <img
          src={elem.src}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
      )}

      {elem.type === 'rect' && (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {isLine ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
              <div
                style={{
                  width: '100%',
                  borderTop: `${elem.borderWidth || 2}px solid ${elem.borderColor || '#0f766e'}`,
                }}
              />
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
                border: elem.borderColor ? `${elem.borderWidth || 1}px solid ${elem.borderColor}` : 'none',
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
                borderRadius: elem.shape === 'roundRect' ? 8 : 0,
                backgroundColor: elem.fill || '#d6f3ef',
                border: elem.borderColor ? `${elem.borderWidth || 1}px solid ${elem.borderColor}` : 'none',
                boxSizing: 'border-box',
              }}
            />
          )}

          {elem.text && (
            <div
              style={{
                position: 'relative',
                zIndex: 2,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent:
                  elem.align === 'left' ? 'flex-start' : elem.align === 'right' ? 'flex-end' : 'center',
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
      )}

      {elem.type === 'table' && elem.rows && (
        <table
          style={{
            width: '100%',
            height: '100%',
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
                      border: '1px solid #1e2022',
                      padding: '4px',
                      fontSize: '13px',
                      color: elem.color || '#1e2022',
                      fontFamily: elem.fontFamily || 'system-ui, sans-serif',
                      verticalAlign: 'top',
                    }}
                  >
                    {cellText}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {elem.type === 'video' && elem.src && (
        <video
          src={elem.src}
          controls
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      )}
    </div>
  );
}
