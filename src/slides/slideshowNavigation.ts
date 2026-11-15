export function getInitialSlideIndex(
  mode: 'beginning' | 'current',
  currentIndex: number,
  totalSlides: number
): number {
  if (totalSlides <= 0) return 0;
  if (mode === 'beginning') return 0;
  return Math.max(0, Math.min(totalSlides - 1, currentIndex));
}

export function getNextSlideIndex(currentIndex: number, totalSlides: number): number {
  if (totalSlides <= 0) return 0;
  return Math.min(totalSlides - 1, currentIndex + 1);
}

export function getPrevSlideIndex(currentIndex: number, totalSlides: number): number {
  if (totalSlides <= 0) return 0;
  return Math.max(0, currentIndex - 1);
}

export function isNextSlideKey(key: string): boolean {
  return ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(key);
}

export function isPrevSlideKey(key: string): boolean {
  return ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(key);
}

export function isExitKey(key: string): boolean {
  return key === 'Escape';
}

export function isRightHalfClick(clientX: number, viewportWidth: number): boolean {
  return clientX > viewportWidth / 2;
}

