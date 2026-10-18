import { PathStatus, PlatformAdapter, PlatformFileResult, PlatformSaveResult, SaveTarget } from './types';
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

function payloadToFile(res: RustFilePayload): PlatformFileResult {
  const ext = res.name.split('.').pop()?.toLowerCase() || '';
  const mime = FORMAT_MIME_TYPES[ext]?.mime || 'application/octet-stream';
  const file = new File([new Uint8Array(res.bytes)], res.name, { type: mime });
  return { file, name: res.name, path: res.path };
}

export class DesktopPlatformAdapter implements PlatformAdapter {
  readonly isDesktop = true;

  async pickFiles(): Promise<PlatformFileResult[]> {
    const rows = await tauriInvoke<RustFilePayload[]>('folio_pick_open');
    return (rows || []).map(payloadToFile);
  }

  async pickFile(): Promise<PlatformFileResult | null> {
    const files = await this.pickFiles();
    return files[0] ?? null;
  }

  async pickSaveTarget(fileName: string, format: string): Promise<SaveTarget | null> {
    const pickedPath = await tauriInvoke<string | null>('folio_pick_save', {
      defaultName: fileName,
      format,
    });
    if (!pickedPath) return null;
    return { path: pickedPath, name: pickedPath.split(/[\\/]/).pop() || fileName };
  }

  async pathStatus(path: string): Promise<PathStatus | null> {
    const status = await tauriInvoke<{
      exists: boolean;
      parent_exists: boolean;
      modified_ms: number | null;
      len: number | null;
    }>('folio_path_status', { path });
    return {
      exists: status.exists,
      parentExists: status.parent_exists,
      modifiedMs: status.modified_ms,
      len: status.len,
    };
  }

  async allowPath(path: string): Promise<void> {
    await tauriInvoke('folio_allow_path', { path });
  }

  async takeLaunchPaths(): Promise<string[]> {
    return tauriInvoke<string[]>('folio_take_launch_paths');
  }

  async choose(title: string, message: string, buttons: string[]): Promise<string | null> {
    return tauriInvoke<string | null>('folio_choose', { title, message, buttons });
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

  setupCloseGuard(isDirty: () => boolean, confirmClose?: () => Promise<boolean>): () => void {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onCloseRequested(async (event) => {
          event.preventDefault();
          const allow = confirmClose ? await confirmClose() : !isDirty();
          if (allow) await appWindow.destroy();
        });
      } catch (err) {
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

  setupFileDropHandler(onFiles: (files: PlatformFileResult[]) => void): () => void {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onDragDropEvent(async (event) => {
          if (event.payload.type !== 'drop' || !event.payload.paths?.length) return;
          const loaded: PlatformFileResult[] = [];
          for (const targetPath of event.payload.paths) {
            try {
              loaded.push(await this.readFile(targetPath));
            } catch (err) {
              console.error('Failed to read dropped file in desktop:', err);
            }
          }
          if (loaded.length) onFiles(loaded);
        });
      } catch (err) {
        console.warn('Could not register Tauri file drop listener:', err);
      }
    })();

    return () => {
      if (unlisten) unlisten();
    };
  }

  setupOpenRequestHandler(onOpen: (paths: string[]) => void): () => void {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<{ paths?: string[]; path?: string }>('folio://open-files', (event) => {
          const paths = event.payload?.paths || (event.payload?.path ? [event.payload.path] : []);
          if (paths.length) onOpen(paths);
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
