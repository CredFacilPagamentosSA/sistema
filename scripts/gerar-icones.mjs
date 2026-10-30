// Gera os ícones do app (iPhone e navegador) na pasta public/, com a cor de marca.json.
// Ícone provisório: uma moeda branca sobre fundo colorido. Para trocar por um logotipo,
// basta substituir os arquivos public/icone-*.png por imagens do mesmo tamanho.
// Uso: node scripts/gerar-icones.mjs
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';

const raiz = join(import.meta.dirname, '..');
const marca = JSON.parse(readFileSync(join(raiz, 'marca.json'), 'utf8'));
const cor = (marca.cor ?? '#0f5132').replace('#', '');
const fundo = [0, 2, 4].map((i) => parseInt(cor.slice(i, i + 2), 16));

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function bloco(tipo, dados) {
  const t = Buffer.from(tipo);
  const tam = Buffer.alloc(4);
  tam.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, dados])));
  return Buffer.concat([tam, t, dados, crc]);
}

function distanciaAoSegmento(x, y, [x1, y1], [x2, y2]) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((x - x1) * vx + (y - y1) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(x - (x1 + t * vx), y - (y1 + t * vy));
}

// O pixel é branco? Desenho: moeda (anel) com um "✓" de pago dentro
function branco(x, y) {
  const r = Math.hypot(x - 0.5, y - 0.5);
  const anel = r <= 0.31 && r >= 0.25;
  const meio = [0.455, 0.6];
  const visto =
    distanciaAoSegmento(x, y, [0.36, 0.5], meio) <= 0.032 || distanciaAoSegmento(x, y, meio, [0.65, 0.4]) <= 0.032;
  return anel || visto;
}

function png(tamanho) {
  const linhas = [];
  const amostras = 4;
  for (let py = 0; py < tamanho; py++) {
    const linha = Buffer.alloc(1 + tamanho * 3);
    for (let px = 0; px < tamanho; px++) {
      let cobertura = 0;
      for (let sy = 0; sy < amostras; sy++)
        for (let sx = 0; sx < amostras; sx++)
          if (branco((px + (sx + 0.5) / amostras) / tamanho, (py + (sy + 0.5) / amostras) / tamanho)) cobertura++;
      const a = cobertura / (amostras * amostras);
      for (let c = 0; c < 3; c++) linha[1 + px * 3 + c] = Math.round(fundo[c] * (1 - a) + 255 * a);
    }
    linhas.push(linha);
  }
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(tamanho, 0);
  cabecalho.writeUInt32BE(tamanho, 4);
  cabecalho[8] = 8; // 8 bits
  cabecalho[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloco('IHDR', cabecalho),
    bloco('IDAT', deflateSync(Buffer.concat(linhas))),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(join(raiz, 'public'), { recursive: true });
for (const tamanho of [180, 192, 512]) {
  writeFileSync(join(raiz, 'public', `icone-${tamanho}.png`), png(tamanho));
  console.log(`public/icone-${tamanho}.png`);
}
