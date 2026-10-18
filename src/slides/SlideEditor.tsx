import React, { useEffect, useState } from 'react';
import { PresentationModel, Slide, SlideElement } from '../types';
import { createEmptySlide } from './pptxAdapter';
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Type,
  Image as ImageIcon,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';

interface SlideEditorProps {
  presentation: PresentationModel;
  onChange: (presentation: PresentationModel) => void;
  onSaveShortcut?: () => void;
  onActiveSlideChange?: (index: number) => void;
}

export const SlideEditor: React.FC<SlideEditorProps> = ({
  presentation,
  onChange,
  onSaveShortcut,
  onActiveSlideChange,
}) => {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  useEffect(() => {
    onActiveSlideChange?.(activeSlideIndex);
  }, [activeSlideIndex, onActiveSlideChange]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const slides = presentation.slides || [];
  const currentSlide = slides[activeSlideIndex] || slides[0];

  const updateSlides = (newSlides: Slide[]) => {
    onChange({
      ...presentation,
      slides: newSlides,
    });
  };

  const handleAddSlide = () => {
    const newSlide = createEmptySlide(slides.length + 1);
    const updated = [...slides, newSlide];
    updateSlides(updated);
    setActiveSlideIndex(updated.length - 1);
    setSelectedElementId(null);
  };

  const handleDeleteSlide = (index: number) => {
    if (slides.length <= 1) return;
    const updated = slides.filter((_, idx) => idx !== index);
    updateSlides(updated);
    setActiveSlideIndex(Math.max(0, index - 1));
    setSelectedElementId(null);
  };

  const handleDuplicateSlide = (index: number) => {
    const source = slides[index];
    const dup: Slide = {
      ...source,
      id: `slide_${Date.now()}`,
      title: `${source.title || 'Slide'} (Copy)`,
      elements: source.elements.map((e) => ({ ...e, id: `elem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` })),
    };
    const updated = [...slides.slice(0, index + 1), dup, ...slides.slice(index + 1)];
    updateSlides(updated);
    setActiveSlideIndex(index + 1);
  };

  const handleMoveSlide = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= slides.length) return;
    const copy = [...slides];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    updateSlides(copy);
    setActiveSlideIndex(target);
  };

  const handleUpdateElement = (elemId: string, updates: Partial<SlideElement>) => {
    if (!currentSlide) return;
    const updatedElements = currentSlide.elements.map((el) => {
      if (el.id === elemId) {
        return { ...el, ...updates };
      }
      return el;
    });

    const updatedSlides = slides.map((s, idx) => {
      if (idx === activeSlideIndex) {
        return { ...s, elements: updatedElements };
      }
      return s;
    });
    updateSlides(updatedSlides);
  };

  const handleAddTextBox = () => {
    if (!currentSlide) return;
    const newEl: SlideElement = {
      id: `txt_${Date.now()}`,
      type: 'text',
      x: 20,
      y: 25,
      width: 60,
      height: 20,
      text: 'Click to edit text',
      fontSize: 22,
      color: '#1e2022',
      align: 'left',
    };
    handleUpdateElement('', {}); // trigger
    const updatedElements = [...currentSlide.elements, newEl];
    const updatedSlides = slides.map((s, idx) => (idx === activeSlideIndex ? { ...s, elements: updatedElements } : s));
    updateSlides(updatedSlides);
    setSelectedElementId(newEl.id);
  };

  const handleAddImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && currentSlide) {
        const reader = new FileReader();
        reader.onload = (re) => {
          const src = re.target?.result as string;
          const newEl: SlideElement = {
            id: `pic_${Date.now()}`,
            type: 'image',
            x: 25,
            y: 20,
            width: 50,
            height: 50,
            src,
          };
          const updatedElements = [...currentSlide.elements, newEl];
          const updatedSlides = slides.map((s, idx) =>
            idx === activeSlideIndex ? { ...s, elements: updatedElements } : s
          );
          updateSlides(updatedSlides);
          setSelectedElementId(newEl.id);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleDeleteSelectedElement = () => {
    if (!selectedElementId || !currentSlide) return;
    const updatedElements = currentSlide.elements.filter((e) => e.id !== selectedElementId);
    const updatedSlides = slides.map((s, idx) => (idx === activeSlideIndex ? { ...s, elements: updatedElements } : s));
    updateSlides(updatedSlides);
    setSelectedElementId(null);
  };

  const selectedElem = currentSlide?.elements.find((e) => e.id === selectedElementId);

  return (
    <div
      className="folio-slides-workspace"
      style={{
        flex: 1,
        display: 'flex',
        height: '100%',
        backgroundColor: 'var(--folio-bg)',
        overflow: 'hidden',
      }}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          onSaveShortcut?.();
        }
        if (e.key === 'Delete' && selectedElementId) {
          handleDeleteSelectedElement();
        }
      }}
    >
      {/* Slide Thumbnails Sidebar */}
      <div
        className="folio-slides-sidebar"
        style={{
          width: '220px',
          backgroundColor: 'var(--folio-panel)',
          borderRight: '1px solid var(--folio-border)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        <div
          style={{
            padding: '10px 12px',
            borderBottom: '1px solid var(--folio-border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--folio-ink-muted)' }}>
            SLIDES ({slides.length})
          </span>
          <button
            onClick={handleAddSlide}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              background: 'var(--folio-teal)',
              color: 'white',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <Plus size={14} /> New
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {slides.map((s, idx) => (
            <div
              key={s.id || idx}
              onClick={() => {
                setActiveSlideIndex(idx);
                setSelectedElementId(null);
              }}
              style={{
                marginBottom: '10px',
                cursor: 'pointer',
                border: idx === activeSlideIndex ? '2px solid var(--folio-teal)' : '1px solid var(--folio-border)',
                borderRadius: '6px',
                padding: '6px',
                backgroundColor: idx === activeSlideIndex ? 'var(--folio-teal-tint)' : '#ffffff',
                boxShadow: 'var(--folio-shadow-sm)',
                transition: 'all 0.1s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '4px',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--folio-ink-muted)' }}>
                  Slide {idx + 1}
                </span>
                <div style={{ display: 'flex', gap: '2px' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleMoveSlide(idx, 'up')}
                    disabled={idx === 0}
                    style={{ padding: '2px', opacity: idx === 0 ? 0.3 : 1 }}
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    onClick={() => handleMoveSlide(idx, 'down')}
                    disabled={idx === slides.length - 1}
                    style={{ padding: '2px', opacity: idx === slides.length - 1 ? 0.3 : 1 }}
                  >
                    <ChevronDown size={12} />
                  </button>
                  <button onClick={() => handleDuplicateSlide(idx)} title="Duplicate" style={{ padding: '2px' }}>
                    <Copy size={12} />
                  </button>
                  {slides.length > 1 && (
                    <button
                      onClick={() => handleDeleteSlide(idx)}
                      title="Delete"
                      style={{ padding: '2px', color: '#dc2626' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Thumbnail miniature */}
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16 / 9',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--folio-border-light)',
                  borderRadius: '3px',
                  padding: '6px',
                  overflow: 'hidden',
                  fontSize: '8px',
                  color: 'var(--folio-ink-muted)',
                }}
              >
                {s.elements.find((e) => e.type === 'text')?.text?.slice(0, 50) || 'Blank Slide'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          overflow: 'auto',
          padding: '24px',
        }}
      >
        {/* Floating Element Toolbar */}
        <div
          style={{
            marginBottom: '16px',
            background: 'var(--folio-panel)',
            border: '1px solid var(--folio-border)',
            borderRadius: 'var(--folio-radius-md)',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: 'var(--folio-shadow-sm)',
          }}
        >
          <button
            onClick={handleAddTextBox}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '4px',
              background: 'var(--folio-bg)',
              fontWeight: 500,
            }}
          >
            <Type size={14} /> Add Text
          </button>
          <button
            onClick={handleAddImage}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '4px',
              background: 'var(--folio-bg)',
              fontWeight: 500,
            }}
          >
            <ImageIcon size={14} /> Add Picture
          </button>

          {selectedElem && (
            <>
              <div style={{ height: '16px', width: '1px', background: 'var(--folio-border)' }} />

              {selectedElem.type === 'text' && (
                <>
                  <button
                    onClick={() => handleUpdateElement(selectedElem.id, { bold: !selectedElem.bold })}
                    style={{
                      padding: '4px',
                      borderRadius: '4px',
                      background: selectedElem.bold ? 'var(--folio-teal-light)' : 'transparent',
                    }}
                  >
                    <Bold size={14} />
                  </button>
                  <button
                    onClick={() => handleUpdateElement(selectedElem.id, { italic: !selectedElem.italic })}
                    style={{
                      padding: '4px',
                      borderRadius: '4px',
                      background: selectedElem.italic ? 'var(--folio-teal-light)' : 'transparent',
                    }}
                  >
                    <Italic size={14} />
                  </button>
                  <button
                    onClick={() => handleUpdateElement(selectedElem.id, { underline: !selectedElem.underline })}
                    style={{
                      padding: '4px',
                      borderRadius: '4px',
                      background: selectedElem.underline ? 'var(--folio-teal-light)' : 'transparent',
                    }}
                  >
                    <Underline size={14} />
                  </button>

                  <select
                    value={selectedElem.fontSize || 18}
                    onChange={(e) => handleUpdateElement(selectedElem.id, { fontSize: parseInt(e.target.value, 10) })}
                    style={{
                      padding: '2px 4px',
                      borderRadius: '4px',
                      border: '1px solid var(--folio-border)',
                      fontSize: '12px',
                    }}
                  >
                    {[12, 14, 16, 18, 20, 24, 28, 32, 36, 44, 54, 72].map((sz) => (
                      <option key={sz} value={sz}>
                        {sz}pt
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleUpdateElement(selectedElem.id, { align: 'left' })}
                    style={{
                      padding: '4px',
                      borderRadius: '4px',
                      background: selectedElem.align === 'left' ? 'var(--folio-teal-light)' : 'transparent',
                    }}
                  >
                    <AlignLeft size={14} />
                  </button>
                  <button
                    onClick={() => handleUpdateElement(selectedElem.id, { align: 'center' })}
                    style={{
                      padding: '4px',
                      borderRadius: '4px',
                      background: selectedElem.align === 'center' ? 'var(--folio-teal-light)' : 'transparent',
                    }}
                  >
                    <AlignCenter size={14} />
                  </button>
                  <button
                    onClick={() => handleUpdateElement(selectedElem.id, { align: 'right' })}
                    style={{
                      padding: '4px',
                      borderRadius: '4px',
                      background: selectedElem.align === 'right' ? 'var(--folio-teal-light)' : 'transparent',
                    }}
                  >
                    <AlignRight size={14} />
                  </button>
                </>
              )}

              <button
                onClick={handleDeleteSelectedElement}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  color: '#dc2626',
                  marginLeft: 'auto',
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </>
          )}
        </div>

        {/* 16:9 Slide Canvas */}
        <div
          className="folio-slide-canvas"
          style={{
            width: '960px',
            height: '540px',
            backgroundColor: currentSlide?.background || '#ffffff',
            borderRadius: '4px',
            boxShadow: 'var(--folio-shadow-paper)',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid var(--folio-border)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedElementId(null);
            }
          }}
        >
          {currentSlide?.elements.map((elem) => {
            const isSelected = elem.id === selectedElementId;

            if (elem.type === 'text') {
              return (
                <div
                  key={elem.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedElementId(elem.id);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${elem.x}%`,
                    top: `${elem.y}%`,
                    width: `${elem.width}%`,
                    minHeight: `${elem.height}%`,
                    outline: isSelected ? '2px dashed var(--folio-teal)' : '1px dashed transparent',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '2px',
                    zIndex: isSelected ? 10 : 1,
                  }}
                >
                  <textarea
                    value={elem.text || ''}
                    onChange={(e) => handleUpdateElement(elem.id, { text: e.target.value })}
                    style={{
                      width: '100%',
                      height: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      resize: 'none',
                      fontFamily: elem.fontFamily || 'system-ui, sans-serif',
                      fontSize: `${elem.fontSize || 18}px`,
                      fontWeight: elem.bold ? 700 : 400,
                      fontStyle: elem.italic ? 'italic' : 'normal',
                      textDecoration: elem.underline ? 'underline' : 'none',
                      color: elem.color || '#1e2022',
                      textAlign: elem.align || 'left',
                      lineHeight: 1.3,
                    }}
                  />
                </div>
              );
            }

            if (elem.type === 'image' && elem.src) {
              return (
                <div
                  key={elem.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedElementId(elem.id);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${elem.x}%`,
                    top: `${elem.y}%`,
                    width: `${elem.width}%`,
                    height: `${elem.height}%`,
                    outline: isSelected ? '2px dashed var(--folio-teal)' : 'none',
                    cursor: 'pointer',
                    zIndex: isSelected ? 10 : 1,
                  }}
                >
                  <img
                    src={elem.src}
                    alt="Slide graphic"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
};

