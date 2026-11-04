import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Sem INSTALACAO, monta o sistema principal. Com INSTALACAO=nome, usa marca, imagens e opções
// da pasta instalacoes/nome e entrega em dist/nome.
const instalacao = process.env.INSTALACAO;
const pasta = instalacao ? `instalacoes/${instalacao}` : '.';
const marca = JSON.parse(readFileSync(`${pasta}/marca.json`, 'utf8'));

// Uma instalação de cliente não pode herdar o .env.local do sistema principal, senão usaria o banco errado
if (instalacao && process.env.npm_lifecycle_event !== 'dev' && (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_PUBLISHABLE_KEY)) {
  throw new Error('Instalação de cliente: informe VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY do cliente ao montar.');
}

// Manifesto do app instalável (nome e cor vêm de marca.json)
const manifesto = JSON.stringify(
  {
    name: marca.nome,
    short_name: marca.nome,
    start_url: '/',
    display: 'standalone',
    background_color: marca.tema?.claro?.fundo ?? '#f4f6f5',
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

// Cores próprias da instalação, por cima das cores padrão de estilo.css
function cssDoTema(): string {
  const variaveis = (cores: Record<string, string> = {}) =>
    Object.entries(cores).map(([nome, valor]) => `--${nome}:${valor};`).join('');
  if (!marca.tema) return '';
  return `<style>html:root{${variaveis(marca.tema.claro)}}@media (prefers-color-scheme:dark){html:root{${variaveis(marca.tema.escuro)}}}</style>`;
}

function marcaDoApp(): Plugin {
  return {
    name: 'marca-do-app',
    transformIndexHtml: (html) =>
      html
        .replaceAll('%NOME_EMPRESA%', marca.nome)
        .replaceAll('%COR_MARCA%', marca.cor)
        .replace('</head>', `${cssDoTema()}</head>`),
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
  define: { __MARCA__: JSON.stringify(marca) },
  publicDir: instalacao ? `${pasta}/public` : 'public',
  build: { outDir: instalacao ? `dist/${instalacao}` : 'dist' },
  server: { port: 5173 },
});
