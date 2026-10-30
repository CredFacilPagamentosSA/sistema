// Cadastro novo (/clientes/novo) ou edição (/clientes/:id/editar)
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { mensagemDeErro } from '../lib/erros';
import { useCarregar } from '../lib/useCarregar';
import { clienteVazio, dadosDoCliente, type DadosCliente } from '../lib/clientes';
import { FormCliente, validarCliente } from '../componentes/FormCliente';
import { buscarCliente } from './FichaCliente';

export function NovoCliente() {
  return <Formulario id={null} inicial={clienteVazio} />;
}

export function EditarCliente() {
  const { id = '' } = useParams();
  const { dados, erro, carregando } = useCarregar(() => buscarCliente(id), [id]);
  if (carregando) return <p className="suave">Carregando…</p>;
  if (erro || !dados) return <p className="erro">{erro || 'Cliente não encontrado.'}</p>;
  return <Formulario id={id} inicial={dadosDoCliente(dados.cliente)} />;
}

function Formulario({ id, inicial }: { id: string | null; inicial: DadosCliente }) {
  const navegar = useNavigate();
  const [dados, setDados] = useState(inicial);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const problema = validarCliente(dados);
    if (problema) return setErro(problema);
    setErro('');
    setEnviando(true);
    const { data, error } = await supabase.rpc('salvar_cliente', { p_cliente: id, p_dados: dados });
    if (error) {
      setEnviando(false);
      return setErro(mensagemDeErro(error));
    }
    navegar(`/clientes/${data}`, {
      replace: true,
      state: { aviso: id ? 'Cadastro atualizado. Os dados anteriores ficaram no histórico.' : 'Cliente cadastrado.' },
    });
  }

  return (
    <section>
      <Link to={id ? `/clientes/${id}` : '/clientes'} className="voltar">‹ {id ? inicial.nome : 'Clientes'}</Link>
      <h1>{id ? 'Editar cadastro' : 'Novo cliente'}</h1>
      <form className="cartao" onSubmit={salvar} noValidate>
        <FormCliente dados={dados} aoMudar={setDados} />
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="botao" disabled={enviando}>{enviando ? 'Salvando…' : id ? 'Salvar alterações' : 'Cadastrar cliente'}</button>
      </form>
    </section>
  );
}
