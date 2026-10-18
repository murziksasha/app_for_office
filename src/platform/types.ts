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

export interface PathStatus {
  exists: boolean;
  parentExists: boolean;
  modifiedMs: number | null;
  len: number | null;
}

export interface SaveTarget {
  path?: string;
  handle?: FileSystemFileHandle;
  name: string;
}

export interface PlatformAdapter {
  readonly isDesktop: boolean;
  pickFile(): Promise<PlatformFileResult | null>;
  pickFiles(): Promise<PlatformFileResult[]>;
  pickSaveTarget(fileName: string, format: string): Promise<SaveTarget | null>;
  saveFile(
    data: Blob | ArrayBuffer | Uint8Array | string,
    fileName: string,
    format: string,
    options?: { handle?: FileSystemFileHandle; path?: string }
  ): Promise<PlatformSaveResult>;
  readFile(path: string): Promise<PlatformFileResult>;
  pathStatus(path: string): Promise<PathStatus | null>;
  allowPath(path: string): Promise<void>;
  takeLaunchPaths(): Promise<string[]>;
  choose(title: string, message: string, buttons: string[]): Promise<string | null>;
  setWindowTitle(title: string): Promise<void>;
  setupCloseGuard(isDirty: () => boolean, confirmClose?: () => Promise<boolean>): () => void;
  setupFileDropHandler(onFiles: (files: PlatformFileResult[]) => void): () => void;
  setupOpenRequestHandler(onOpen: (paths: string[]) => void): () => void;
}

