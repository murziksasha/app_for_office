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

export type Alignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

export function alignBoxes(boxes: Box[], alignment: Alignment): Box[] {
  if (boxes.length === 0) return [];
  if (boxes.length === 1) return [...boxes];

  const minX = Math.min(...boxes.map((b) => b.x));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const midX = (minX + maxX) / 2;

  const minY = Math.min(...boxes.map((b) => b.y));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));
  const midY = (minY + maxY) / 2;

  return boxes.map((b) => {
    switch (alignment) {
      case 'left':
        return { ...b, x: minX };
      case 'center':
        return { ...b, x: midX - b.width / 2 };
      case 'right':
        return { ...b, x: maxX - b.width };
      case 'top':
        return { ...b, y: minY };
      case 'middle':
        return { ...b, y: midY - b.height / 2 };
      case 'bottom':
        return { ...b, y: maxY - b.height };
    }
  });
}

export type DistributionAxis = 'horizontal' | 'vertical';

export function distributeBoxes(boxes: Box[], axis: DistributionAxis): Box[] {
  if (boxes.length < 3) return [...boxes];

  const indexed = boxes.map((box, index) => ({ box, index }));

  if (axis === 'horizontal') {
    indexed.sort((a, b) => a.box.x - b.box.x);
    const firstBox = indexed[0].box;
    const lastBox = indexed[indexed.length - 1].box;
    const totalSpan = (lastBox.x + lastBox.width) - firstBox.x;
    const totalBoxWidth = indexed.reduce((sum, item) => sum + item.box.width, 0);
    const gap = (totalSpan - totalBoxWidth) / (indexed.length - 1);

    const result = [...boxes];
    let currentX = firstBox.x;
    for (let i = 0; i < indexed.length; i++) {
      const { box, index } = indexed[i];
      if (i === 0) {
        result[index] = { ...box, x: firstBox.x };
        currentX = firstBox.x + box.width + gap;
      } else if (i === indexed.length - 1) {
        result[index] = { ...box, x: lastBox.x };
      } else {
        result[index] = { ...box, x: currentX };
        currentX += box.width + gap;
      }
    }
    return result;
  } else {
    indexed.sort((a, b) => a.box.y - b.box.y);
    const firstBox = indexed[0].box;
    const lastBox = indexed[indexed.length - 1].box;
    const totalSpan = (lastBox.y + lastBox.height) - firstBox.y;
    const totalBoxHeight = indexed.reduce((sum, item) => sum + item.box.height, 0);
    const gap = (totalSpan - totalBoxHeight) / (indexed.length - 1);

    const result = [...boxes];
    let currentY = firstBox.y;
    for (let i = 0; i < indexed.length; i++) {
      const { box, index } = indexed[i];
      if (i === 0) {
        result[index] = { ...box, y: firstBox.y };
        currentY = firstBox.y + box.height + gap;
      } else if (i === indexed.length - 1) {
        result[index] = { ...box, y: lastBox.y };
      } else {
        result[index] = { ...box, y: currentY };
        currentY += box.height + gap;
      }
    }
    return result;
  }
}

export type ZOrderAction = 'front' | 'forward' | 'backward' | 'back';

export function reorder<T extends { id: string }>(
  elements: T[],
  selectedId: string,
  action: ZOrderAction
): T[] {
  const index = elements.findIndex((el) => el.id === selectedId);
  if (index === -1) return [...elements];

  const result = [...elements];
  const [item] = result.splice(index, 1);

  switch (action) {
    case 'front':
      result.push(item);
      break;
    case 'back':
      result.unshift(item);
      break;
    case 'forward':
      result.splice(Math.min(result.length, index + 1), 0, item);
      break;
    case 'backward':
      result.splice(Math.max(0, index - 1), 0, item);
      break;
  }
  return result;
}

export interface SnapResult {
  box: Box;
  snappedVerticalCenter: boolean;
  snappedHorizontalCenter: boolean;
}

export function snapBox(
  box: Box,
  gridPct: number = 2,
  snapToCenterGuides: boolean = true
): SnapResult {
  let x = box.x;
  let y = box.y;
  let snappedVerticalCenter = false;
  let snappedHorizontalCenter = false;

  if (gridPct > 0) {
    x = Math.round(x / gridPct) * gridPct;
    y = Math.round(y / gridPct) * gridPct;
  }

  if (snapToCenterGuides) {
    const centerX = x + box.width / 2;
    if (Math.abs(centerX - 50) <= 1.0) {
      x = 50 - box.width / 2;
      snappedVerticalCenter = true;
    }

    const centerY = y + box.height / 2;
    if (Math.abs(centerY - 50) <= 1.0) {
      y = 50 - box.height / 2;
      snappedHorizontalCenter = true;
    }
  }

  x = Math.max(0, Math.min(100 - box.width, x));
  y = Math.max(0, Math.min(100 - box.height, y));

  x = Math.round(x * 100) / 100;
  y = Math.round(y * 100) / 100;

  return {
    box: { x, y, width: box.width, height: box.height },
    snappedVerticalCenter,
    snappedHorizontalCenter,
  };
}
