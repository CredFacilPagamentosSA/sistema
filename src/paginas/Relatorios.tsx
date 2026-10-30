import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { consultar, useCarregar } from '../lib/useCarregar';
import { formatarReais } from '../lib/dinheiro';
import { diasEntre, formatarData, hojeSP, somarDias, somarMeses } from '../lib/datas';
import { GraficoColunas } from '../componentes/GraficoColunas';

type Totais = {
  recebido: number;
  juros: number;
  abatimento: number;
  multa: number;
  recebimentos: number;
  quitados: number;
  emprestado: number;
  novos: number;
};
type Ponto = { periodo: string; juros: number; abatimento: number; multa: number; emprestado: number; novos: number };
type Relatorio = { agrupamento: 'dia' | 'mes'; totais: Totais; serie: Ponto[] };

function inicioDoMes(iso: string) {
  return iso.slice(0, 8) + '01';
}

function periodoPronto(id: string, hoje: string): [string, string] {
  const mes = inicioDoMes(hoje);
  switch (id) {
    case 'mes_passado':
      return [somarMeses(mes, -1), somarDias(mes, -1)];
    case '3m':
      return [somarMeses(mes, -2), hoje];
    case '6m':
      return [somarMeses(mes, -5), hoje];
    case '12m':
      return [somarMeses(mes, -11), hoje];
    case 'ano':
      return [hoje.slice(0, 4) + '-01-01', hoje];
    default:
      return [mes, hoje];
  }
}

// Período anterior para comparar: os mesmos meses antes (nos períodos prontos)
// ou a mesma quantidade de dias imediatamente antes (nas datas escolhidas)
function periodoAnterior(id: string, inicio: string, fim: string, hoje: string): [string, string] {
  const mes = inicioDoMes(hoje);
  const meses: Record<string, number> = { mes: 1, '3m': 3, '6m': 6, '12m': 12, ano: 12 };
  if (id === 'mes_passado') return [somarMeses(mes, -2), somarDias(somarMeses(mes, -1), -1)];
  if (meses[id]) return [somarMeses(inicio, -meses[id]), somarMeses(fim, -meses[id])];
  const fimAnterior = somarDias(inicio, -1);
  return [somarDias(fimAnterior, -diasEntre(inicio, fim)), fimAnterior];
}

const periodos = [
  { id: 'mes', nome: 'Este mês' },
  { id: 'mes_passado', nome: 'Mês passado' },
  { id: '3m', nome: '3 meses' },
  { id: '6m', nome: '6 meses' },
  { id: '12m', nome: '12 meses' },
  { id: 'ano', nome: 'Este ano' },
  { id: 'outro', nome: 'Escolher datas' },
];

const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const formatarEixo = (centavos: number) => (centavos === 0 ? '0' : `R$ ${compacto.format(centavos / 100)}`);

function variacao(atual: number, anterior: number) {
  if (anterior === 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

function Variacao({ atual, anterior }: { atual: number; anterior: number }) {
  const v = variacao(atual, anterior);
  if (v === null) return <small className="suave">sem comparação</small>;
  const sobe = v > 0;
  return (
    <small className={v === 0 ? 'suave' : sobe ? 'sobe' : 'desce'}>
      {v === 0 ? '=' : sobe ? '▲' : '▼'} {Math.abs(v)}% vs período anterior
    </small>
  );
}

export function Relatorios() {
  const hoje = hojeSP();
  const [escolha, setEscolha] = useState('mes');
  const [inicioOutro, setInicioOutro] = useState(inicioDoMes(hoje));
  const [fimOutro, setFimOutro] = useState(hoje);
  const [inicio, fim] = escolha === 'outro' ? [inicioOutro, fimOutro] : periodoPronto(escolha, hoje);

  const [inicioAnterior, fimAnterior] = periodoAnterior(escolha, inicio, fim, hoje);

  const { dados, erro, carregando } = useCarregar(async () => {
    if (!inicio || !fim || fim < inicio) throw new Error('Período inválido: a data final precisa ser igual ou depois da inicial.');
    const [atual, anterior] = await Promise.all([
      consultar<Relatorio>(supabase.rpc('relatorio', { p_inicio: inicio, p_fim: fim })),
      consultar<Relatorio>(supabase.rpc('relatorio', { p_inicio: inicioAnterior, p_fim: fimAnterior })),
    ]);
    return { atual, anterior };
  }, [inicio, fim]);

  const r = dados?.atual;
  const ant = dados?.anterior.totais;
  const porDia = r?.agrupamento === 'dia';
  const rotulos = (r?.serie ?? []).map((p) => {
    const [a, m, d] = p.periodo.split('-');
    return porDia ? `${d}/${m}` : `${meses[Number(m) - 1]}/${a.slice(2)}`;
  });
  const rotulosCompletos = (r?.serie ?? []).map((p) => {
    const [a, m] = p.periodo.split('-');
    return porDia ? formatarData(p.periodo) : `${meses[Number(m) - 1]}/${a}`;
  });
  const faturamento = r ? Number(r.totais.juros) + Number(r.totais.multa) : 0;
  const faturamentoAnterior = ant ? Number(ant.juros) + Number(ant.multa) : 0;

  return (
    <section>
      <h1>Relatórios</h1>

      <div className="filtros" role="tablist" aria-label="Período">
        {periodos.map((p) => (
          <button key={p.id} role="tab" aria-selected={escolha === p.id} className={escolha === p.id ? 'ativo' : ''} onClick={() => setEscolha(p.id)}>
            {p.nome}
          </button>
        ))}
      </div>
      {escolha === 'outro' && (
        <div className="datas-periodo">
          <label>
            De
            <input type="date" value={inicioOutro} max={fimOutro} onChange={(e) => setInicioOutro(e.target.value)} />
          </label>
          <label>
            Até
            <input type="date" value={fimOutro} min={inicioOutro} onChange={(e) => setFimOutro(e.target.value)} />
          </label>
        </div>
      )}
      <p className="suave pequeno">
        {formatarData(inicio)} a {formatarData(fim)} · comparando com {formatarData(inicioAnterior)} a {formatarData(fimAnterior)}
      </p>

      {erro && <p className="erro">{erro}</p>}
      {carregando && !r && <p className="suave">Carregando…</p>}

      {r && ant && (
        <>
          <div className="numeros">
            <div className="numero destaque">
              <span>Faturamento (juros + multas)</span>
              <strong>{formatarReais(faturamento)}</strong>
              <Variacao atual={faturamento} anterior={faturamentoAnterior} />
            </div>
            <div className="numero">
              <span>Total recebido</span>
              <strong>{formatarReais(Number(r.totais.recebido))}</strong>
              <Variacao atual={Number(r.totais.recebido)} anterior={Number(ant.recebido)} />
            </div>
            <div className="numero">
              <span>Capital devolvido</span>
              <strong>{formatarReais(Number(r.totais.abatimento))}</strong>
              <small className="suave">abatimentos e quitações</small>
            </div>
            <div className="numero">
              <span>Emprestado no período</span>
              <strong>{formatarReais(Number(r.totais.emprestado))}</strong>
              <small className="suave">{r.totais.novos} {Number(r.totais.novos) === 1 ? 'empréstimo novo' : 'empréstimos novos'}</small>
            </div>
            <div className="numero">
              <span>Recebimentos</span>
              <strong>{r.totais.recebimentos}</strong>
              <small className="suave">{r.totais.quitados} {Number(r.totais.quitados) === 1 ? 'quitação' : 'quitações'}</small>
            </div>
            <div className="numero">
              <span>Multas</span>
              <strong>{formatarReais(Number(r.totais.multa))}</strong>
            </div>
          </div>

          <GraficoColunas
            titulo={porDia ? 'Recebido por dia' : 'Recebido por mês'}
            rotulos={rotulos}
            rotulosCompletos={rotulosCompletos}
            series={[
              { nome: 'Juros', cor: 'var(--serie-1)', valores: r.serie.map((p) => Number(p.juros)) },
              { nome: 'Capital devolvido', cor: 'var(--serie-2)', valores: r.serie.map((p) => Number(p.abatimento)) },
              { nome: 'Multas', cor: 'var(--serie-3)', valores: r.serie.map((p) => Number(p.multa)) },
            ]}
            formatar={formatarReais}
            formatarEixo={formatarEixo}
          />

          <GraficoColunas
            titulo={porDia ? 'Emprestado por dia' : 'Emprestado por mês'}
            rotulos={rotulos}
            rotulosCompletos={rotulosCompletos}
            series={[{ nome: 'Emprestado', cor: 'var(--serie-1)', valores: r.serie.map((p) => Number(p.emprestado)) }]}
            formatar={formatarReais}
            formatarEixo={formatarEixo}
          />

          <p className="suave pequeno">
            Recebimentos desfeitos e empréstimos cancelados não entram nas contas. "Capital devolvido" é a parte do dinheiro
            emprestado que voltou (abatimentos e quitações); "Faturamento" é o que entrou de juros e multas.
          </p>
        </>
      )}
    </section>
  );
}
