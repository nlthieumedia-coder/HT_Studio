import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: [
        '**/browser_profiles/**',
        '**/release*/**',
        '**/dist/**',
        '**/scratch/**',
      ],
    },
  },
});
