import { describe, it, expect } from 'vitest';
import {
  alignBoxes,
  distributeBoxes,
  reorder,
  type Box,
} from '../src/slides/geometry';

describe('Slide geometry — Align, Distribute, Z-Order', () => {
  const boxA: Box = { x: 10, y: 10, width: 20, height: 10 };
  const boxB: Box = { x: 40, y: 30, width: 30, height: 20 };

  describe('alignBoxes', () => {
    it('returns empty array or clone for single box', () => {
      expect(alignBoxes([], 'left')).toEqual([]);
      expect(alignBoxes([boxA], 'center')).toEqual([boxA]);
    });

    it('aligns left to bounding box minX', () => {
      const aligned = alignBoxes([boxA, boxB], 'left');
      expect(aligned[0].x).toBe(10);
      expect(aligned[1].x).toBe(10);
      expect(aligned[0].width).toBe(20);
      expect(aligned[1].width).toBe(30);
    });

    it('aligns right to bounding box maxX', () => {
      // maxX is 40 + 30 = 70
      const aligned = alignBoxes([boxA, boxB], 'right');
      expect(aligned[0].x).toBe(50); // 70 - 20
      expect(aligned[1].x).toBe(40); // 70 - 30
    });

    it('aligns center to bounding box midX', () => {
      // midX is (10 + 70) / 2 = 40
      const aligned = alignBoxes([boxA, boxB], 'center');
      expect(aligned[0].x).toBe(30); // 40 - 10
      expect(aligned[1].x).toBe(25); // 40 - 15
    });

    it('aligns top to bounding box minY', () => {
      const aligned = alignBoxes([boxA, boxB], 'top');
      expect(aligned[0].y).toBe(10);
      expect(aligned[1].y).toBe(10);
    });

    it('aligns bottom to bounding box maxY', () => {
      // maxY is 30 + 20 = 50
      const aligned = alignBoxes([boxA, boxB], 'bottom');
      expect(aligned[0].y).toBe(40); // 50 - 10
      expect(aligned[1].y).toBe(30); // 50 - 20
    });

    it('aligns middle to bounding box midY', () => {
      // midY is (10 + 50) / 2 = 30
      const aligned = alignBoxes([boxA, boxB], 'middle');
      expect(aligned[0].y).toBe(25); // 30 - 5
      expect(aligned[1].y).toBe(20); // 30 - 10
    });
  });

  describe('distributeBoxes', () => {
    it('returns copy for fewer than 3 boxes', () => {
      expect(distributeBoxes([], 'horizontal')).toEqual([]);
      expect(distributeBoxes([boxA, boxB], 'horizontal')).toEqual([boxA, boxB]);
    });

    it('distributes 3 boxes horizontally with equal gaps', () => {
      const b1: Box = { x: 0, y: 0, width: 10, height: 10 };
      const b2: Box = { x: 15, y: 0, width: 10, height: 10 };
      const b3: Box = { x: 60, y: 0, width: 10, height: 10 };

      // totalSpan: (60 + 10) - 0 = 70
      // totalWidth: 30
      // gap: (70 - 30) / 2 = 20
      // expected b1: 0, b2: 30 (0 + 10 + 20), b3: 60
      const distributed = distributeBoxes([b1, b2, b3], 'horizontal');
      expect(distributed[0].x).toBe(0);
      expect(distributed[1].x).toBe(30);
      expect(distributed[2].x).toBe(60);
    });

    it('distributes 3 boxes vertically with equal gaps', () => {
      const b1: Box = { x: 0, y: 0, width: 10, height: 10 };
      const b2: Box = { x: 0, y: 50, width: 10, height: 20 };
      const b3: Box = { x: 0, y: 100, width: 10, height: 10 };

      // b1: y=0, h=10
      // b2: y=50, h=20
      // b3: y=100, h=10
      // totalSpan: (100 + 10) - 0 = 110
      // totalHeight: 10 + 20 + 10 = 40
      // gap: (110 - 40) / 2 = 35
      // expected b1: 0, b2: 0 + 10 + 35 = 45, b3: 100
      const distributed = distributeBoxes([b1, b2, b3], 'vertical');
      expect(distributed[0].y).toBe(0);
      expect(distributed[1].y).toBe(45);
      expect(distributed[2].y).toBe(100);
    });

    it('preserves original array order when elements are out of position order', () => {
      const b1: Box = { x: 60, y: 0, width: 10, height: 10 };
      const b2: Box = { x: 0, y: 0, width: 10, height: 10 };
      const b3: Box = { x: 15, y: 0, width: 10, height: 10 };

      const distributed = distributeBoxes([b1, b2, b3], 'horizontal');
      expect(distributed[0].x).toBe(60); // b1 was the rightmost
      expect(distributed[1].x).toBe(0);  // b2 was the leftmost
      expect(distributed[2].x).toBe(30); // b3 was intermediate
    });
  });

  describe('reorder', () => {
    const el1 = { id: 'el-1' };
    const el2 = { id: 'el-2' };
    const el3 = { id: 'el-3' };
    const el4 = { id: 'el-4' };

    it('returns same array if id is not found', () => {
      const list = [el1, el2, el3];
      expect(reorder(list, 'missing', 'forward')).toEqual(list);
    });

    it('moves element forward by 1 index', () => {
      const list = [el1, el2, el3, el4];
      const result = reorder(list, 'el-2', 'forward');
      expect(result.map((e) => e.id)).toEqual(['el-1', 'el-3', 'el-2', 'el-4']);
    });

    it('does nothing when moving front element forward', () => {
      const list = [el1, el2, el3, el4];
      const result = reorder(list, 'el-4', 'forward');
      expect(result.map((e) => e.id)).toEqual(['el-1', 'el-2', 'el-3', 'el-4']);
    });

    it('moves element backward by 1 index', () => {
      const list = [el1, el2, el3, el4];
      const result = reorder(list, 'el-3', 'backward');
      expect(result.map((e) => e.id)).toEqual(['el-1', 'el-3', 'el-2', 'el-4']);
    });

    it('does nothing when moving bottom element backward', () => {
      const list = [el1, el2, el3, el4];
      const result = reorder(list, 'el-1', 'backward');
      expect(result.map((e) => e.id)).toEqual(['el-1', 'el-2', 'el-3', 'el-4']);
    });

    it('brings element to front (end of array)', () => {
      const list = [el1, el2, el3, el4];
      const result = reorder(list, 'el-2', 'front');
      expect(result.map((e) => e.id)).toEqual(['el-1', 'el-3', 'el-4', 'el-2']);
    });

    it('sends element to back (start of array)', () => {
      const list = [el1, el2, el3, el4];
      const result = reorder(list, 'el-3', 'back');
      expect(result.map((e) => e.id)).toEqual(['el-3', 'el-1', 'el-2', 'el-4']);
    });
  });
});

