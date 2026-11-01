import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../lib/auth';
import { NOME_EMPRESA } from '../marca';
import { Icone } from './Icone';

export function Layout() {
  const { perfil, ehAdmin } = useAuth();
  return (
    <div className="app">
      <header className="topo">
        <strong className="topo-marca">
          <img src="/marca/simbolo.png" alt="" width="28" height="28" />
          {NOME_EMPRESA}
        </strong>
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
          <Icone nome="painel" />Painel
        </NavLink>
        <NavLink to="/emprestimos">
          <Icone nome="lista" />Empréstimos
        </NavLink>
        <NavLink to="/novo">
          <Icone nome="mais" />Novo
        </NavLink>
        <NavLink to="/clientes">
          <Icone nome="pessoas" />Clientes
        </NavLink>
        <NavLink to="/mais">
          <Icone nome="pontos" />Mais
        </NavLink>
      </nav>
    </div>
  );
}
