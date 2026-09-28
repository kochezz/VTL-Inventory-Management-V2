import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Minimal Vitest setup -- this project had no frontend test framework
// before this. Deliberately scoped to component-rendering tests (jsdom +
// React Testing Library), not a replacement for the Next.js build/dev
// pipeline; `@` mirrors tsconfig.json's own path alias so test files can
// import components the same way the app does.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
