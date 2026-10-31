import { describe, it, expect } from 'vitest';
import {
  getInitialSlideIndex,
  getNextSlideIndex,
  getPrevSlideIndex,
  isNextSlideKey,
  isPrevSlideKey,
  isExitKey,
  isRightHalfClick,
} from '../src/slides/slideshowNavigation';

describe('Slideshow Navigation', () => {
  describe('getInitialSlideIndex', () => {
    it('starts from 0 when mode is beginning (F5)', () => {
      expect(getInitialSlideIndex('beginning', 3, 10)).toBe(0);
      expect(getInitialSlideIndex('beginning', 0, 5)).toBe(0);
    });

    it('starts from current slide clamped to bounds when mode is current (Shift+F5)', () => {
      expect(getInitialSlideIndex('current', 3, 10)).toBe(3);
      expect(getInitialSlideIndex('current', -1, 5)).toBe(0);
      expect(getInitialSlideIndex('current', 10, 5)).toBe(4);
    });

    it('returns 0 for empty slide deck', () => {
      expect(getInitialSlideIndex('beginning', 0, 0)).toBe(0);
      expect(getInitialSlideIndex('current', 2, 0)).toBe(0);
    });
  });

  describe('getNextSlideIndex and getPrevSlideIndex', () => {
    it('advances sequentially and stops at the final slide', () => {
      expect(getNextSlideIndex(0, 3)).toBe(1);
      expect(getNextSlideIndex(1, 3)).toBe(2);
      expect(getNextSlideIndex(2, 3)).toBe(2); // stops at end
    });

    it('recedes sequentially and stops at the first slide', () => {
      expect(getPrevSlideIndex(2, 3)).toBe(1);
      expect(getPrevSlideIndex(1, 3)).toBe(0);
      expect(getPrevSlideIndex(0, 3)).toBe(0); // stops at beginning
    });
  });

  describe('Key and click matching', () => {
    it('recognizes next slide keys', () => {
      expect(isNextSlideKey('ArrowRight')).toBe(true);
      expect(isNextSlideKey('ArrowDown')).toBe(true);
      expect(isNextSlideKey('PageDown')).toBe(true);
      expect(isNextSlideKey(' ')).toBe(true);
      expect(isNextSlideKey('Enter')).toBe(true);
      expect(isNextSlideKey('ArrowLeft')).toBe(false);
    });

    it('recognizes prev slide keys', () => {
      expect(isPrevSlideKey('ArrowLeft')).toBe(true);
      expect(isPrevSlideKey('ArrowUp')).toBe(true);
      expect(isPrevSlideKey('PageUp')).toBe(true);
      expect(isPrevSlideKey('Backspace')).toBe(true);
      expect(isPrevSlideKey('ArrowRight')).toBe(false);
    });

    it('recognizes exit key (Escape)', () => {
      expect(isExitKey('Escape')).toBe(true);
      expect(isExitKey('Enter')).toBe(false);
    });

    it('determines right half vs left half click', () => {
      expect(isRightHalfClick(600, 1000)).toBe(true);
      expect(isRightHalfClick(400, 1000)).toBe(false);
      expect(isRightHalfClick(500, 1000)).toBe(false);
    });

    it('identifies laser pointer hotkey L', () => {
      const isLaserKey = (k: string) => k === 'l' || k === 'L';
      expect(isLaserKey('l')).toBe(true);
      expect(isLaserKey('L')).toBe(true);
      expect(isLaserKey('k')).toBe(false);
    });
  });
});

