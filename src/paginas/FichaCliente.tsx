import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { mensagemDeErro } from '../lib/erros';
import { consultar, useCarregar } from '../lib/useCarregar';
import { cadastroIncompleto, enderecoEmUmaLinha, formatarCpf, type Cliente } from '../lib/clientes';
import { formatarWhatsapp, type Emprestimo } from '../lib/emprestimos';
import { formatarData, formatarDataHora } from '../lib/datas';
import { CartaoEmprestimo } from '../componentes/CartaoEmprestimo';
import { CADASTRO_SIMPLES } from '../marca';

type Alteracao = { id: number; criado_em: string; usuario_nome: string | null; usuario_email: string | null; dados_anteriores: Partial<Cliente> };

const nomesCampos: Partial<Record<keyof Cliente, string>> = {
  nome: 'Nome',
  whatsapp: 'WhatsApp',
  cpf: 'CPF',
  data_nascimento: 'Nascimento',
  email: 'E-mail',
  cep: 'CEP',
  logradouro: 'Rua',
  numero: 'Número',
  complemento: 'Complemento',
  bairro: 'Bairro',
  cidade: 'Cidade',
  uf: 'UF',
  observacoes: 'Observações',
  indicacao: 'Indicado por',
  arquivado_em: 'Arquivamento',
};

export async function buscarCliente(id: string) {
  const [cliente, emprestimos, historico] = await Promise.all([
    consultar<Cliente>(supabase.from('clientes').select('*').eq('id', id).single()),
    consultar<Emprestimo[]>(supabase.from('v_emprestimos').select('*').eq('cliente_id', id).order('criado_em', { ascending: false })),
    consultar<Alteracao[]>(supabase.from('v_clientes_historico').select('*').eq('cliente_id', id).order('id', { ascending: false })),
  ]);
  return { cliente, emprestimos, historico };
}

// Quais campos mudaram numa alteração (comparando com a versão seguinte)
function camposAlterados(antes: Partial<Cliente>, depois: Partial<Cliente>): string[] {
  return (Object.keys(nomesCampos) as (keyof Cliente)[])
    .filter((k) => (antes[k] ?? null) !== (depois[k] ?? null))
    .map((k) => nomesCampos[k]!);
}

export function FichaCliente() {
  const { id = '' } = useParams();
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso;
  const { dados, erro, carregando, recarregar } = useCarregar(() => buscarCliente(id), [id]);
  const { ehAdmin } = useAuth();
  const [erroAcao, setErroAcao] = useState('');

  if (carregando) return <p className="suave">Carregando…</p>;
  if (erro || !dados) return <p className="erro">{erro || 'Cliente não encontrado.'}</p>;

  const { cliente: c, emprestimos, historico } = dados;

  async function arquivar(arquivar: boolean) {
    if (
      arquivar &&
      !confirm(`Arquivar ${c.nome}? O cliente sai das listas e das buscas, mas nada é apagado. Dá para reativar depois.`)
    )
      return;
    setErroAcao('');
    const { error } = await supabase.rpc('arquivar_cliente', { p_cliente: c.id, p_arquivar: arquivar });
    if (error) return setErroAcao(mensagemDeErro(error));
    recarregar();
  }
  // Para cada alteração, a versão "depois" é a próxima foto do histórico (ou o cadastro atual)
  const versoes: Partial<Cliente>[] = [c, ...historico.map((h) => h.dados_anteriores)];

  return (
    <section>
      <Link to="/clientes" className="voltar">‹ Clientes</Link>
      <h1>{c.nome}</h1>
      {aviso && <p className="sucesso" role="status">{aviso}</p>}
      {erroAcao && <p className="erro" role="alert">{erroAcao}</p>}
      {c.arquivado_em && (
        <p className="alerta">
          <strong>Cliente arquivado</strong> em {formatarDataHora(c.arquivado_em)}. Ele não aparece nas listas nem nas buscas.
        </p>
      )}
      {!CADASTRO_SIMPLES && cadastroIncompleto(c) && !c.arquivado_em && (
        <p className="alerta">
          <strong>Cadastro incompleto.</strong> Faltam CPF ou endereço. <Link to={`/clientes/${c.id}/editar`}>Completar agora</Link>
        </p>
      )}

      <dl className="ficha">
        <div><dt>CPF</dt><dd>{c.cpf ? formatarCpf(c.cpf) : '—'}</dd></div>
        <div><dt>WhatsApp</dt><dd>{formatarWhatsapp(c.whatsapp)}</dd></div>
        <div><dt>Nascimento</dt><dd>{c.data_nascimento ? formatarData(c.data_nascimento) : '—'}</dd></div>
        <div><dt>E-mail</dt><dd>{c.email ?? '—'}</dd></div>
        {c.indicacao && <div className="inteira"><dt>Indicado por</dt><dd>{c.indicacao}</dd></div>}
        <div className="inteira"><dt>Endereço</dt><dd>{enderecoEmUmaLinha(c) || '—'}</dd></div>
        {c.observacoes && <div className="inteira"><dt>Observações</dt><dd>{c.observacoes}</dd></div>}
        <div className="inteira"><dt>Cliente desde</dt><dd>{formatarDataHora(c.criado_em)}</dd></div>
      </dl>

      <div className="acoes-grandes">
        {!c.arquivado_em && <Link to={`/novo?cliente=${c.id}`} className="botao">Novo empréstimo para este cliente</Link>}
        <Link to={`/clientes/${c.id}/editar`} className="botao secundario">Editar cadastro</Link>
        {ehAdmin &&
          (c.arquivado_em ? (
            <button className="botao secundario" onClick={() => arquivar(false)}>Reativar cliente</button>
          ) : (
            <button className="botao perigo" onClick={() => arquivar(true)}>Arquivar cliente</button>
          ))}
      </div>

      <h2>Empréstimos</h2>
      {emprestimos.length === 0 ? (
        <p className="suave">Nenhum empréstimo ainda.</p>
      ) : (
        <ul className="lista">{emprestimos.map((e) => <CartaoEmprestimo key={e.id} e={e} />)}</ul>
      )}

      {historico.length > 0 && (
        <>
          <h2>Alterações no cadastro</h2>
          <ul className="historico">
            {historico.map((h, i) => (
              <li key={h.id}>
                <strong>Alterado: {camposAlterados(h.dados_anteriores, versoes[i]).join(', ') || 'nenhum campo'}</strong>
                <div className="pequeno suave">
                  {formatarDataHora(h.criado_em)} · {h.usuario_nome || h.usuario_email || 'sistema'}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
