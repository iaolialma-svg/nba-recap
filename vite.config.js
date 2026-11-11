import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' : l'appli fonctionne dans n'importe quel sous-dossier (GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react()],
});
