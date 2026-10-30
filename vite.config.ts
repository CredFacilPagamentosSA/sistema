import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import marca from './marca.json';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'nome-da-empresa',
      transformIndexHtml: (html) => html.replaceAll('%NOME_EMPRESA%', marca.nome),
    },
  ],
  server: { port: 5173 },
});
