import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { consultar, useCarregar } from '../lib/useCarregar';
import type { Emprestimo } from '../lib/emprestimos';
import { CartaoEmprestimo } from '../componentes/CartaoEmprestimo';

const filtros = [
  { id: 'todos', nome: 'Todos', aceita: (e: Emprestimo) => e.estado !== 'cancelado' },
  { id: 'atrasados', nome: 'Atrasados', aceita: (e: Emprestimo) => e.situacao === 'atrasado' },
  { id: 'hoje', nome: 'Hoje', aceita: (e: Emprestimo) => e.situacao === 'vence_hoje' },
  { id: 'em_dia', nome: 'Em dia', aceita: (e: Emprestimo) => e.situacao === 'em_dia' || e.situacao === 'vence_em_breve' },
  { id: 'quitados', nome: 'Quitados', aceita: (e: Emprestimo) => e.situacao === 'quitado' },
  { id: 'cancelados', nome: 'Cancelados', aceita: (e: Emprestimo) => e.situacao === 'cancelado' },
];

// Busca sem diferenciar maiúsculas e acentos: "joao" encontra "João"
function simplificar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function Emprestimos() {
  const [parametros, setParametros] = useSearchParams();
  const filtroAtual = filtros.find((f) => f.id === parametros.get('filtro')) ?? filtros[0];
  const [busca, setBusca] = useState('');

  const { dados, erro, carregando } = useCarregar(() =>
    consultar<Emprestimo[]>(supabase.from('v_emprestimos').select('*').order('vencimento')),
  );

  const termo = simplificar(busca.trim());
  const lista = (dados ?? []).filter((e) => filtroAtual.aceita(e) && (!termo || simplificar(e.cliente_nome).includes(termo)));
  // Abertos primeiro (por vencimento); depois quitados, mais recentes primeiro
  lista.sort((a, b) =>
    a.estado === b.estado
      ? a.estado === 'aberto'
        ? a.vencimento.localeCompare(b.vencimento)
        : (b.encerrado_em ?? '').localeCompare(a.encerrado_em ?? '')
      : a.estado === 'aberto'
        ? -1
        : 1,
  );

  return (
    <section>
      <div className="titulo-com-acao">
        <h1>Empréstimos</h1>
        <Link to="/novo" className="botao pequeno-botao">+ Novo</Link>
      </div>

      <input type="search" placeholder="Buscar por nome" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar por nome" />

      <div className="filtros" role="tablist">
        {filtros.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={f.id === filtroAtual.id}
            className={f.id === filtroAtual.id ? 'ativo' : ''}
            onClick={() => setParametros(f.id === 'todos' ? {} : { filtro: f.id }, { replace: true })}
          >
            {f.nome}
          </button>
        ))}
      </div>

      {carregando && <p className="suave">Carregando…</p>}
      {erro && <p className="erro">{erro}</p>}
      {!carregando && !erro && lista.length === 0 && <p className="suave">Nenhum empréstimo encontrado.</p>}
      <ul className="lista">{lista.map((e) => <CartaoEmprestimo key={e.id} e={e} />)}</ul>
    </section>
  );
}
