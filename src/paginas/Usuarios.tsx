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

// Senha provisória fácil de ditar: sem letras que se confundem (I/l, O/0), ex.: Kq7m-Pt4x
export function gerarSenhaProvisoria(): string {
  const maiusculas = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const minusculas = 'abcdefghjkmnpqrstuvwxyz';
  const numeros = '23456789';
  const sorteio = new Uint32Array(8);
  crypto.getRandomValues(sorteio);
  const de = (lista: string, i: number) => lista[sorteio[i] % lista.length];
  return `${de(maiusculas, 0)}${de(minusculas, 1)}${de(numeros, 2)}${de(minusculas, 3)}-${de(maiusculas, 4)}${de(minusculas, 5)}${de(numeros, 6)}${de(minusculas, 7)}`;
}

type Credencial = { nome: string; email: string; senha: string };

export function Usuarios() {
  const { perfil: eu } = useAuth();
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [credencial, setCredencial] = useState<Credencial | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [perfilNovo, setPerfilNovo] = useState<'atendente' | 'admin'>('atendente');
  const [senhaNova, setSenhaNova] = useState(gerarSenhaProvisoria);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('perfis').select('id, nome, email, perfil, ativo, precisa_trocar_senha').order('nome');
    if (error) setErro(mensagemDeErro(error));
    else setUsuarios(data as Perfil[]);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function executar(acao: () => Promise<void>, sucesso: string) {
    setErro('');
    setAviso('');
    setCredencial(null);
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

  function criar(e: FormEvent) {
    e.preventDefault();
    const dados = { nome: nome.trim(), email: email.trim().toLowerCase(), senha: senhaNova };
    executar(async () => {
      await chamarFuncaoUsuarios({ acao: 'criar', ...dados, perfil: perfilNovo });
      setCredencial(dados);
      setNome('');
      setEmail('');
      setPerfilNovo('atendente');
      setSenhaNova(gerarSenhaProvisoria());
    }, `Acesso criado para ${dados.nome}.`);
  }

  function redefinirSenha(u: Perfil) {
    const senha = gerarSenhaProvisoria();
    if (!confirm(`Criar uma nova senha provisória para ${u.nome || u.email}? A senha atual deixa de funcionar.`)) return;
    executar(async () => {
      await chamarFuncaoUsuarios({ acao: 'redefinir_senha', usuario: u.id, senha });
      setCredencial({ nome: u.nome, email: u.email, senha });
    }, 'Nova senha provisória criada.');
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
      {credencial && (
        <div className="cartao credencial">
          <strong>Passe estes dados para {credencial.nome || 'a pessoa'} (pessoalmente ou por mensagem):</strong>
          <div>Endereço: <code>{window.location.origin}</code></div>
          <div>E-mail: <code>{credencial.email}</code></div>
          <div>Senha provisória: <code className="senha">{credencial.senha}</code></div>
          <p className="suave pequeno">
            No primeiro acesso, o app obriga a pessoa a criar a própria senha. Esta senha provisória não aparece de novo
            depois que você sair desta tela.
          </p>
        </div>
      )}

      <ul className="lista">
        {usuarios.map((u) => (
          <li key={u.id} className={u.ativo ? '' : 'inativo'}>
            <div>
              <strong>{u.nome || '(sem nome)'}</strong>
              {u.id === eu?.id && <span className="etiqueta">Você</span>}
              <div className="suave pequeno">{u.email}</div>
              <div className="pequeno">
                {u.perfil === 'admin' ? 'Administrador' : 'Atendente'} · {u.ativo ? 'Ativo' : 'Sem acesso'}
                {u.ativo && u.precisa_trocar_senha && ' · aguardando primeiro acesso'}
              </div>
            </div>
            <div className="acoes">
              {u.ativo && (
                <button className="botao secundario" disabled={ocupado} onClick={() => alternarPerfil(u)}>
                  {u.perfil === 'admin' ? 'Tornar atendente' : 'Tornar administrador'}
                </button>
              )}
              {u.ativo && u.id !== eu?.id && (
                <button className="botao secundario" disabled={ocupado} onClick={() => redefinirSenha(u)}>
                  Nova senha provisória
                </button>
              )}
              <button className={`botao ${u.ativo ? 'perigo' : 'secundario'}`} disabled={ocupado} onClick={() => alternarAtivo(u)}>
                {u.ativo ? 'Remover acesso' : 'Reativar'}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form className="cartao" onSubmit={criar}>
        <h2>Cadastrar novo acesso</h2>
        <label>
          Nome
          <input required value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label>
          E-mail (será o login da pessoa)
          <input type="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Perfil
          <select value={perfilNovo} onChange={(e) => setPerfilNovo(e.target.value as 'atendente' | 'admin')}>
            <option value="atendente">Atendente</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        <div className="campo">
          <span>Senha provisória</span>
          <div className="linha">
            <code className="senha">{senhaNova}</code>
            <button type="button" className="link" onClick={() => setSenhaNova(gerarSenhaProvisoria())}>Gerar outra</button>
          </div>
        </div>
        <p className="suave pequeno">
          Atendente registra empréstimos e recebimentos. Administrador também cancela, gerencia usuários, backup e
          relatórios.
        </p>
        <button className="botao" disabled={ocupado}>{ocupado ? 'Criando…' : 'Criar acesso'}</button>
      </form>
    </section>
  );
}
