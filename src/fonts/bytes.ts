const memory = new Map<string, Uint8Array>();

export function rememberFontBytes(fileName: string, bytes: Uint8Array): void {
  memory.set(fileName, bytes);
}

export function cachedFontBytes(fileName: string): Uint8Array | undefined {
  return memory.get(fileName);
}

export function fontFileUrl(fileName: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}fonts/files/${fileName}`;
}

export async function readBundledFontBytes(fileName: string): Promise<Uint8Array> {
  const cached = memory.get(fileName);
  if (cached) return cached;
  if (typeof process !== 'undefined' && process.versions?.node) {
    const fs = await import(/* @vite-ignore */ 'fs');
    const path = await import(/* @vite-ignore */ 'path');
    const full = path.resolve(process.cwd(), 'public/fonts/files', fileName);
    const bytes = new Uint8Array(fs.readFileSync(full));
    memory.set(fileName, bytes);
    return bytes;
  }
  const response = await fetch(fontFileUrl(fileName));
  if (!response.ok) {
    throw new Error(`Could not read bundled font ${fileName}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  memory.set(fileName, bytes);
  return bytes;
}
