export interface DropBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  shown: boolean;
}

export const DROP_TARGET_ATTR = 'data-folio-drop-target';
export const HOME_DRAG_EVENT = 'folio-home-drag';

export function pointHitsBox(
  point: { x: number; y: number } | null | undefined,
  box: DropBox | null | undefined
): boolean {
  if (!point || !box || !box.shown) return false;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
}

/**
 * Home is visible when the start screen is mounted. Tauri may report the cursor
 * in logical CSS pixels or in physical pixels, so either reading that lands
 * inside the box counts.
 */
export function dropHitsTarget(
  point: { x: number; y: number } | null | undefined,
  box: DropBox | null | undefined,
  devicePixelRatio: number
): boolean {
  if (!point || !box || !box.shown) return false;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  const scale = devicePixelRatio > 0 && Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1;
  const physical = { x: point.x / scale, y: point.y / scale };
  return pointHitsBox(point, box) || pointHitsBox(physical, box);
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

export function emitHomeDrag(active: boolean) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(HOME_DRAG_EVENT, { detail: { active } }));
}
