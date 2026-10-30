// Provisória: o Painel completo vem na etapa 3
import { useAuth } from '../lib/auth';

export function Inicio() {
  const { perfil } = useAuth();
  return (
    <section>
      <h1>Olá, {perfil?.nome || perfil?.email}</h1>
      <p className="suave">O Painel com os números dos empréstimos chega na próxima etapa.</p>
    </section>
  );
}
