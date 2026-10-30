import { Link } from 'react-router';
import { supabase } from '../lib/supabase';
import { consultar, useCarregar } from '../lib/useCarregar';
import { formatarReais } from '../lib/dinheiro';
import type { Emprestimo } from '../lib/emprestimos';
import { CartaoEmprestimo } from '../componentes/CartaoEmprestimo';

type Numeros = {
  dinheiro_na_rua: number;
  juros_ciclos_atuais: number;
  vencem_hoje: number;
  atrasados_qtd: number;
  atrasados_total: number;
  recebido_mes: number;
};

export function Painel() {
  const { dados, erro, carregando } = useCarregar(async () => {
    const [numeros, abertos] = await Promise.all([
      consultar<Numeros>(supabase.rpc('painel')),
      consultar<Emprestimo[]>(supabase.from('v_emprestimos').select('*').eq('estado', 'aberto').order('vencimento')),
    ]);
    return { numeros, abertos };
  });

  if (carregando) return <p className="suave">Carregando…</p>;
  if (erro || !dados) return <p className="erro">{erro || 'Não foi possível carregar.'}</p>;

  const { numeros: n, abertos } = dados;
  const atencao = abertos.filter((e) => e.situacao === 'atrasado' || e.situacao === 'vence_hoje' || e.alerta_risco);
  const proximos = abertos.filter((e) => e.dias_para_vencer >= 1 && e.dias_para_vencer <= 14);

  return (
    <section>
      <h1>Painel</h1>

      <div className="numeros">
        <div className="numero destaque">
          <span>Dinheiro na rua</span>
          <strong>{formatarReais(n.dinheiro_na_rua)}</strong>
        </div>
        <div className="numero">
          <span>Juros dos ciclos atuais</span>
          <strong>{formatarReais(n.juros_ciclos_atuais)}</strong>
        </div>
        <div className="numero">
          <span>Recebido no mês</span>
          <strong>{formatarReais(n.recebido_mes)}</strong>
        </div>
        <Link to="/emprestimos?filtro=hoje" className="numero">
          <span>Vencem hoje</span>
          <strong>{n.vencem_hoje}</strong>
        </Link>
        <Link to="/emprestimos?filtro=atrasados" className={`numero ${n.atrasados_qtd > 0 ? 'perigo' : ''}`}>
          <span>Atrasados</span>
          <strong>{n.atrasados_qtd}</strong>
          <small>{formatarReais(n.atrasados_total)}</small>
        </Link>
      </div>

      <h2>Precisa de atenção</h2>
      {atencao.length === 0 ? (
        <p className="suave">Nenhum atraso, vencimento hoje ou alerta de risco. 👍</p>
      ) : (
        <ul className="lista">{atencao.map((e) => <CartaoEmprestimo key={e.id} e={e} />)}</ul>
      )}

      <h2>Próximos 14 dias</h2>
      {proximos.length === 0 ? (
        <p className="suave">Nenhum vencimento nos próximos 14 dias.</p>
      ) : (
        <ul className="lista">{proximos.map((e) => <CartaoEmprestimo key={e.id} e={e} />)}</ul>
      )}

      {abertos.length === 0 && (
        <p>
          Nenhum empréstimo aberto ainda. <Link to="/novo">Cadastrar o primeiro empréstimo</Link>
        </p>
      )}
    </section>
  );
}
