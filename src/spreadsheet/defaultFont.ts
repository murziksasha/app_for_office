const UNQUOTED_TIMES = /(^|[^\w"])Times New Roman,/g;

let installed = false;

export function rewriteSheetFont(value: string): string {
  return value.replace(UNQUOTED_TIMES, '$1"Noto Sans",');
}

/** FortuneSheet prefixes unspecified cells with an unquoted Times New Roman token. Quoted names stay. */
export function installSheetDefaultFont(): void {
  if (installed || typeof CanvasRenderingContext2D === 'undefined') return;
  const descriptor = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
  if (!descriptor?.get || !descriptor.set) return;
  installed = true;
  Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', {
    configurable: true,
    enumerable: descriptor.enumerable,
    get() {
      return descriptor.get!.call(this);
    },
    set(value: string) {
      const next = typeof value === 'string' ? rewriteSheetFont(value) : value;
      descriptor.set!.call(this, next);
    },
  });
}

export function sheetFontUsesNoto(font: string): boolean {
  return font.includes('"Noto Sans"') && !/(^|[^\w"])Times New Roman,/.test(font);
}
