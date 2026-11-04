import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { mensagemDeErro } from '../lib/erros';
import { calcularJuros, formatarReais, lerReais, type ModoJuros } from '../lib/dinheiro';
import { formatarData, hojeSP, somarMeses } from '../lib/datas';
import { formatarWhatsapp } from '../lib/emprestimos';
import { clienteVazio, formatarCpf, soNumeros, type Cliente } from '../lib/clientes';
import { CampoDinheiro, CampoJuros } from '../componentes/Campos';
import { FormCliente, validarCliente } from '../componentes/FormCliente';
import { CADASTRO_SIMPLES } from '../marca';

function simplificar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function NovoEmprestimo() {
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const [modo, setModo] = useState<'existente' | 'novo'>(parametros.get('cliente') ? 'existente' : 'novo');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [escolhido, setEscolhido] = useState<Cliente | null>(null);
  const [busca, setBusca] = useState('');
  const [novoCliente, setNovoCliente] = useState(clienteVazio);
  // Se o cliente novo já foi salvo e o empréstimo falhou, reaproveita na próxima tentativa
  const [clienteCriadoId, setClienteCriadoId] = useState<string | null>(null);

  const [valorTxt, setValorTxt] = useState('');
  const [modoJuros, setModoJuros] = useState<ModoJuros>('reais');
  const [jurosTxt, setJurosTxt] = useState('');
  const [vencimento, setVencimento] = useState(somarMeses(hojeSP(), 1));
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    supabase
      .from('clientes')
      .select('*')
      .order('nome')
      .then(({ data }) => {
        const lista = (data as Cliente[] | null) ?? [];
        setClientes(lista);
        const id = parametros.get('cliente');
        if (id) setEscolhido(lista.find((c) => c.id === id) ?? null);
      });
  }, [parametros]);

  const valor = lerReais(valorTxt);
  const juros = calcularJuros(modoJuros, jurosTxt, valor ?? 0);

  const termo = simplificar(busca.trim());
  const numeros = soNumeros(busca);
  const encontrados = termo
    ? clientes
        .filter((c) => !c.arquivado_em)
        .filter((c) => simplificar(c.nome).includes(termo) || (numeros.length >= 3 && ((c.cpf ?? '').includes(numeros) || c.whatsapp.includes(numeros))))
        .slice(0, 8)
    : [];

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (modo === 'existente' && !escolhido) return setErro('Escolha o cliente na busca.');
    if (modo === 'novo' && !clienteCriadoId) {
      const problema = validarCliente(novoCliente);
      if (problema) return setErro(problema);
    }
    if (!valor || valor <= 0) return setErro('Informe o valor emprestado.');
    if (juros === null) return setErro('Informe os juros (pode ser 0).');
    if (!vencimento) return setErro('Informe o primeiro vencimento.');

    setEnviando(true);
    try {
      let clienteId = modo === 'existente' ? escolhido!.id : clienteCriadoId;
      if (!clienteId) {
        const { data, error } = await supabase.rpc('salvar_cliente', { p_cliente: null, p_dados: novoCliente });
        if (error) throw error;
        clienteId = data as string;
        setClienteCriadoId(clienteId);
      }
      const { data, error } = await supabase.rpc('criar_emprestimo', {
        p_nome: '',
        p_whatsapp: '',
        p_valor: valor,
        p_juros: juros,
        p_vencimento: vencimento,
        p_cliente_id: clienteId,
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
      <form className="cartao" onSubmit={salvar} noValidate>
        <h2>Cliente</h2>
        {!clienteCriadoId && (
          <div className="escolha" role="radiogroup" aria-label="Cliente">
            <button type="button" role="radio" aria-checked={modo === 'novo'} className={modo === 'novo' ? 'ativo' : ''} onClick={() => setModo('novo')}>
              Cliente novo
            </button>
            <button type="button" role="radio" aria-checked={modo === 'existente'} className={modo === 'existente' ? 'ativo' : ''} onClick={() => setModo('existente')}>
              Já cadastrado
            </button>
          </div>
        )}

        {modo === 'existente' &&
          (escolhido ? (
            <div className="resumo">
              <div className="linha">
                <strong>{escolhido.nome}</strong>
                {!parametros.get('cliente') && (
                  <button type="button" className="link" onClick={() => setEscolhido(null)}>Trocar</button>
                )}
              </div>
              <div className="pequeno suave">
                {!CADASTRO_SIMPLES && `${escolhido.cpf ? `CPF ${formatarCpf(escolhido.cpf)}` : 'Sem CPF'} · `}
                {formatarWhatsapp(escolhido.whatsapp)}
              </div>
            </div>
          ) : (
            <>
              <input type="search" placeholder={CADASTRO_SIMPLES ? 'Buscar por nome ou telefone' : 'Buscar por nome, CPF ou telefone'} value={busca} onChange={(ev) => setBusca(ev.target.value)} aria-label="Buscar cliente" />
              {termo && encontrados.length === 0 && <p className="suave pequeno">Nenhum cliente encontrado. Use "Cliente novo".</p>}
              <ul className="menu-lista">
                {encontrados.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setEscolhido(c)}>
                      <strong>{c.nome}</strong>
                      <span className="pequeno suave"> · {c.cpf ? formatarCpf(c.cpf) : formatarWhatsapp(c.whatsapp)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ))}

        {modo === 'novo' &&
          (clienteCriadoId ? (
            <p className="sucesso">
              Cliente {novoCliente.nome} já foi cadastrado. <Link to={`/clientes/${clienteCriadoId}`}>Ver cadastro</Link>
            </p>
          ) : (
            <FormCliente dados={novoCliente} aoMudar={setNovoCliente} />
          ))}

        <h2>Empréstimo</h2>
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
          <input type="date" required value={vencimento} onChange={(ev) => setVencimento(ev.target.value)} />
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
