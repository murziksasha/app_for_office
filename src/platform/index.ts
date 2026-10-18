import { PlatformAdapter, PlatformFileResult, PlatformSaveResult } from './types';
import { browserAdapter, FORMAT_MIME_TYPES, hasFileSystemAccess, verifyPermission, downloadBlob } from './browser';
import { desktopAdapter } from './desktop';

export * from './types';
export { FORMAT_MIME_TYPES, hasFileSystemAccess, verifyPermission, downloadBlob };

/**
 * Detects whether the app is executing inside the native Tauri desktop window.
 */
export function isDesktopPlatform(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Returns the active platform adapter (desktop if inside Tauri, browser otherwise).
 */
export function getPlatformAdapter(): PlatformAdapter {
  return isDesktopPlatform() ? desktopAdapter : browserAdapter;
}

/**
 * Uniform file picker across desktop (native dialog) and browser (FS Access / input).
 */
export async function pickFileToOpen(): Promise<PlatformFileResult | null> {
  return getPlatformAdapter().pickFile();
}

/**
 * Uniform file save across desktop (Rust commands / in-place) and browser (FS Access / download).
 */
export async function saveToFileSystem(
  data: Blob | ArrayBuffer | Uint8Array | string,
  fileName: string,
  format: string,
  options?: { handle?: FileSystemFileHandle; path?: string }
): Promise<PlatformSaveResult> {
  return getPlatformAdapter().saveFile(data, fileName, format, options);
}

/**
 * Uniform file reader by path (desktop only).
 */
export async function readFileFromPath(path: string): Promise<PlatformFileResult> {
  return getPlatformAdapter().readFile(path);
}

/**
 * Set window title (desktop native window title + browser document.title).
 */
export async function setWindowTitle(title: string): Promise<void> {
  return getPlatformAdapter().setWindowTitle(title);
}

/**
 * Set up window close guard for unsaved changes.
 */
export function setupCloseGuard(isDirty: () => boolean): () => void {
  return getPlatformAdapter().setupCloseGuard(isDirty);
}

/**
 * Set up file drop handling.
 */
export function setupFileDropHandler(onFileDrop: (file: File, path?: string) => void): () => void {
  return getPlatformAdapter().setupFileDropHandler(onFileDrop);
}

/**
 * Set up external open requests (single-instance / CLI args).
 */
export function setupOpenRequestHandler(onOpen: (path: string) => void): () => void {
  return getPlatformAdapter().setupOpenRequestHandler(onOpen);
}

