import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import marca from './marca.json' with { type: 'json' };

// Manifesto do app instalável (nome e cor vêm de marca.json)
const manifesto = JSON.stringify(
  {
    name: marca.nome,
    short_name: marca.nome,
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f6f5',
    theme_color: marca.cor,
    lang: 'pt-BR',
    icons: [
      { src: '/icone-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icone-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  null,
  2,
);

function marcaDoApp(): Plugin {
  return {
    name: 'marca-do-app',
    transformIndexHtml: (html) => html.replaceAll('%NOME_EMPRESA%', marca.nome).replaceAll('%COR_MARCA%', marca.cor),
    configureServer(servidor) {
      servidor.middlewares.use('/manifest.webmanifest', (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(manifesto);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifesto });
    },
  };
}

export default defineConfig({
  plugins: [react(), marcaDoApp()],
  server: { port: 5173 },
});
