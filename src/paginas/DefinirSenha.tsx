// Usada no primeiro acesso (convite), na recuperação e para trocar a senha
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { mensagemDeErro } from '../lib/erros';

export function DefinirSenha() {
  const { senhaDefinida } = useAuth();
  const navegar = useNavigate();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.');
    if (!/[a-z]/.test(senha) || !/[A-Z]/.test(senha) || !/[0-9]/.test(senha)) {
      return setErro('A senha precisa ter pelo menos uma letra minúscula, uma MAIÚSCULA e um número.');
    }
    if (senha !== confirmacao) return setErro('As duas senhas não são iguais.');
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) return setErro(mensagemDeErro(error));
    senhaDefinida();
    navegar('/', { replace: true });
  }

  return (
    <main className="centro">
      <form className="cartao" onSubmit={salvar}>
        <h1>Criar senha</h1>
        <p className="suave">
          Use pelo menos 8 caracteres, com letra minúscula, letra MAIÚSCULA e número. Exemplo: Cafe2026Forte
        </p>
        <label>
          Nova senha
          <input type="password" autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>
        <label>
          Repita a nova senha
          <input type="password" autoComplete="new-password" required value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="botao" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar senha'}</button>
      </form>
    </main>
  );
}
