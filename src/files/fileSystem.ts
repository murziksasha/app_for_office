import {
  FORMAT_MIME_TYPES,
  hasFileSystemAccess,
  verifyPermission,
  downloadBlob,
  pickFileToOpen,
  saveToFileSystem as platformSaveToFileSystem,
  PlatformFileResult,
  PlatformSaveResult,
} from '../platform';

export { FORMAT_MIME_TYPES, hasFileSystemAccess, verifyPermission, downloadBlob, pickFileToOpen };

/**
 * Saves content to a file via the platform adapter.
 * On desktop: writes through native Rust commands and allow-list.
 * On browser: writes via File System Access handle or browser download.
 */
export async function saveToFileSystem(
  data: Blob | ArrayBuffer | string,
  fileName: string,
  format: string,
  existingHandle?: FileSystemFileHandle,
  existingPath?: string
): Promise<PlatformSaveResult> {
  return platformSaveToFileSystem(data, fileName, format, {
    handle: existingHandle,
    path: existingPath,
  });
}
