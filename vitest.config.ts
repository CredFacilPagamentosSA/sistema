import { defineConfig } from 'vitest/config';
import marca from './marca.json' with { type: 'json' };

export default defineConfig({
  define: { __MARCA__: JSON.stringify(marca) },
  test: {
    // Cada arquivo de teste monta um banco completo no computador; isso leva alguns segundos
    hookTimeout: 60000,
    testTimeout: 30000,
  },
});
