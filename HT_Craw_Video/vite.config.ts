import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({ base: './', root: 'src/renderer', plugins: [react()], resolve: { alias: { '@': resolve(__dirname, 'src') } }, build: { outDir: '../../dist/renderer', emptyOutDir: true } });
