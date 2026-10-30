// Gráfico de colunas (empilhadas quando há mais de uma série), desenhado em SVG.
// Toque ou passe o mouse numa coluna para ver os valores; "Ver tabela" mostra os números.
import { useEffect, useRef, useState } from 'react';

export type Serie = { nome: string; cor: string; valores: number[] };

type Props = {
  titulo: string;
  rotulos: string[]; // um por coluna
  rotulosCompletos?: string[]; // usados no detalhe e na tabela
  series: Serie[];
  formatar: (v: number) => string;
  formatarEixo: (v: number) => string;
};

const ALTURA = 200;
const MARGEM = { topo: 8, direita: 4, baixo: 22, esquerda: 52 };
const LARGURA_MAX_COLUNA = 24;
const ESPACO = 2; // vão na cor do fundo entre segmentos

function maximoRedondo(max: number): number {
  if (max <= 0) return 100;
  const potencia = 10 ** Math.floor(Math.log10(max));
  for (const passo of [1, 2, 2.5, 5, 10]) if (passo * potencia >= max) return passo * potencia;
  return 10 * potencia;
}

// Coluna com cantos de 4px arredondados só no topo
function caminhoColuna(x: number, y: number, w: number, h: number, arredondar: boolean): string {
  const r = arredondar ? Math.min(4, w / 2, h) : 0;
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

export function GraficoColunas({ titulo, rotulos, rotulosCompletos = rotulos, series, formatar, formatarEixo }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(320);
  const [ativo, setAtivo] = useState<number | null>(null);
  const [verTabela, setVerTabela] = useState(false);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const observador = new ResizeObserver(([entrada]) => setLargura(Math.max(240, entrada.contentRect.width)));
    observador.observe(el);
    return () => observador.disconnect();
  }, [verTabela]);

  const n = rotulos.length;
  const totais = rotulos.map((_, i) => series.reduce((s, serie) => s + serie.valores[i], 0));
  const max = maximoRedondo(Math.max(0, ...totais));
  const areaW = largura - MARGEM.esquerda - MARGEM.direita;
  const areaH = ALTURA - MARGEM.topo - MARGEM.baixo;
  const banda = areaW / Math.max(1, n);
  const colW = Math.max(2, Math.min(LARGURA_MAX_COLUNA, banda * 0.7));
  const y = (v: number) => MARGEM.topo + areaH - (v / max) * areaH;
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  // Mostra só os rótulos que cabem sem se sobrepor
  const saltoRotulo = Math.max(1, Math.ceil(n / Math.floor(areaW / 46)));
  const semDados = totais.every((t) => t === 0);

  return (
    <figure className="grafico">
      <figcaption className="grafico-topo">
        <strong>{titulo}</strong>
        <button type="button" className="link pequeno" onClick={() => setVerTabela((v) => !v)}>
          {verTabela ? 'Ver gráfico' : 'Ver tabela'}
        </button>
      </figcaption>

      {series.length > 1 && (
        <ul className="legenda">
          {series.map((s) => (
            <li key={s.nome}>
              <span className="amostra" style={{ background: s.cor }} />
              {s.nome}
            </li>
          ))}
        </ul>
      )}

      {verTabela ? (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Período</th>
                {series.map((s) => <th key={s.nome}>{s.nome}</th>)}
                {series.length > 1 && <th>Total</th>}
              </tr>
            </thead>
            <tbody>
              {rotulosCompletos.map((r, i) => (
                <tr key={r}>
                  <td>{r}</td>
                  {series.map((s) => <td key={s.nome}>{formatar(s.valores[i])}</td>)}
                  {series.length > 1 && <td><strong>{formatar(totais[i])}</strong></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={caixa} className="grafico-area" onPointerLeave={() => setAtivo(null)}>
          <svg width={largura} height={ALTURA} role="img" aria-label={titulo}>
            {marcas.map((m) => (
              <g key={m}>
                <line className={m === 0 ? 'eixo' : 'grade'} x1={MARGEM.esquerda} x2={largura - MARGEM.direita} y1={y(m)} y2={y(m)} />
                <text className="marca" x={MARGEM.esquerda - 6} y={y(m)} dy="0.32em" textAnchor="end">{formatarEixo(m)}</text>
              </g>
            ))}

            {rotulos.map((rotulo, i) => {
              const cx = MARGEM.esquerda + banda * i + banda / 2;
              let acumulado = 0;
              const segmentos = series
                .map((s, k) => ({ s, k, v: s.valores[i] }))
                .filter((seg) => seg.v > 0);
              return (
                <g key={rotulo + i} opacity={ativo === null || ativo === i ? 1 : 0.45}>
                  {segmentos.map((seg, idx) => {
                    const base = acumulado;
                    acumulado += seg.v;
                    const topoY = y(acumulado);
                    const baseY = y(base) - (idx > 0 ? ESPACO : 0);
                    const h = Math.max(1, baseY - topoY);
                    return (
                      <path key={seg.k} d={caminhoColuna(cx - colW / 2, topoY, colW, h, idx === segmentos.length - 1)} fill={seg.s.cor} />
                    );
                  })}
                  {i % saltoRotulo === 0 && (
                    <text className="marca" x={cx} y={ALTURA - 6} textAnchor="middle">{rotulo}</text>
                  )}
                  {/* Área de toque maior que a coluna */}
                  <rect
                    x={MARGEM.esquerda + banda * i}
                    y={MARGEM.topo}
                    width={banda}
                    height={areaH}
                    fill="transparent"
                    onPointerEnter={() => setAtivo(i)}
                    onPointerDown={() => setAtivo(i)}
                  />
                </g>
              );
            })}
          </svg>

          {semDados && <p className="grafico-vazio suave">Sem movimento neste período.</p>}

          {ativo !== null && (
            <div
              className="dica"
              style={{
                left: Math.min(Math.max(MARGEM.esquerda + banda * ativo + banda / 2, 90), largura - 90),
              }}
            >
              <strong>{rotulosCompletos[ativo]}</strong>
              {series.map((s) => (
                <div key={s.nome} className="dica-linha">
                  <span className="amostra" style={{ background: s.cor }} />
                  <span>{s.nome}</span>
                  <span className="dica-valor">{formatar(s.valores[ativo])}</span>
                </div>
              ))}
              {series.length > 1 && (
                <div className="dica-linha total">
                  <span />
                  <span>Total</span>
                  <span className="dica-valor">{formatar(totais[ativo])}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
