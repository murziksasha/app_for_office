import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/fixtures_setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
  server: {
    port: 5188,
    open: false,
  },
  optimizeDeps: {
    include: ['exceljs', 'jszip', 'fast-xml-parser', 'dompurify', 'turndown', 'markdown-it'],
  },
});
