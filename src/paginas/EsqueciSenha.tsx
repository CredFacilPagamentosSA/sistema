import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { supabase } from '../lib/supabase';
import { mensagemDeErro } from '../lib/erros';

export function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/definir-senha`,
    });
    setEnviando(false);
    if (error) setErro(mensagemDeErro(error));
    else setEnviado(true);
  }

  return (
    <main className="centro">
      <form className="cartao" onSubmit={enviar}>
        <h1>Recuperar senha</h1>
        {enviado ? (
          <p>
            Se este e-mail estiver cadastrado, você vai receber um link para criar uma nova senha. Confira também a
            caixa de spam.
          </p>
        ) : (
          <>
            <p className="suave">Informe seu e-mail. Enviaremos um link para você criar uma nova senha.</p>
            <label>
              E-mail
              <input type="email" autoComplete="username" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {erro && <p className="erro" role="alert">{erro}</p>}
            <button className="botao" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar link'}</button>
          </>
        )}
        <Link to="/entrar" className="link-centro">Voltar para o login</Link>
      </form>
    </main>
  );
}
