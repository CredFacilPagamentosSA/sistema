import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../lib/supabase';
import { mensagemDeErro } from '../lib/erros';
import { calcularJuros, formatarReais, lerReais, type ModoJuros } from '../lib/dinheiro';
import { formatarData, hojeSP, somarMeses } from '../lib/datas';
import { normalizarWhatsapp } from '../lib/emprestimos';
import { CampoDinheiro, CampoJuros } from '../componentes/Campos';

export function NovoEmprestimo() {
  const navegar = useNavigate();
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [valorTxt, setValorTxt] = useState('');
  const [modoJuros, setModoJuros] = useState<ModoJuros>('reais');
  const [jurosTxt, setJurosTxt] = useState('');
  const [vencimento, setVencimento] = useState(somarMeses(hojeSP(), 1));
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const valor = lerReais(valorTxt);
  const juros = calcularJuros(modoJuros, jurosTxt, valor ?? 0);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    const numero = normalizarWhatsapp(whatsapp);
    if (!nome.trim()) return setErro('Informe o nome do cliente.');
    if (!numero) return setErro('WhatsApp inválido: informe DDD + número, por exemplo (11) 91234-5678.');
    if (!valor || valor <= 0) return setErro('Informe o valor emprestado.');
    if (juros === null) return setErro('Informe os juros (pode ser 0).');
    if (!vencimento) return setErro('Informe o primeiro vencimento.');

    setEnviando(true);
    try {
      // Cliente que já pegou empréstimo antes: reaproveita o cadastro pelo WhatsApp
      const { data: existente } = await supabase.from('clientes').select('id, nome').eq('whatsapp', numero).maybeSingle();
      if (existente && !confirm(`Já existe um cliente com este WhatsApp: ${existente.nome}. Ligar o novo empréstimo a esse cliente?`)) {
        setEnviando(false);
        return;
      }
      const { data, error } = await supabase.rpc('criar_emprestimo', {
        p_nome: nome,
        p_whatsapp: numero,
        p_valor: valor,
        p_juros: juros,
        p_vencimento: vencimento,
        p_cliente_id: existente?.id ?? null,
      });
      if (error) throw error;
      navegar(`/emprestimos/${data}`, { replace: true });
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <section>
      <h1>Novo empréstimo</h1>
      <form className="cartao" onSubmit={salvar}>
        <label>
          Nome do cliente
          <input required autoComplete="off" value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label>
          WhatsApp (com DDD)
          <input type="tel" inputMode="tel" placeholder="(11) 91234-5678" required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
        </label>
        <CampoDinheiro rotulo="Valor emprestado" valor={valorTxt} aoMudar={setValorTxt} obrigatorio />
        <CampoJuros
          rotulo="Juros do primeiro ciclo"
          modo={modoJuros}
          texto={jurosTxt}
          base={valor ?? 0}
          textoBase="do valor emprestado"
          aoMudar={(m, t) => {
            setModoJuros(m);
            setJurosTxt(t);
          }}
        />
        <label>
          Primeiro vencimento
          <input type="date" required value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
        </label>

        {valor !== null && valor > 0 && juros !== null && vencimento && (
          <p className="resumo">
            Em {formatarData(vencimento)}: quitar tudo = <strong>{formatarReais(valor + juros)}</strong>, ou só os juros ={' '}
            <strong>{formatarReais(juros)}</strong> e renovar.
          </p>
        )}

        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="botao" disabled={enviando}>{enviando ? 'Salvando…' : 'Cadastrar empréstimo'}</button>
      </form>
    </section>
  );
}
