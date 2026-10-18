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

/**
 * Checks if File System Access API is supported.
 */
export function hasFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

/**
 * Requests write permission for a FileSystemHandle if needed.
 */
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

/**
 * Triggers a browser download of a Blob.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Saves content to a file. If a file handle is present and writable, writes in place.
 * Otherwise prompts save file picker or falls back to download.
 */
export async function saveToFileSystem(
  data: Blob | ArrayBuffer | string,
  fileName: string,
  format: string,
  existingHandle?: FileSystemFileHandle
): Promise<{ success: boolean; handle?: FileSystemFileHandle; newFileName: string }> {
  const blob =
    data instanceof Blob
      ? data
      : new Blob([data], { type: FORMAT_MIME_TYPES[format]?.mime || 'application/octet-stream' });

  // 1. If we have an existing handle, write directly to it
  if (existingHandle) {
    try {
      const permitted = await verifyPermission(existingHandle, true);
      if (permitted) {
        // @ts-ignore
        const writable = await existingHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return { success: true, handle: existingHandle, newFileName: fileName };
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

/**
 * Prompts user to pick a file via File System Access API or hidden file input.
 */
export async function pickFileToOpen(): Promise<{ file: File; handle?: FileSystemFileHandle } | null> {
  if (hasFileSystemAccess()) {
    try {
      // @ts-ignore
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
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
      if (handle) {
        const file = await handle.getFile();
        return { file, handle };
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return null;
      console.warn('showOpenFilePicker failed, falling back to input:', err);
    }
  }

  // Fallback file input
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept =
      '.docx,.odt,.rtf,.txt,.md,.html,.htm,.xlsx,.csv,.tsv,.pptx,.pdf,.doc,.xls,.ppt,.docm,.xlsm,.pptm';
    input.onchange = () => {
      if (input.files && input.files.length > 0) {
        resolve({ file: input.files[0] });
      } else {
        resolve(null);
      }
    };
    input.click();
  });
}

