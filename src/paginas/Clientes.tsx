import { useState } from 'react';
import { Link } from 'react-router';
import { supabase } from '../lib/supabase';
import { consultar, useCarregar } from '../lib/useCarregar';
import { cadastroIncompleto, formatarCpf, soNumeros, type Cliente } from '../lib/clientes';
import { formatarWhatsapp } from '../lib/emprestimos';

type ClienteComContagem = Cliente & { abertos: number };

function simplificar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function Clientes() {
  const [busca, setBusca] = useState('');
  const [verArquivados, setVerArquivados] = useState(false);
  const { dados, erro, carregando } = useCarregar(async () => {
    const [clientes, abertos] = await Promise.all([
      consultar<Cliente[]>(supabase.from('clientes').select('*').order('nome')),
      consultar<{ cliente_id: string }[]>(supabase.from('emprestimos').select('cliente_id').eq('estado', 'aberto')),
    ]);
    const contagem = new Map<string, number>();
    for (const e of abertos) contagem.set(e.cliente_id, (contagem.get(e.cliente_id) ?? 0) + 1);
    return clientes.map((c) => ({ ...c, abertos: contagem.get(c.id) ?? 0 }));
  });

  const termo = simplificar(busca.trim());
  const numeros = soNumeros(busca);
  const arquivados = (dados ?? []).filter((c) => c.arquivado_em).length;
  const lista = (dados ?? []).filter(
    (c: ClienteComContagem) =>
      !!c.arquivado_em === verArquivados &&
      (!termo ||
        simplificar(c.nome).includes(termo) ||
        (numeros.length >= 3 && ((c.cpf ?? '').includes(numeros) || c.whatsapp.includes(numeros)))),
  );

  return (
    <section>
      <div className="titulo-com-acao">
        <h1>Clientes</h1>
        <Link to="/clientes/novo" className="botao pequeno-botao">+ Cliente</Link>
      </div>
      <input type="search" placeholder="Buscar por nome, CPF ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar cliente" />
      {(arquivados > 0 || verArquivados) && (
        <div className="filtros" role="tablist">
          <button role="tab" aria-selected={!verArquivados} className={!verArquivados ? 'ativo' : ''} onClick={() => setVerArquivados(false)}>
            Ativos
          </button>
          <button role="tab" aria-selected={verArquivados} className={verArquivados ? 'ativo' : ''} onClick={() => setVerArquivados(true)}>
            Arquivados ({arquivados})
          </button>
        </div>
      )}

      {carregando && <p className="suave">Carregando…</p>}
      {erro && <p className="erro">{erro}</p>}
      {!carregando && !erro && lista.length === 0 && <p className="suave">Nenhum cliente encontrado.</p>}

      <ul className="lista">
        {lista.map((c) => (
          <li key={c.id}>
            <Link to={`/clientes/${c.id}`} className="cartao-emprestimo">
              <div className="linha">
                <strong>{c.nome}</strong>
                {c.abertos > 0 && <span className="etiqueta">{c.abertos} em aberto</span>}
              </div>
              <div className="linha pequeno suave">
                <span>{c.cpf ? `CPF ${formatarCpf(c.cpf)}` : 'Sem CPF'}</span>
                <span>{formatarWhatsapp(c.whatsapp)}</span>
              </div>
              {cadastroIncompleto(c) && <div className="risco pequeno">Cadastro incompleto: faltam CPF ou endereço</div>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
