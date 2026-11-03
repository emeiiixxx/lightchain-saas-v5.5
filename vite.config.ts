import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Stable dependency URLs keep app/copy releases from invalidating the React/Flow download.
        manualChunks: id => id.includes('/node_modules/') ? 'vendor' : undefined,
      },
    },
  },
});
