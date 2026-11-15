import { describe, it, expect } from 'vitest';
import { snapBox, type Box } from '../src/slides/geometry';

describe('Slide snap and center guides', () => {
  it('snaps position to nearest 2% grid without center snap when far from 50%', () => {
    const box: Box = { x: 5.1, y: 7.9, width: 20, height: 10 };
    const res = snapBox(box, 2, true);

    expect(res.box.x).toBe(6);
    expect(res.box.y).toBe(8);
    expect(res.box.width).toBe(20);
    expect(res.box.height).toBe(10);
    expect(res.snappedVerticalCenter).toBe(false);
    expect(res.snappedHorizontalCenter).toBe(false);
  });

  it('snaps horizontal center (x-axis) to 50% slide center when within 1%', () => {
    // width is 20, center at 50 means x = 40
    // Start at x = 39.5 -> centerX = 49.5 (distance 0.5% from 50%)
    const box: Box = { x: 39.5, y: 10, width: 20, height: 10 };
    const res = snapBox(box, 2, true);

    expect(res.box.x).toBe(40);
    expect(res.snappedVerticalCenter).toBe(true);
    expect(res.snappedHorizontalCenter).toBe(false);
  });

  it('snaps vertical center (y-axis) to 50% slide center when within 1%', () => {
    // height is 10, center at 50 means y = 45
    // Start at y = 44.5 -> centerY = 49.5 (distance 0.5% from 50%)
    const box: Box = { x: 10, y: 44.5, width: 10, height: 10 };
    const res = snapBox(box, 2, true);

    expect(res.box.y).toBe(45);
    expect(res.snappedVerticalCenter).toBe(false);
    expect(res.snappedHorizontalCenter).toBe(true);
  });

  it('snaps both horizontal and vertical center when both are within 1%', () => {
    const box: Box = { x: 40.4, y: 44.6, width: 20, height: 10 };
    const res = snapBox(box, 2, true);

    expect(res.box.x).toBe(40);
    expect(res.box.y).toBe(45);
    expect(res.snappedVerticalCenter).toBe(true);
    expect(res.snappedHorizontalCenter).toBe(true);
  });

  it('skips grid snapping when gridPct is 0, but center snapping still works', () => {
    const box: Box = { x: 39.4, y: 12.3, width: 20, height: 10 };
    // centerX = 49.4 (within 1% of 50%)
    const res = snapBox(box, 0, true);

    expect(res.box.x).toBe(40); // snapped center
    expect(res.box.y).toBe(12.3); // unrounded
    expect(res.snappedVerticalCenter).toBe(true);
  });

  it('disables center snapping when snapToCenterGuides is false', () => {
    const box: Box = { x: 39.4, y: 12.3, width: 20, height: 10 };
    const res = snapBox(box, 0, false);

    expect(res.box.x).toBe(39.4);
    expect(res.box.y).toBe(12.3);
    expect(res.snappedVerticalCenter).toBe(false);
  });

  it('clamps coordinates within slide bounds', () => {
    const box: Box = { x: 95, y: -5, width: 20, height: 10 };
    const res = snapBox(box, 2, true);

    expect(res.box.x).toBe(80); // 100 - 20
    expect(res.box.y).toBe(0);
  });
});

