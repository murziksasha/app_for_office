import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { PresentationModel, Slide, SlideElement } from '../types';
import { createEmptySlide } from './pptxAdapter';
import { Box, ResizeDir, minPercents, moveBox, resizeBox } from './geometry';
import { VIDEO_MSG, bytesToBase64, probeVideoPlayable, sniffMp4 } from './videoFile';
import { Plus, Trash2, Copy, ChevronUp, ChevronDown, Play, Pause } from 'lucide-react';

export interface SlideEditorHandle {
  addSlide: () => void;
  duplicateSlide: () => void;
  deleteSlide: () => void;
  moveSlide: (direction: 'up' | 'down') => void;
  addText: () => void;
  addImage: () => void;
  addVideo: () => void;
  addShape: () => void;
  undo: () => void;
  deleteSelected: () => void;
  patchSelected: (updates: Partial<SlideElement>) => void;
}

export interface SlideCommandState {
  canUndo: boolean;
  slideCount: number;
  slideIndex: number;
  element: Pick<SlideElement, 'id' | 'type' | 'bold' | 'italic' | 'underline' | 'fontSize' | 'color' | 'align'> | null;
}

export const emptySlideCommandState: SlideCommandState = {
  canUndo: false,
  slideCount: 0,
  slideIndex: 0,
  element: null,
};

interface SlideEditorProps {
  presentation: PresentationModel;
  onChange: (presentation: PresentationModel) => void;
  onSaveShortcut?: () => void;
  onActiveSlideChange?: (index: number) => void;
  onSelectionChange?: (state: SlideCommandState) => void;
}

interface UndoSlot {
  slideIndex: number;
  elementId: string;
  box: Box;
}

interface Gesture {
  id: string;
  elementType: SlideElement['type'];
  mode: 'move' | 'resize';
  dir?: ResizeDir;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  orig: Box;
  dragged: boolean;
  wasSelected: boolean;
  canvasW: number;
  canvasH: number;
}

const RESIZE_DIRS: ResizeDir[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function resizeCursor(dir: ResizeDir): string {
  if (dir === 'n' || dir === 's') return 'ns-resize';
  if (dir === 'e' || dir === 'w') return 'ew-resize';
  if (dir === 'nw' || dir === 'se') return 'nwse-resize';
  return 'nesw-resize';
}

function resizeHandleStyle(dir: ResizeDir): React.CSSProperties {
  const edge = 8;
  const corner = 10;
  const base: React.CSSProperties = {
    position: 'absolute',
    zIndex: dir.length === 2 ? 4 : 3,
    touchAction: 'none',
    cursor: resizeCursor(dir),
  };
  if (dir.length === 2) {
    return {
      ...base,
      width: corner,
      height: corner,
      background: 'var(--folio-teal)',
      border: '1px solid #fff',
      top: dir.includes('n') ? -1 : undefined,
      bottom: dir.includes('s') ? -1 : undefined,
      left: dir.includes('w') ? -1 : undefined,
      right: dir.includes('e') ? -1 : undefined,
    };
  }
  if (dir === 'n' || dir === 's') {
    return {
      ...base,
      left: corner,
      right: corner,
      height: edge,
      top: dir === 'n' ? 0 : undefined,
      bottom: dir === 's' ? 0 : undefined,
    };
  }
  return {
    ...base,
    top: corner,
    bottom: corner,
    width: edge,
    left: dir === 'w' ? 0 : undefined,
    right: dir === 'e' ? 0 : undefined,
  };
}

function boxOf(elem: SlideElement): Box {
  return { x: elem.x, y: elem.y, width: elem.width, height: elem.height };
}

export const SlideEditor = React.forwardRef<SlideEditorHandle, SlideEditorProps>(function SlideEditor(
  { presentation, onChange, onSaveShortcut, onActiveSlideChange, onSelectionChange },
  ref,
) {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [undoSlot, setUndoSlot] = useState<UndoSlot | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const presentationRef = useRef(presentation);
  const gesturingRef = useRef(false);
  const gestureRef = useRef<Gesture | null>(null);
  const onChangeRef = useRef(onChange);
  const indexRef = useRef(activeSlideIndex);
  const undoRef = useRef(undoSlot);
  const playheadsRef = useRef<Record<string, number>>({});
  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const pendingEditRef = useRef<string | null>(null);
  const stopGestureRef = useRef<(() => void) | null>(null);

  onChangeRef.current = onChange;
  indexRef.current = activeSlideIndex;
  undoRef.current = undoSlot;

  useEffect(() => {
    if (!gesturingRef.current) presentationRef.current = presentation;
  }, [presentation]);

  useEffect(() => {
    onActiveSlideChange?.(activeSlideIndex);
  }, [activeSlideIndex, onActiveSlideChange]);

  useEffect(() => {
    const cache = urlCacheRef.current;
    return () => {
      stopGestureRef.current?.();
      for (const url of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
    };
  }, []);

  const slides = presentation.slides || [];
  const currentSlide = slides[activeSlideIndex] || slides[0];

  const commit = (nextSlides: Slide[]) => {
    const updated = { ...presentationRef.current, slides: nextSlides };
    presentationRef.current = updated;
    onChangeRef.current(updated);
  };

  const mapActive = (recipe: (elements: SlideElement[]) => SlideElement[]) => {
    const idx = indexRef.current;
    const next = (presentationRef.current.slides || []).map((slide, i) =>
      i === idx ? { ...slide, elements: recipe(slide.elements) } : slide
    );
    commit(next);
  };

  const clearUndo = () => setUndoSlot(null);

  const applyUndo = () => {
    const slot = undoRef.current;
    if (!slot) return;
    const next = (presentationRef.current.slides || []).map((slide, i) => {
      if (i !== slot.slideIndex) return slide;
      return {
        ...slide,
        elements: slide.elements.map((el) => (el.id === slot.elementId ? { ...el, ...slot.box } : el)),
      };
    });
    commit(next);
    setUndoSlot(null);
    setActiveSlideIndex(slot.slideIndex);
    setSelectedElementId(slot.elementId);
    setEditingId(null);
  };

  const updateElementBox = (id: string, box: Box) => {
    mapActive((elements) => elements.map((el) => (el.id === id ? { ...el, ...box } : el)));
  };

  const patchElement = (elemId: string, updates: Partial<SlideElement>, dropsUndo = false) => {
    if (dropsUndo) clearUndo();
    mapActive((elements) => elements.map((el) => (el.id === elemId ? { ...el, ...updates } : el)));
  };

  const playbackSrc = (id: string, src: string): string => {
    const cached = urlCacheRef.current.get(id);
    if (cached) return cached;
    if (!src.startsWith('data:')) return src;
    try {
      const comma = src.indexOf(',');
      const header = src.slice(0, comma);
      const mime = header.slice(5).split(';')[0] || 'video/mp4';
      const binary = atob(src.slice(comma + 1));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      urlCacheRef.current.set(id, url);
      return url;
    } catch {
      return src;
    }
  };

  const focusShell = () => shellRef.current?.focus({ preventScroll: true });

  const handleAddSlide = () => {
    clearUndo();
    const next = [...(presentationRef.current.slides || []), createEmptySlide((presentationRef.current.slides || []).length + 1)];
    commit(next);
    setActiveSlideIndex(next.length - 1);
    setSelectedElementId(null);
    setEditingId(null);
  };

  const handleDeleteSlide = (index: number) => {
    const existing = presentationRef.current.slides || [];
    if (existing.length <= 1) return;
    clearUndo();
    commit(existing.filter((_, idx) => idx !== index));
    setActiveSlideIndex(Math.max(0, index - 1));
    setSelectedElementId(null);
    setEditingId(null);
  };

  const handleDuplicateSlide = (index: number) => {
    const existing = presentationRef.current.slides || [];
    const source = existing[index];
    if (!source) return;
    const dup: Slide = {
      ...source,
      id: `slide_${Date.now()}`,
      title: `${source.title || 'Slide'} (Copy)`,
      elements: source.elements.map((e) => ({
        ...e,
        id: `elem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      })),
    };
    const next = [...existing.slice(0, index + 1), dup, ...existing.slice(index + 1)];
    commit(next);
    setActiveSlideIndex(index + 1);
    setSelectedElementId(null);
    setEditingId(null);
  };

  const handleMoveSlide = (index: number, direction: 'up' | 'down') => {
    const existing = presentationRef.current.slides || [];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= existing.length) return;
    clearUndo();
    const copy = [...existing];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    commit(copy);
    setActiveSlideIndex(target);
  };

  const handleAddTextBox = () => {
    clearUndo();
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
    mapActive((elements) => [...elements, newEl]);
    setSelectedElementId(newEl.id);
    setEditingId(null);
  };

  const handleAddImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      const slide = (presentationRef.current.slides || [])[indexRef.current];
      if (!file || !slide) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        clearUndo();
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
        mapActive((elements) => [...elements, newEl]);
        setSelectedElementId(newEl.id);
        setEditingId(null);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleAddVideo = () => {
    const slide = (presentationRef.current.slides || [])[indexRef.current];
    if (!slide) return;
    if (slide.elements.some((el) => el.type === 'video')) {
      setNotice(VIDEO_MSG.second);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,.mp4';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      const live = (presentationRef.current.slides || [])[indexRef.current];
      if (!file || !live) return;
      if (live.elements.some((el) => el.type === 'video')) {
        setNotice(VIDEO_MSG.second);
        return;
      }
      if (!file.name.toLowerCase().endsWith('.mp4')) {
        setNotice(VIDEO_MSG.notMp4);
        return;
      }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const sniff = sniffMp4(bytes, file.name);
        if (!sniff.isMp4) {
          setNotice(VIDEO_MSG.notMp4);
          return;
        }
        const playable = await probeVideoPlayable(file);
        if (!playable) {
          setNotice(VIDEO_MSG.cannotPlay);
          return;
        }
        setNotice(sniff.h264 ? null : VIDEO_MSG.otherPrograms);
        const newEl: SlideElement = {
          id: `vid_${Date.now()}`,
          type: 'video',
          x: 20,
          y: 18,
          width: 60,
          height: 48,
          src: `data:video/mp4;base64,${bytesToBase64(bytes)}`,
        };
        const objectUrl = URL.createObjectURL(file);
        urlCacheRef.current.set(newEl.id, objectUrl);
        clearUndo();
        mapActive((elements) => [...elements, newEl]);
        setSelectedElementId(newEl.id);
        setEditingId(null);
      } catch {
        setNotice(VIDEO_MSG.cannotPlay);
      }
    };
    input.click();
  };

  const handleAddShape = () => {
    clearUndo();
    const newEl: SlideElement = {
      id: `rect_${Date.now()}`,
      type: 'rect',
      x: 30,
      y: 30,
      width: 28,
      height: 18,
      fill: '#d6f3ef',
      borderColor: '#0f766e',
      borderWidth: 2,
    };
    mapActive((elements) => [...elements, newEl]);
    setSelectedElementId(newEl.id);
    setEditingId(null);
  };

  const handleDeleteSelectedElement = () => {
    if (!selectedElementId) return;
    const id = selectedElementId;
    clearUndo();
    mapActive((elements) => elements.filter((el) => el.id !== id));
    const cached = urlCacheRef.current.get(id);
    if (cached) {
      URL.revokeObjectURL(cached);
      urlCacheRef.current.delete(id);
    }
    delete playheadsRef.current[id];
    setSelectedElementId(null);
    setEditingId(null);
  };

  const beginGesture = (
    event: React.PointerEvent,
    elem: SlideElement,
    mode: 'move' | 'resize',
    dir?: ResizeDir
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    gestureRef.current = {
      id: elem.id,
      elementType: elem.type,
      mode,
      dir,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      orig: boxOf(elem),
      dragged: false,
      wasSelected: selectedElementId === elem.id,
      canvasW: rect.width,
      canvasH: rect.height,
    };
    gesturingRef.current = true;
    setSelectedElementId(elem.id);
    if (!(elem.type === 'text' && selectedElementId === elem.id)) setEditingId(null);
    focusShell();

    const move = (ev: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || ev.pointerId !== gesture.pointerId) return;
      const dxPx = ev.clientX - gesture.startClientX;
      const dyPx = ev.clientY - gesture.startClientY;
      if (!gesture.dragged && Math.hypot(dxPx, dyPx) < 4) return;
      gesture.dragged = true;
      const { minWidth, minHeight } = minPercents(gesture.canvasW, gesture.canvasH);
      const dx = (dxPx / gesture.canvasW) * 100;
      const dy = (dyPx / gesture.canvasH) * 100;
      const next =
        gesture.mode === 'move'
          ? moveBox(gesture.orig, dx, dy, minWidth, minHeight)
          : resizeBox(gesture.orig, gesture.dir || 'se', dx, dy, minWidth, minHeight);
      updateElementBox(gesture.id, next);
    };
    const end = (ev: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || ev.pointerId !== gesture.pointerId) return;
      stopGestureRef.current?.();
      stopGestureRef.current = null;
      gestureRef.current = null;
      gesturingRef.current = false;
      if (gesture.dragged) {
        const live = (presentationRef.current.slides || [])[indexRef.current]?.elements.find((el) => el.id === gesture.id);
        const moved =
          !!live &&
          (live.x !== gesture.orig.x ||
            live.y !== gesture.orig.y ||
            live.width !== gesture.orig.width ||
            live.height !== gesture.orig.height);
        if (moved) setUndoSlot({ slideIndex: indexRef.current, elementId: gesture.id, box: gesture.orig });
        return;
      }
      if (gesture.mode === 'move' && gesture.elementType === 'text' && gesture.wasSelected) {
        pendingEditRef.current = gesture.id;
        setEditingId(gesture.id);
      }
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    stopGestureRef.current = stop;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };

  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  useImperativeHandle(
    ref,
    () => ({
      addSlide: handleAddSlide,
      duplicateSlide: () => handleDuplicateSlide(indexRef.current),
      deleteSlide: () => handleDeleteSlide(indexRef.current),
      moveSlide: (direction) => handleMoveSlide(indexRef.current, direction),
      addText: handleAddTextBox,
      addImage: handleAddImage,
      addVideo: handleAddVideo,
      addShape: handleAddShape,
      undo: applyUndo,
      deleteSelected: handleDeleteSelectedElement,
      patchSelected: (updates) => {
        const id = selectedElementId;
        if (!id) return;
        patchElement(id, updates, true);
      },
    }),
    [selectedElementId],
  );

  useEffect(() => {
    const slide = (presentationRef.current.slides || [])[indexRef.current];
    const el = slide?.elements.find((item) => item.id === selectedElementId) || null;
    onSelectionChangeRef.current?.({
      canUndo: Boolean(undoSlot),
      slideCount: (presentationRef.current.slides || []).length,
      slideIndex: indexRef.current,
      element: el
        ? {
            id: el.id,
            type: el.type,
            bold: el.bold,
            italic: el.italic,
            underline: el.underline,
            fontSize: el.fontSize,
            color: el.color,
            align: el.align,
          }
        : null,
    });
  }, [selectedElementId, undoSlot, presentation, activeSlideIndex]);

  return (
    <div
      ref={shellRef}
      className="folio-slides-workspace"
      tabIndex={0}
      style={{
        flex: 1,
        display: 'flex',
        height: '100%',
        backgroundColor: 'var(--folio-bg)',
        overflow: 'hidden',
        outline: 'none',
      }}
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('textarea, input, select, button')) return;
        focusShell();
      }}
      onKeyDown={(e) => {
        const target = e.target as HTMLElement;
        const typing = target.closest('textarea, input, select');
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
          e.preventDefault();
          onSaveShortcut?.();
        }
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
          if (typing) return;
          e.preventDefault();
          applyUndo();
        }
        if (e.key === 'Delete' && selectedElementId && !typing) {
          e.preventDefault();
          handleDeleteSelectedElement();
        }
      }}
    >
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
            type="button"
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
                setEditingId(null);
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
                    type="button"
                    onClick={() => handleMoveSlide(idx, 'up')}
                    disabled={idx === 0}
                    style={{ padding: '2px', opacity: idx === 0 ? 0.3 : 1 }}
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveSlide(idx, 'down')}
                    disabled={idx === slides.length - 1}
                    style={{ padding: '2px', opacity: idx === slides.length - 1 ? 0.3 : 1 }}
                  >
                    <ChevronDown size={12} />
                  </button>
                  <button type="button" onClick={() => handleDuplicateSlide(idx)} title="Duplicate" style={{ padding: '2px' }}>
                    <Copy size={12} />
                  </button>
                  {slides.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteSlide(idx)}
                      title="Delete"
                      style={{ padding: '2px', color: '#dc2626' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
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
                {s.elements.find((e) => e.type === 'text')?.text?.slice(0, 50) ||
                  (s.elements.some((e) => e.type === 'video') ? 'Video' : 'Blank Slide')}
              </div>
            </div>
          ))}
        </div>
      </div>

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
        {notice && (
          <div
            role="status"
            style={{
              marginBottom: '12px',
              maxWidth: '960px',
              width: '100%',
              background: '#fff8e8',
              border: '1px solid #e6d3a1',
              borderRadius: '4px',
              padding: '8px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px',
              fontSize: '13px',
              color: '#5c4a1f',
            }}
          >
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} style={{ fontWeight: 600 }}>
              Dismiss
            </button>
          </div>
        )}

        <div
          ref={canvasRef}
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
            flexShrink: 0,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedElementId(null);
              setEditingId(null);
            }
          }}
        >
          {currentSlide?.elements.map((elem, elemIndex) => {
            const isSelected = elem.id === selectedElementId;
            const isEditing = editingId === elem.id;
            return (
              <div
                key={elem.id}
                onPointerDown={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('[data-folio-no-drag]')) return;
                  if (elem.type === 'text' && isEditing) return;
                  e.stopPropagation();
                  beginGesture(e, elem, 'move');
                }}
                style={{
                  position: 'absolute',
                  left: `${elem.x}%`,
                  top: `${elem.y}%`,
                  width: `${elem.width}%`,
                  height: elem.type === 'text' ? undefined : `${elem.height}%`,
                  minHeight: elem.type === 'text' ? `${elem.height}%` : undefined,
                  outline: isSelected ? '2px dashed var(--folio-teal)' : 'none',
                  cursor: 'move',
                  padding: elem.type === 'text' ? '6px' : 0,
                  borderRadius: '2px',
                  zIndex: elemIndex + 1,
                  boxSizing: 'border-box',
                  userSelect: isEditing ? 'text' : 'none',
                  touchAction: 'none',
                }}
              >
                {elem.type === 'text' && (
                  <textarea
                    data-folio-no-drag={isEditing ? '' : undefined}
                    readOnly={!isEditing}
                    ref={(node) => {
                      if (node && pendingEditRef.current === elem.id) {
                        pendingEditRef.current = null;
                        node.focus();
                      }
                    }}
                    value={elem.text || ''}
                    onChange={(e) => {
                      clearUndo();
                      patchElement(elem.id, { text: e.target.value });
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      minHeight: '100%',
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
                      pointerEvents: isEditing ? 'auto' : 'none',
                      cursor: isEditing ? 'text' : 'move',
                    }}
                  />
                )}

                {elem.type === 'image' && elem.src && (
                  <img
                    src={elem.src}
                    alt=""
                    draggable={false}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                  />
                )}

                {elem.type === 'rect' && (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background: elem.fill || '#e2ded6',
                      border: elem.borderColor ? `${elem.borderWidth || 1}px solid ${elem.borderColor}` : undefined,
                      pointerEvents: 'none',
                    }}
                  />
                )}

                {elem.type === 'video' && elem.src && (
                  <VideoBlock
                    src={playbackSrc(elem.id, elem.src)}
                    elementId={elem.id}
                    playheads={playheadsRef}
                    onError={() => setNotice(VIDEO_MSG.cannotPlay)}
                  />
                )}

                {isSelected &&
                  RESIZE_DIRS.map((dir) => (
                    <div
                      key={dir}
                      data-folio-resize={dir}
                      style={resizeHandleStyle(dir)}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        beginGesture(e, elem, 'resize', dir);
                      }}
                    />
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

function VideoBlock({
  src,
  elementId,
  playheads,
  onError,
}: {
  src: string;
  elementId: string;
  playheads: React.MutableRefObject<Record<string, number>>;
  onError: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(true);
  const [time, setTime] = useState(playheads.current[elementId] || 0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const node = ref.current;
    return () => {
      if (node) playheads.current[elementId] = node.currentTime;
    };
  }, [elementId, playheads]);

  const toggle = () => {
    const node = ref.current;
    if (!node) return;
    if (node.paused) void node.play();
    else node.pause();
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <video
        ref={ref}
        src={src}
        playsInline
        preload="metadata"
        style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', background: 'transparent' }}
        onLoadedMetadata={(e) => {
          const node = e.currentTarget;
          const remembered = playheads.current[elementId] || 0;
          if (remembered > 0 && Number.isFinite(node.duration) && remembered < node.duration) {
            node.currentTime = remembered;
          }
          setDuration(Number.isFinite(node.duration) ? node.duration : 0);
          setTime(node.currentTime || 0);
        }}
        onTimeUpdate={(e) => {
          playheads.current[elementId] = e.currentTarget.currentTime;
          setTime(e.currentTarget.currentTime);
        }}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onError={onError}
      />
      <div
        data-folio-no-drag
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: 8,
          right: 8,
          bottom: 10,
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 6px',
          background: 'rgba(20, 24, 28, 0.78)',
          borderRadius: 4,
          color: 'white',
        }}
      >
        <button
          type="button"
          onClick={toggle}
          aria-label={paused ? 'Play' : 'Pause'}
          style={{
            display: 'flex',
            alignItems: 'center',
            color: 'white',
            background: 'transparent',
            padding: 2,
          }}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(time, duration || 0)}
          aria-label="Seek"
          onChange={(e) => {
            const node = ref.current;
            const next = Number(e.target.value);
            if (node) node.currentTime = next;
            playheads.current[elementId] = next;
            setTime(next);
          }}
          style={{ flex: 1, minWidth: 0 }}
        />
      </div>
    </div>
  );
}
