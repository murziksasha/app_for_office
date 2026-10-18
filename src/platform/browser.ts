import { PathStatus, PlatformAdapter, PlatformFileResult, PlatformSaveResult, SaveTarget } from './types';

export const FORMAT_MIME_TYPES: Record<string, { description: string; mime: string; extensions: string[] }> = {
  docx: {
    description: 'Word Document (.docx)',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['.docx'],
  },
  odt: {
    description: 'OpenDocument Text (.odt)',
    mime: 'application/vnd.oasis.opendocument.text',
    extensions: ['.odt'],
  },
  rtf: {
    description: 'Rich Text Format (.rtf)',
    mime: 'application/rtf',
    extensions: ['.rtf'],
  },
  md: {
    description: 'Markdown Document (.md)',
    mime: 'text/markdown',
    extensions: ['.md'],
  },
  html: {
    description: 'HTML Document (.html)',
    mime: 'text/html',
    extensions: ['.html', '.htm'],
  },
  txt: {
    description: 'Plain Text (.txt)',
    mime: 'text/plain',
    extensions: ['.txt'],
  },
  xlsx: {
    description: 'Excel Spreadsheet (.xlsx)',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: ['.xlsx'],
  },
  csv: {
    description: 'Comma Separated Values (.csv)',
    mime: 'text/csv',
    extensions: ['.csv'],
  },
  tsv: {
    description: 'Tab Separated Values (.tsv)',
    mime: 'text/tab-separated-values',
    extensions: ['.tsv'],
  },
  pptx: {
    description: 'PowerPoint Presentation (.pptx)',
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extensions: ['.pptx'],
  },
  pdf: {
    description: 'PDF Document (.pdf)',
    mime: 'application/pdf',
    extensions: ['.pdf'],
  },
};

export function hasFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

export async function verifyPermission(
  fileHandle: FileSystemFileHandle,
  readWrite = true
): Promise<boolean> {
  const options: FileSystemHandlePermissionDescriptor = {
    mode: readWrite ? 'readwrite' : 'read',
  };
  // @ts-ignore
  if ((await fileHandle.queryPermission?.(options)) === 'granted') {
    return true;
  }
  // @ts-ignore
  if ((await fileHandle.requestPermission?.(options)) === 'granted') {
    return true;
  }
  return false;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export class BrowserPlatformAdapter implements PlatformAdapter {
  readonly isDesktop = false;

  async pickFiles(): Promise<PlatformFileResult[]> {
    if (hasFileSystemAccess()) {
      try {
        // @ts-ignore
        const handles = await window.showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: 'All Supported Office Files',
              accept: {
                'application/*': ['.docx', '.odt', '.xlsx', '.pptx', '.pdf'],
                'text/*': ['.rtf', '.txt', '.md', '.html', '.htm', '.csv', '.tsv'],
              },
            },
          ],
        });
        const opened: PlatformFileResult[] = [];
        for (const handle of handles || []) {
          const file = await handle.getFile();
          opened.push({ file, name: file.name, handle });
        }
        return opened;
      } catch (err: any) {
        if (err.name === 'AbortError') return [];
        console.warn('showOpenFilePicker failed, falling back to input:', err);
      }
    }

    return new Promise((resolve) => {
      if (typeof document === 'undefined') {
        resolve([]);
        return;
      }
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept =
        '.docx,.odt,.rtf,.txt,.md,.html,.htm,.xlsx,.csv,.tsv,.pptx,.pdf,.doc,.xls,.ppt,.docm,.xlsm,.pptm';
      input.onchange = () => {
        const files = input.files ? Array.from(input.files) : [];
        resolve(files.map((file) => ({ file, name: file.name })));
      };
      input.oncancel = () => resolve([]);
      input.click();
    });
  }

  async pickFile(): Promise<PlatformFileResult | null> {
    const files = await this.pickFiles();
    return files[0] ?? null;
  }

  async pickSaveTarget(fileName: string, format: string): Promise<SaveTarget | null> {
    if (!hasFileSystemAccess()) return null;
    try {
      const typeConfig = FORMAT_MIME_TYPES[format];
      const types = typeConfig
        ? [{ description: typeConfig.description, accept: { [typeConfig.mime]: typeConfig.extensions } }]
        : undefined;
      // @ts-ignore
      const handle = await window.showSaveFilePicker({ suggestedName: fileName, types });
      return { handle, name: handle.name };
    } catch (err: any) {
      if (err.name === 'AbortError') return null;
      return null;
    }
  }

  async pathStatus(_path: string): Promise<PathStatus | null> {
    return null;
  }

  async allowPath(_path: string): Promise<void> {}

  async takeLaunchPaths(): Promise<string[]> {
    return [];
  }

  async choose(): Promise<string | null> {
    return null;
  }

  async saveFile(
    data: Blob | ArrayBuffer | Uint8Array | string,
    fileName: string,
    format: string,
    options?: { handle?: FileSystemFileHandle; path?: string }
  ): Promise<PlatformSaveResult> {
    const mime = FORMAT_MIME_TYPES[format]?.mime || 'application/octet-stream';
    const blob =
      data instanceof Blob
        ? data
        : new Blob([data as any], { type: mime });

    // 1. If we have an existing handle, write directly to it
    if (options?.handle) {
      try {
        const permitted = await verifyPermission(options.handle, true);
        if (permitted) {
          // @ts-ignore
          const writable = await options.handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return { success: true, handle: options.handle, newFileName: fileName };
        }
      } catch (err) {
        console.warn('Failed writing to existing handle, falling back to picker:', err);
      }
    }

    // 2. Try File System Access save picker if available
    if (hasFileSystemAccess()) {
      try {
        const typeConfig = FORMAT_MIME_TYPES[format];
        const types = typeConfig
          ? [
              {
                description: typeConfig.description,
                accept: { [typeConfig.mime]: typeConfig.extensions },
              },
            ]
          : undefined;

        // @ts-ignore
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types,
        });

        // @ts-ignore
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return { success: true, handle, newFileName: handle.name };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // User cancelled
          return { success: false, newFileName: fileName };
        }
        console.warn('showSaveFilePicker failed, falling back to download:', err);
      }
    }

    // 3. Fallback: Browser download
    downloadBlob(blob, fileName);
    return { success: true, newFileName: fileName };
  }

  async readFile(path: string): Promise<PlatformFileResult> {
    throw new Error(`Direct file reading by path (${path}) is not supported in browser environment.`);
  }

  async setWindowTitle(title: string): Promise<void> {
    if (typeof document !== 'undefined') {
      document.title = title;
    }
  }

  setupCloseGuard(isDirty: () => boolean, _confirmClose?: () => Promise<boolean>): () => void {
    if (typeof window === 'undefined') return () => {};
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty()) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }

  setupFileDropHandler(_onFiles: (files: PlatformFileResult[]) => void): () => void {
    // In browser, drag & drop is handled via DOM drop events in the React tree
    return () => {};
  }

  setupOpenRequestHandler(_onOpen: (paths: string[]) => void): () => void {
    return () => {};
  }
}

export const browserAdapter = new BrowserPlatformAdapter();

