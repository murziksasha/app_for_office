export const MIN_BLOCK_PX = 48;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export function minPercents(canvasWidth: number, canvasHeight: number): { minWidth: number; minHeight: number } {
  const width = canvasWidth > 0 ? canvasWidth : 960;
  const height = canvasHeight > 0 ? canvasHeight : 540;
  return {
    minWidth: (MIN_BLOCK_PX / width) * 100,
    minHeight: (MIN_BLOCK_PX / height) * 100,
  };
}

/** Keep the box on the slide and at least `minWidth` / `minHeight` percent. */
export function clampBox(box: Box, minWidth: number, minHeight: number): Box {
  const width = Math.max(minWidth, Math.min(100, box.width));
  const height = Math.max(minHeight, Math.min(100, box.height));
  const x = Math.max(0, Math.min(100 - width, box.x));
  const y = Math.max(0, Math.min(100 - height, box.y));
  return { x, y, width, height };
}

export function moveBox(start: Box, dxPct: number, dyPct: number, minWidth: number, minHeight: number): Box {
  return clampBox({ ...start, x: start.x + dxPct, y: start.y + dyPct }, minWidth, minHeight);
}

export function resizeBox(
  start: Box,
  dir: ResizeDir,
  dxPct: number,
  dyPct: number,
  minWidth: number,
  minHeight: number
): Box {
  let x = start.x;
  let y = start.y;
  let width = start.width;
  let height = start.height;

  if (dir.includes('e')) width = start.width + dxPct;
  if (dir.includes('s')) height = start.height + dyPct;
  if (dir.includes('w')) {
    width = start.width - dxPct;
    x = start.x + dxPct;
  }
  if (dir.includes('n')) {
    height = start.height - dyPct;
    y = start.y + dyPct;
  }

  if (width < minWidth) {
    if (dir.includes('w')) x = start.x + start.width - minWidth;
    width = minWidth;
  }
  if (height < minHeight) {
    if (dir.includes('n')) y = start.y + start.height - minHeight;
    height = minHeight;
  }

  return clampBox({ x, y, width, height }, minWidth, minHeight);
}
