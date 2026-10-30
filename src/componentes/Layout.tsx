import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../lib/auth';

export function Layout() {
  const { perfil, ehAdmin, sair } = useAuth();
  return (
    <div className="app">
      <header className="topo">
        <strong>CredFacil</strong>
        <span className="topo-usuario">
          {perfil?.nome || perfil?.email}
          <span className="etiqueta">{ehAdmin ? 'Administrador' : 'Atendente'}</span>
        </span>
        <button className="link" onClick={sair}>Sair</button>
      </header>
      <main className="conteudo">
        <Outlet />
      </main>
      <nav className="menu">
        <NavLink to="/" end>Painel</NavLink>
        {ehAdmin && <NavLink to="/usuarios">Usuários</NavLink>}
      </nav>
    </div>
  );
}
