import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { mensagemDeErro } from '../lib/erros';
import { useCarregar } from '../lib/useCarregar';
import { calcularJuros, formatarParaCampo, formatarReais, lerReais, type ModoJuros } from '../lib/dinheiro';
import { formatarData, somarMeses } from '../lib/datas';
import type { Emprestimo } from '../lib/emprestimos';
import { CampoDinheiro, CampoJuros } from '../componentes/Campos';
import { buscarEmprestimo } from './DetalheEmprestimo';

type Tipo = 'quitacao' | 'juros' | 'parcial';

const opcoes: { id: Tipo; nome: string; explicacao: string }[] = [
  { id: 'quitacao', nome: 'Quitar tudo', explicacao: 'Recebe a dívida + juros e encerra o empréstimo.' },
  { id: 'juros', nome: 'Só juros', explicacao: 'Recebe os juros, a dívida continua igual e abre um novo ciclo.' },
  { id: 'parcial', nome: 'Parcial', explicacao: 'Recebe os juros e abate parte da dívida. Abre um novo ciclo.' },
];

export function Receber() {
  const { id = '' } = useParams();
  const { dados, erro, carregando } = useCarregar(() => buscarEmprestimo(id), [id]);

  if (carregando) return <p className="suave">Carregando…</p>;
  if (erro || !dados) return <p className="erro">{erro || 'Empréstimo não encontrado.'}</p>;
  if (dados.emprestimo.estado !== 'aberto') {
    return (
      <section>
        <p className="alerta">Este empréstimo não está aberto.</p>
        <Link to={`/emprestimos/${id}`}>Voltar</Link>
      </section>
    );
  }
  return <FormularioRecebimento e={dados.emprestimo} />;
}

function FormularioRecebimento({ e }: { e: Emprestimo }) {
  const navegar = useNavigate();
  const [tipo, setTipo] = useState<Tipo>('juros');
  const [jurosRecebidoTxt, setJurosRecebidoTxt] = useState(formatarParaCampo(e.juros_ciclo));
  const [multaTxt, setMultaTxt] = useState('');
  const [abatimentoTxt, setAbatimentoTxt] = useState('');
  const [novoVencimento, setNovoVencimento] = useState(somarMeses(e.vencimento, 1));
  // O sistema sugere os juros do ciclo anterior; pode editar
  const [modoNovosJuros, setModoNovosJuros] = useState<ModoJuros>('reais');
  const [novosJurosTxt, setNovosJurosTxt] = useState(formatarParaCampo(e.juros_ciclo));
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const jurosRecebido = lerReais(jurosRecebidoTxt);
  const multa = multaTxt.trim() ? lerReais(multaTxt) : 0;
  const abatimento = tipo === 'parcial' ? lerReais(abatimentoTxt) : 0;
  const dividaDepois = tipo === 'quitacao' ? 0 : e.valor_divida - (abatimento ?? 0);
  const novosJuros = calcularJuros(modoNovosJuros, novosJurosTxt, dividaDepois);
  const abateTudo = tipo === 'parcial' && abatimento !== null && abatimento >= e.valor_divida;

  const total =
    jurosRecebido === null || multa === null || abatimento === null
      ? null
      : jurosRecebido + multa + (tipo === 'quitacao' ? e.valor_divida : abatimento);

  async function confirmar(ev: FormEvent) {
    ev.preventDefault();
    setErro('');
    if (jurosRecebido === null) return setErro('Informe os juros recebidos (pode ser 0).');
    if (multa === null) return setErro('Valor da multa inválido.');
    if (tipo === 'parcial') {
      if (!abatimento || abatimento <= 0) return setErro('Informe quanto será abatido da dívida.');
      if (abateTudo) return setErro('O abatimento é igual ou maior que a dívida. Use "Quitar tudo".');
    }
    if (tipo !== 'quitacao') {
      if (!novoVencimento || novoVencimento <= e.vencimento) {
        return setErro(`O novo vencimento precisa ser depois de ${formatarData(e.vencimento)}.`);
      }
      if (novosJuros === null) return setErro('Informe os juros do novo ciclo.');
    }

    const resumo =
      tipo === 'quitacao'
        ? `Confirmar recebimento de ${formatarReais(total!)} e QUITAR o empréstimo de ${e.cliente_nome}?`
        : `Confirmar recebimento de ${formatarReais(total!)}?\n\nNovo ciclo: dívida ${formatarReais(dividaDepois)}, juros ${formatarReais(novosJuros!)}, vencimento ${formatarData(novoVencimento)}.`;
    if (!confirm(resumo)) return;

    setEnviando(true);
    const { error } = await supabase.rpc('registrar_recebimento', {
      p_emprestimo: e.id,
      p_tipo: tipo,
      p_novo_vencimento: tipo === 'quitacao' ? null : novoVencimento,
      p_novos_juros: tipo === 'quitacao' ? null : novosJuros,
      p_abatimento: abatimento ?? 0,
      p_multa: multa,
      p_juros_recebido: jurosRecebido,
    });
    if (error) {
      setEnviando(false);
      return setErro(mensagemDeErro(error));
    }
    navegar(`/emprestimos/${e.id}`, { replace: true, state: { aviso: `Recebimento de ${formatarReais(total!)} registrado.` } });
  }

  return (
    <section>
      <Link to={`/emprestimos/${e.id}`} className="voltar">‹ {e.cliente_nome}</Link>
      <h1>Receber pagamento</h1>
      <p className="suave">
        Dívida {formatarReais(e.valor_divida)} · juros do ciclo {formatarReais(e.juros_ciclo)} · vencimento {formatarData(e.vencimento)}
      </p>

      <div className="escolha" role="radiogroup" aria-label="Tipo de recebimento">
        {opcoes.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={tipo === o.id}
            className={tipo === o.id ? 'ativo' : ''}
            onClick={() => {
              setTipo(o.id);
              setErro('');
            }}
          >
            {o.nome}
          </button>
        ))}
      </div>
      <p className="suave pequeno">{opcoes.find((o) => o.id === tipo)!.explicacao}</p>

      <form className="cartao" onSubmit={confirmar}>
        {tipo === 'parcial' && (
          <CampoDinheiro
            rotulo="Quanto vai abater da dívida"
            valor={abatimentoTxt}
            aoMudar={setAbatimentoTxt}
            obrigatorio
            ajuda={`Dívida atual: ${formatarReais(e.valor_divida)}`}
          />
        )}
        {abateTudo && (
          <div className="alerta">
            O abatimento é igual ou maior que a dívida. Para encerrar o empréstimo, use <strong>Quitar tudo</strong>.
            <button type="button" className="botao secundario" onClick={() => setTipo('quitacao')}>Usar "Quitar tudo"</button>
          </div>
        )}

        <CampoDinheiro rotulo="Juros recebidos" valor={jurosRecebidoTxt} aoMudar={setJurosRecebidoTxt} obrigatorio ajuda="Já vem com os juros do ciclo. Ajuste só se combinou outro valor." />
        <CampoDinheiro rotulo="Multa ou encargos de atraso (opcional)" valor={multaTxt} aoMudar={setMultaTxt} />

        {tipo !== 'quitacao' && (
          <>
            <h2>Novo ciclo</h2>
            <label>
              Novo vencimento
              <input type="date" required value={novoVencimento} min={e.vencimento} onChange={(ev) => setNovoVencimento(ev.target.value)} />
            </label>
            <CampoJuros
              rotulo="Juros do novo ciclo"
              modo={modoNovosJuros}
              texto={novosJurosTxt}
              base={dividaDepois}
              textoBase="da nova dívida"
              aoMudar={(m, t) => {
                setModoNovosJuros(m);
                setNovosJurosTxt(t);
              }}
            />
          </>
        )}

        <div className="resumo">
          <div className="linha">
            <span>Total a receber agora</span>
            <strong>{total === null ? '—' : formatarReais(total)}</strong>
          </div>
          {tipo !== 'quitacao' && !abateTudo && (
            <div className="linha pequeno">
              <span>Dívida depois</span>
              <span>{formatarReais(dividaDepois)}</span>
            </div>
          )}
        </div>

        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="botao" disabled={enviando || abateTudo}>{enviando ? 'Registrando…' : 'Confirmar recebimento'}</button>
      </form>
    </section>
  );
}
