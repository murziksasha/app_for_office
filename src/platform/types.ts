export interface PlatformFileResult {
  file: File;
  name: string;
  handle?: FileSystemFileHandle;
  path?: string;
}

export interface PlatformSaveResult {
  success: boolean;
  handle?: FileSystemFileHandle;
  path?: string;
  newFileName: string;
}

export interface PlatformAdapter {
  readonly isDesktop: boolean;
  pickFile(): Promise<PlatformFileResult | null>;
  saveFile(
    data: Blob | ArrayBuffer | Uint8Array | string,
    fileName: string,
    format: string,
    options?: { handle?: FileSystemFileHandle; path?: string }
  ): Promise<PlatformSaveResult>;
  readFile(path: string): Promise<PlatformFileResult>;
  setWindowTitle(title: string): Promise<void>;
  setupCloseGuard(isDirty: () => boolean): () => void;
  setupFileDropHandler(onFileDrop: (file: File, path?: string) => void): () => void;
  setupOpenRequestHandler(onOpen: (path: string) => void): () => void;
}

