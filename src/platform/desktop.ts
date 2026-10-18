import { PlatformAdapter, PlatformFileResult, PlatformSaveResult } from './types';
import { FORMAT_MIME_TYPES } from './browser';

interface RustFilePayload {
  path: string;
  name: string;
  bytes: number[];
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, any>): Promise<T> {
  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__?.invoke) {
    return (window as any).__TAURI_INTERNALS__.invoke(cmd, args);
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

export class DesktopPlatformAdapter implements PlatformAdapter {
  readonly isDesktop = true;

  async pickFile(): Promise<PlatformFileResult | null> {
    try {
      const res = await tauriInvoke<RustFilePayload | null>('folio_pick_open');
      if (!res) return null;

      const ext = res.name.split('.').pop()?.toLowerCase() || '';
      const mime = FORMAT_MIME_TYPES[ext]?.mime || 'application/octet-stream';
      const u8 = new Uint8Array(res.bytes);
      const file = new File([u8], res.name, { type: mime });

      return {
        file,
        name: res.name,
        path: res.path,
      };
    } catch (err) {
      console.error('Desktop pickFile failed:', err);
      throw err;
    }
  }

  async saveFile(
    data: Blob | ArrayBuffer | Uint8Array | string,
    fileName: string,
    format: string,
    options?: { handle?: FileSystemFileHandle; path?: string }
  ): Promise<PlatformSaveResult> {
    let targetPath = options?.path;

    // 1. If path is not set (e.g. Save As or new document), prompt user with native save dialog
    if (!targetPath) {
      const pickedPath = await tauriInvoke<string | null>('folio_pick_save', {
        defaultName: fileName,
        format,
      });

      if (!pickedPath) {
        // User cancelled save dialog
        return { success: false, newFileName: fileName };
      }
      targetPath = pickedPath;
    }

    // 2. Prepare byte payload
    let bytes: number[];
    if (data instanceof Blob) {
      const ab = await data.arrayBuffer();
      bytes = Array.from(new Uint8Array(ab));
    } else if (data instanceof ArrayBuffer) {
      bytes = Array.from(new Uint8Array(data));
    } else if (data instanceof Uint8Array) {
      bytes = Array.from(data);
    } else {
      bytes = Array.from(new TextEncoder().encode(String(data)));
    }

    // 3. Write via Rust folio_write command (validated by Rust process allow-list)
    await tauriInvoke('folio_write', {
      path: targetPath,
      bytes,
    });

    const newFileName = targetPath.split(/[\\/]/).pop() || fileName;
    return {
      success: true,
      path: targetPath,
      newFileName,
    };
  }

  async readFile(path: string): Promise<PlatformFileResult> {
    const res = await tauriInvoke<RustFilePayload>('folio_read', { path });
    const ext = res.name.split('.').pop()?.toLowerCase() || '';
    const mime = FORMAT_MIME_TYPES[ext]?.mime || 'application/octet-stream';
    const u8 = new Uint8Array(res.bytes);
    const file = new File([u8], res.name, { type: mime });

    return {
      file,
      name: res.name,
      path: res.path,
    };
  }

  async setWindowTitle(title: string): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        document.title = title;
      }
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().setTitle(title);
    } catch (err) {
      // In tests or non-window environments
      if (typeof document !== 'undefined') {
        document.title = title;
      }
    }
  }

  setupCloseGuard(isDirty: () => boolean): () => void {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onCloseRequested(async (event) => {
          if (isDirty()) {
            const confirmed = window.confirm(
              'You have unsaved changes. Are you sure you want to exit Folio?'
            );
            if (!confirmed) {
              event.preventDefault();
              return;
            }
          }
          await appWindow.destroy();
        });
      } catch (err) {
        // Fallback for browser beforeunload
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
          if (isDirty()) {
            e.preventDefault();
            e.returnValue = 'You have unsaved changes.';
            return e.returnValue;
          }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        unlisten = () => window.removeEventListener('beforeunload', handleBeforeUnload);
      }
    })();

    return () => {
      if (unlisten) unlisten();
    };
  }

  setupFileDropHandler(onFileDrop: (file: File, path?: string) => void): () => void {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onDragDropEvent(async (event) => {
          if (event.payload.type === 'drop') {
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              const targetPath = paths[0];
              try {
                const loaded = await this.readFile(targetPath);
                onFileDrop(loaded.file, loaded.path);
              } catch (err) {
                console.error('Failed to read dropped file in desktop:', err);
              }
            }
          }
        });
      } catch (err) {
        console.warn('Could not register Tauri file drop listener:', err);
      }
    })();

    return () => {
      if (unlisten) unlisten();
    };
  }

  setupOpenRequestHandler(onOpen: (path: string) => void): () => void {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<{ path: string }>('folio://open-file', (event) => {
          if (event.payload?.path) {
            onOpen(event.payload.path);
          }
        });
      } catch (err) {
        console.warn('Could not register Tauri open-file listener:', err);
      }
    })();

    return () => {
      if (unlisten) unlisten();
    };
  }
}

export const desktopAdapter = new DesktopPlatformAdapter();
