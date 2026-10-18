/// <reference types="vite/client" />

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

declare module 'turndown-plugin-gfm';

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

