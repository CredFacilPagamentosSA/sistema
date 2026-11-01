import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { supabase } from '../lib/supabase';
import { mensagemDeErro } from '../lib/erros';
import { NOME_EMPRESA } from '../marca';

export function Entrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setEnviando(false);
    if (error) setErro(mensagemDeErro(error));
  }

  return (
    <main className="centro">
      <form className="cartao" onSubmit={entrar}>
        <h1 className="logo-caixa">
          <img src="/marca/logo-horizontal.png" alt={NOME_EMPRESA} width="900" height="241" />
        </h1>
        <p className="suave">Entre com seu e-mail e senha.</p>
        <label>
          E-mail
          <input type="email" autoComplete="username" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Senha
          <input type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="botao" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        <Link to="/esqueci-senha" className="link-centro">Esqueci minha senha</Link>
        <Link to="/privacidade" className="link-centro pequeno">Política de privacidade</Link>
      </form>
    </main>
  );
}
