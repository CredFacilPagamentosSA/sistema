import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { mensagemDeErro } from '../lib/erros';
import { useCarregar } from '../lib/useCarregar';
import { formatarParaCampo, lerReais } from '../lib/dinheiro';
import { formatarWhatsapp, normalizarWhatsapp, type Emprestimo } from '../lib/emprestimos';
import { CampoDinheiro } from '../componentes/Campos';
import { buscarEmprestimo } from './DetalheEmprestimo';

export function EditarEmprestimo() {
  const { id = '' } = useParams();
  const { dados, erro, carregando } = useCarregar(() => buscarEmprestimo(id), [id]);
  if (carregando) return <p className="suave">Carregando…</p>;
  if (erro || !dados) return <p className="erro">{erro || 'Empréstimo não encontrado.'}</p>;
  return <FormularioEdicao e={dados.emprestimo} />;
}

function FormularioEdicao({ e }: { e: Emprestimo }) {
  const navegar = useNavigate();
  const aberto = e.estado === 'aberto';
  const [nome, setNome] = useState(e.cliente_nome);
  const [whatsapp, setWhatsapp] = useState(formatarWhatsapp(e.cliente_whatsapp));
  const [vencimento, setVencimento] = useState(e.vencimento);
  const [jurosTxt, setJurosTxt] = useState(formatarParaCampo(e.juros_ciclo));
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro('');
    const numero = normalizarWhatsapp(whatsapp);
    const juros = lerReais(jurosTxt);
    if (!nome.trim()) return setErro('Informe o nome do cliente.');
    if (!numero) return setErro('WhatsApp inválido: informe DDD + número.');
    if (aberto && juros === null) return setErro('Valor dos juros inválido.');

    setEnviando(true);
    const { error } = await supabase.rpc('editar_emprestimo', {
      p_emprestimo: e.id,
      p_nome: nome,
      p_whatsapp: numero,
      p_vencimento: aberto ? vencimento : null,
      p_juros_ciclo: aberto ? juros : null,
    });
    if (error) {
      setEnviando(false);
      return setErro(mensagemDeErro(error));
    }
    navegar(`/emprestimos/${e.id}`, { replace: true, state: { aviso: 'Dados atualizados. A alteração ficou registrada no histórico.' } });
  }

  return (
    <section>
      <Link to={`/emprestimos/${e.id}`} className="voltar">‹ {e.cliente_nome}</Link>
      <h1>Editar dados</h1>
      <form className="cartao" onSubmit={salvar}>
        <label>
          Nome do cliente
          <input required value={nome} onChange={(ev) => setNome(ev.target.value)} />
        </label>
        <label>
          WhatsApp
          <input type="tel" inputMode="tel" required value={whatsapp} onChange={(ev) => setWhatsapp(ev.target.value)} />
        </label>
        {aberto && (
          <>
            <label>
              Vencimento do ciclo atual
              <input type="date" required value={vencimento} onChange={(ev) => setVencimento(ev.target.value)} />
            </label>
            <CampoDinheiro rotulo="Juros do ciclo atual" valor={jurosTxt} aoMudar={setJurosTxt} obrigatorio />
          </>
        )}
        <p className="suave pequeno">
          Toda edição fica no histórico e pode ser desfeita. Para CPF, endereço e outros dados, use{' '}
          <Link to={`/clientes/${e.cliente_id}/editar`}>Editar cadastro do cliente</Link>.
        </p>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="botao" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar alterações'}</button>
      </form>
    </section>
  );
}
