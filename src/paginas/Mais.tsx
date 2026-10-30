import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { mensagemDeErro } from '../lib/erros';

export function Mais() {
  const { perfil, ehAdmin, recarregarPerfil, sair } = useAuth();
  const [nome, setNome] = useState(perfil?.nome ?? '');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  async function salvarNome(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setAviso('');
    const { error } = await supabase.rpc('definir_meu_nome', { p_nome: nome });
    if (error) return setErro(mensagemDeErro(error));
    setAviso('Nome atualizado.');
    recarregarPerfil();
  }

  return (
    <section>
      <h1>Mais</h1>

      <form className="cartao" onSubmit={salvarNome}>
        <h2>Minha conta</h2>
        <p className="suave pequeno">{perfil?.email} · {ehAdmin ? 'Administrador' : 'Atendente'}</p>
        <label>
          Meu nome (aparece no histórico)
          <input required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        {aviso && <p className="sucesso" role="status">{aviso}</p>}
        <button className="botao">Salvar nome</button>
        <Link to="/definir-senha" className="link-centro">Trocar minha senha</Link>
      </form>

      <ul className="menu-lista">
        {ehAdmin && <li><Link to="/relatorios">Relatórios</Link></li>}
        {ehAdmin && <li><Link to="/backup">Backup e exportação</Link></li>}
        {ehAdmin && <li><Link to="/usuarios">Usuários e acessos</Link></li>}
        <li><Link to="/privacidade">Política de privacidade</Link></li>
        <li><Link to="/instalar">Instalar no iPhone</Link></li>
        <li><button className="link perigo-texto" onClick={sair}>Sair</button></li>
      </ul>
    </section>
  );
}
