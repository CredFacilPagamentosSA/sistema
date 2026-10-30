import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Cada arquivo de teste monta um banco completo no computador; isso leva alguns segundos
    hookTimeout: 60000,
    testTimeout: 30000,
  },
});
