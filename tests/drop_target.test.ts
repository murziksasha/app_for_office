import { describe, expect, it } from 'vitest';
import { dropHitsTarget, measureHomeDropTarget, type DropBox } from '../src/shell/dropTarget';

const box: DropBox = { left: 10, top: 10, right: 100, bottom: 80, shown: true };

describe('home drop hit test', () => {
  it('counts a physical point inside the scaled box', () => {
    expect(dropHitsTarget({ x: 150, y: 150 }, box, 2)).toBe(true);
    expect(dropHitsTarget({ x: 20, y: 20 }, box, 2)).toBe(true);
    expect(dropHitsTarget({ x: 200, y: 160 }, box, 2)).toBe(true);
  });

  it('misses a point outside the box', () => {
    expect(dropHitsTarget({ x: 19, y: 150 }, box, 2)).toBe(false);
    expect(dropHitsTarget({ x: 201, y: 150 }, box, 2)).toBe(false);
    expect(dropHitsTarget({ x: 150, y: 161 }, box, 2)).toBe(false);
  });

  it('misses when the box is absent', () => {
    expect(dropHitsTarget({ x: 150, y: 150 }, null, 2)).toBe(false);
    expect(dropHitsTarget(null, box, 2)).toBe(false);
    expect(dropHitsTarget({ x: Number.NaN, y: 10 }, box, 1)).toBe(false);
  });

  it('accepts a logical point that the physical reading would miss', () => {
    const home: DropBox = { left: 100, top: 400, right: 900, bottom: 700, shown: true };
    expect(dropHitsTarget({ x: 150, y: 450 }, home, 1.5)).toBe(true);
    expect(dropHitsTarget({ x: 10, y: 10 }, home, 1.5)).toBe(false);
    expect(dropHitsTarget({ x: 200, y: 500 }, home, 1.25)).toBe(true);
    expect(dropHitsTarget({ x: 400, y: 800 }, home, 2)).toBe(true);
  });

  it('misses when the box is not shown', () => {
    expect(dropHitsTarget({ x: 50, y: 40 }, { ...box, shown: false }, 1)).toBe(false);
  });

  it('treats a missing or hidden element as not shown', () => {
    document.body.innerHTML = '';
    expect(measureHomeDropTarget(document)).toBeNull();

    const hidden = document.createElement('div');
    hidden.setAttribute('data-folio-drop-target', '');
    hidden.style.display = 'none';
    document.body.appendChild(hidden);
    expect(measureHomeDropTarget(document)?.shown).toBe(false);
    document.body.innerHTML = '';
  });
});
