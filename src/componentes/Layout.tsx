import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../lib/auth';
import { NOME_EMPRESA } from '../marca';

export function Layout() {
  const { perfil, ehAdmin } = useAuth();
  return (
    <div className="app">
      <header className="topo">
        <strong>{NOME_EMPRESA}</strong>
        <span className="topo-usuario">
          {perfil?.nome || perfil?.email}
          <span className="etiqueta">{ehAdmin ? 'Administrador' : 'Atendente'}</span>
        </span>
      </header>
      <main className="conteudo">
        <Outlet />
      </main>
      <nav className="menu">
        <NavLink to="/" end>
          <span aria-hidden>▦</span>Painel
        </NavLink>
        <NavLink to="/emprestimos">
          <span aria-hidden>☰</span>Empréstimos
        </NavLink>
        <NavLink to="/novo">
          <span aria-hidden>＋</span>Novo
        </NavLink>
        <NavLink to="/mais">
          <span aria-hidden>⋯</span>Mais
        </NavLink>
      </nav>
    </div>
  );
}
