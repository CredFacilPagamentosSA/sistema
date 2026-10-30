import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth, type Perfil } from '../lib/auth';
import { mensagemDeErro } from '../lib/erros';
import { NOME_EMPRESA } from '../marca';

async function chamarFuncaoUsuarios(corpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('usuarios', { body: corpo });
  if (error) {
    // A função devolve a mensagem em "erro"
    const detalhe = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detalhe?.erro ?? error.message);
  }
  if (data?.erro) throw new Error(data.erro);
}

export function Usuarios() {
  const { perfil: eu } = useAuth();
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [perfilNovo, setPerfilNovo] = useState<'atendente' | 'admin'>('atendente');

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('perfis').select('id, nome, email, perfil, ativo').order('nome');
    if (error) setErro(mensagemDeErro(error));
    else setUsuarios(data as Perfil[]);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function executar(acao: () => Promise<void>, sucesso: string) {
    setErro('');
    setAviso('');
    setOcupado(true);
    try {
      await acao();
      setAviso(sucesso);
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  function convidar(e: FormEvent) {
    e.preventDefault();
    executar(async () => {
      await chamarFuncaoUsuarios({ acao: 'convidar', nome, email, perfil: perfilNovo });
      setNome('');
      setEmail('');
      setPerfilNovo('atendente');
    }, `Convite enviado para ${email}. A pessoa recebe um e-mail para criar a senha.`);
  }

  function alternarAtivo(u: Perfil) {
    if (u.ativo && !confirm(`Remover o acesso de ${u.nome || u.email}? A pessoa não conseguirá mais entrar.`)) return;
    executar(
      () => chamarFuncaoUsuarios({ acao: 'definir_ativo', usuario: u.id, ativo: !u.ativo }),
      u.ativo ? 'Acesso removido.' : 'Acesso reativado.',
    );
  }

  function alternarPerfil(u: Perfil) {
    const novo = u.perfil === 'admin' ? 'atendente' : 'admin';
    executar(async () => {
      const { error } = await supabase.rpc('definir_perfil', { p_usuario: u.id, p_perfil: novo });
      if (error) throw error;
    }, 'Perfil alterado.');
  }

  const adminsAtivos = usuarios.filter((u) => u.ativo && u.perfil === 'admin').length;

  return (
    <section>
      <h1>Usuários</h1>

      {usuarios.length > 0 && adminsAtivos < 2 && (
        <p className="alerta">
          <strong>Atenção:</strong> só existe {adminsAtivos} administrador. Cadastre pelo menos mais um (por exemplo,
          um sócio) para a {NOME_EMPRESA} nunca perder o acesso ao sistema.
        </p>
      )}

      {erro && <p className="erro" role="alert">{erro}</p>}
      {aviso && <p className="sucesso" role="status">{aviso}</p>}

      <ul className="lista">
        {usuarios.map((u) => (
          <li key={u.id} className={u.ativo ? '' : 'inativo'}>
            <div>
              <strong>{u.nome || '(sem nome)'}</strong>
              {u.id === eu?.id && <span className="etiqueta">Você</span>}
              <div className="suave pequeno">{u.email}</div>
              <div className="pequeno">
                {u.perfil === 'admin' ? 'Administrador' : 'Atendente'} · {u.ativo ? 'Ativo' : 'Sem acesso'}
              </div>
            </div>
            <div className="acoes">
              {u.ativo && (
                <button className="botao secundario" disabled={ocupado} onClick={() => alternarPerfil(u)}>
                  {u.perfil === 'admin' ? 'Tornar atendente' : 'Tornar administrador'}
                </button>
              )}
              <button className={`botao ${u.ativo ? 'perigo' : 'secundario'}`} disabled={ocupado} onClick={() => alternarAtivo(u)}>
                {u.ativo ? 'Remover acesso' : 'Reativar'}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form className="cartao" onSubmit={convidar}>
        <h2>Cadastrar novo acesso</h2>
        <label>
          Nome
          <input required value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label>
          E-mail
          <input type="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Perfil
          <select value={perfilNovo} onChange={(e) => setPerfilNovo(e.target.value as 'atendente' | 'admin')}>
            <option value="atendente">Atendente</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        <p className="suave pequeno">
          Atendente registra empréstimos e recebimentos. Administrador também gerencia usuários, backup e exportação.
        </p>
        <button className="botao" disabled={ocupado}>Enviar convite</button>
      </form>
    </section>
  );
}
