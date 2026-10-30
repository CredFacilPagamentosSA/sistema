import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { mensagemDeErro } from '../lib/erros';
import { consultar, useCarregar } from '../lib/useCarregar';
import { formatarReais } from '../lib/dinheiro';
import { formatarData, formatarDataHora } from '../lib/datas';
import { descreverLancamento, formatarWhatsapp, ultimoDesfazivel, type Emprestimo, type Lancamento } from '../lib/emprestimos';
import { EtiquetaSituacao } from '../componentes/CartaoEmprestimo';

export async function buscarEmprestimo(id: string) {
  const [emprestimo, historico] = await Promise.all([
    consultar<Emprestimo>(supabase.from('v_emprestimos').select('*').eq('id', id).single()),
    consultar<Lancamento[]>(supabase.from('v_lancamentos').select('*').eq('emprestimo_id', id).order('id', { ascending: false })),
  ]);
  return { emprestimo, historico };
}

export function DetalheEmprestimo() {
  const { id = '' } = useParams();
  const local = useLocation();
  const navegar = useNavigate();
  const aviso = (local.state as { aviso?: string } | null)?.aviso;
  const { dados, erro, carregando, recarregar } = useCarregar(() => buscarEmprestimo(id), [id]);
  const [erroAcao, setErroAcao] = useState('');
  const [avisoAcao, setAvisoAcao] = useState('');
  const [ocupado, setOcupado] = useState(false);

  if (carregando) return <p className="suave">Carregando…</p>;
  if (erro || !dados) return <p className="erro">{erro || 'Empréstimo não encontrado.'}</p>;

  const { emprestimo: e, historico } = dados;
  const aberto = e.estado === 'aberto';
  const alvoDesfazer = ultimoDesfazivel(historico);

  async function desfazer() {
    if (!alvoDesfazer) return;
    const mensagem =
      alvoDesfazer.tipo === 'criacao'
        ? 'Desfazer a criação vai CANCELAR este empréstimo (ele não é apagado, fica no histórico como cancelado). Continuar?'
        : `Desfazer ${descreverLancamento(alvoDesfazer)}? Os valores voltam a ser como eram antes, e o recebimento deixa de contar.`;
    if (!confirm(mensagem)) return;
    setErroAcao('');
    setAvisoAcao('');
    setOcupado(true);
    const { error } = await supabase.rpc('desfazer_ultimo', { p_emprestimo: e.id });
    setOcupado(false);
    if (error) return setErroAcao(mensagemDeErro(error));
    // Tira o aviso da ação anterior (ex.: "Recebimento registrado") para não confundir
    navegar(local.pathname, { replace: true, state: null });
    setAvisoAcao('Lançamento desfeito. O registro do "desfazer" ficou no histórico.');
    recarregar();
  }

  return (
    <section>
      <Link to="/emprestimos" className="voltar">‹ Empréstimos</Link>
      <h1>{e.cliente_nome}</h1>
      <p className="suave">
        WhatsApp {formatarWhatsapp(e.cliente_whatsapp)} · <EtiquetaSituacao e={e} />
      </p>

      {aviso && <p className="sucesso" role="status">{aviso}</p>}
      {avisoAcao && <p className="sucesso" role="status">{avisoAcao}</p>}
      {erroAcao && <p className="erro" role="alert">{erroAcao}</p>}
      {e.alerta_risco && (
        <p className="alerta">
          <strong>Alerta de risco:</strong> {e.renovacoes_so_juros_seguidas} renovações seguidas pagando só os juros.
        </p>
      )}

      <div className="numeros">
        {aberto ? (
          <>
            <div className="numero destaque">
              <span>Para quitar tudo</span>
              <strong>{formatarReais(e.total_para_quitar)}</strong>
            </div>
            <div className="numero">
              <span>Valor em dívida</span>
              <strong>{formatarReais(e.valor_divida)}</strong>
            </div>
            <div className="numero">
              <span>Juros do ciclo</span>
              <strong>{formatarReais(e.juros_ciclo)}</strong>
            </div>
            <div className="numero">
              <span>Vencimento</span>
              <strong>{formatarData(e.vencimento)}</strong>
            </div>
          </>
        ) : (
          <div className="numero">
            <span>{e.estado === 'quitado' ? 'Quitado em' : 'Cancelado em'}</span>
            <strong>{e.encerrado_em ? formatarDataHora(e.encerrado_em) : '-'}</strong>
          </div>
        )}
        <div className="numero">
          <span>Valor emprestado</span>
          <strong>{formatarReais(e.valor_emprestado)}</strong>
        </div>
        <div className="numero">
          <span>Renovações</span>
          <strong>{e.renovacoes}</strong>
        </div>
      </div>

      <div className="acoes-grandes">
        {aberto && (
          <>
            <Link to={`/emprestimos/${e.id}/receber`} className="botao">Receber pagamento</Link>
            <Link to={`/emprestimos/${e.id}/cobrar`} className="botao secundario">Cobrar agora</Link>
          </>
        )}
        {e.estado !== 'cancelado' && (
          <Link to={`/emprestimos/${e.id}/editar`} className="botao secundario">Editar dados</Link>
        )}
        {alvoDesfazer && (
          <button className="botao perigo" disabled={ocupado} onClick={desfazer}>
            Desfazer último lançamento
          </button>
        )}
      </div>

      <h2>Histórico</h2>
      <ul className="historico">
        {historico.map((l) => (
          <li key={l.id} className={l.desfeito ? 'desfeito' : ''}>
            <div className="linha">
              <strong>{l.descricao}</strong>
              {l.valor_recebido > 0 && <span className="valor">{formatarReais(l.valor_recebido)}</span>}
            </div>
            {l.valor_recebido > 0 && (
              <div className="pequeno suave">
                Juros {formatarReais(l.juros_recebido)}
                {l.abatimento > 0 && ` · ${l.tipo === 'quitacao' ? 'Dívida' : 'Abatido'} ${formatarReais(l.abatimento)}`}
                {l.multa > 0 && ` · Multa ${formatarReais(l.multa)}`}
              </div>
            )}
            <div className="pequeno suave">
              {formatarDataHora(l.criado_em)} · {l.usuario_nome || l.usuario_email || 'sistema'}
              {l.desfeito && <span className="etiqueta cinza">Desfeito</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
