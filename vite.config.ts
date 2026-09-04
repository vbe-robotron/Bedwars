import { defineConfig } from 'vite';

export default defineConfig({
  // The legacy game remains available during the incremental migration.
  publicDir: false,
});
