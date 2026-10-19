export interface DropBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  shown: boolean;
}

export const DROP_TARGET_ATTR = 'data-folio-drop-target';

/** Physical-pixel point against a CSS-pixel box. Absent or hidden boxes miss. */
export function dropHitsTarget(
  point: { x: number; y: number } | null | undefined,
  box: DropBox | null | undefined,
  devicePixelRatio: number
): boolean {
  if (!point || !box || !box.shown) return false;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  const scale = devicePixelRatio > 0 && Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1;
  const left = box.left * scale;
  const top = box.top * scale;
  const right = box.right * scale;
  const bottom = box.bottom * scale;
  return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
}

export function clientBoxFromElement(el: Element | null): DropBox | null {
  if (!el || !(el instanceof HTMLElement) || !el.isConnected) return null;
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const hidden = style.display === 'none' || style.visibility === 'hidden' || el.hidden;
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    shown: !hidden && rect.width > 0 && rect.height > 0,
  };
}

export function measureHomeDropTarget(doc: Document = document): DropBox | null {
  return clientBoxFromElement(doc.querySelector(`[${DROP_TARGET_ATTR}]`));
}
