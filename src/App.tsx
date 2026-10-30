import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './lib/auth';
import { supabaseConfigurado } from './lib/supabase';
import { NOME_EMPRESA } from './marca';
import { Layout } from './componentes/Layout';
import { Entrar } from './paginas/Entrar';
import { EsqueciSenha } from './paginas/EsqueciSenha';
import { DefinirSenha } from './paginas/DefinirSenha';
import { Usuarios } from './paginas/Usuarios';
import { Painel } from './paginas/Painel';
import { Emprestimos } from './paginas/Emprestimos';
import { NovoEmprestimo } from './paginas/NovoEmprestimo';
import { DetalheEmprestimo } from './paginas/DetalheEmprestimo';
import { Receber } from './paginas/Receber';
import { EditarEmprestimo } from './paginas/EditarEmprestimo';
import { Cobrar } from './paginas/Cobrar';
import { Mais } from './paginas/Mais';
import { Instalar } from './paginas/Instalar';
import { Relatorios } from './paginas/Relatorios';
import { Privacidade } from './paginas/Privacidade';

export function App() {
  const { carregando, sessao, perfil, precisaDefinirSenha } = useAuth();

  if (!supabaseConfigurado) {
    return (
      <main className="centro">
        <div className="cartao">
          <h1>{NOME_EMPRESA}</h1>
          <p>O app ainda não foi ligado ao banco de dados. Falta cadastrar as chaves do Supabase.</p>
        </div>
      </main>
    );
  }

  if (carregando) {
    return <main className="centro">Carregando…</main>;
  }

  // Sem login: só as telas públicas
  if (!sessao) {
    return (
      <Routes>
        <Route path="/entrar" element={<Entrar />} />
        <Route path="/esqueci-senha" element={<EsqueciSenha />} />
        <Route path="/privacidade" element={<main className="centro"><Privacidade /></main>} />
        <Route path="/instalar" element={<main className="centro"><Instalar /></main>} />
        <Route path="*" element={<Navigate to="/entrar" replace />} />
      </Routes>
    );
  }

  if (precisaDefinirSenha) {
    return <DefinirSenha />;
  }

  if (!perfil || !perfil.ativo) {
    return <AcessoDesativado />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Painel />} />
        <Route path="/emprestimos" element={<Emprestimos />} />
        <Route path="/emprestimos/:id" element={<DetalheEmprestimo />} />
        <Route path="/emprestimos/:id/receber" element={<Receber />} />
        <Route path="/emprestimos/:id/editar" element={<EditarEmprestimo />} />
        <Route path="/emprestimos/:id/cobrar" element={<Cobrar />} />
        <Route path="/novo" element={<NovoEmprestimo />} />
        <Route path="/mais" element={<Mais />} />
        <Route path="/usuarios" element={<SoAdmin><Usuarios /></SoAdmin>} />
        <Route path="/relatorios" element={<SoAdmin><Relatorios /></SoAdmin>} />
        <Route path="/privacidade" element={<Privacidade />} />
        <Route path="/instalar" element={<Instalar />} />
        <Route path="/definir-senha" element={<DefinirSenha />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function SoAdmin({ children }: { children: ReactNode }) {
  const { ehAdmin } = useAuth();
  return ehAdmin ? children : <Navigate to="/" replace />;
}

function AcessoDesativado() {
  const { sair } = useAuth();
  return (
    <main className="centro">
      <div className="cartao">
        <h1>Acesso desativado</h1>
        <p>Este usuário não tem acesso ao sistema. Fale com um administrador da {NOME_EMPRESA}.</p>
        <button className="botao" onClick={sair}>Sair</button>
      </div>
    </main>
  );
}
