import { Link } from 'react-router';

export function Privacidade() {
  return (
    <section className="texto">
      <h1>Política de privacidade</h1>
      <p className="suave">CredFacil – sistema interno de controle de empréstimos</p>

      <h2>Quais dados guardamos</h2>
      <p>
        De cada cliente, guardamos apenas o <strong>nome</strong> e o <strong>WhatsApp</strong>, além dos valores,
        datas e pagamentos dos empréstimos. Dos usuários do sistema, guardamos nome, e-mail e o registro das ações
        que cada um fez.
      </p>

      <h2>Para que usamos</h2>
      <p>
        Somente para controlar os empréstimos, os vencimentos e os recebimentos, e para entrar em contato com o
        cliente sobre o empréstimo dele. Não vendemos nem compartilhamos esses dados para outras finalidades.
      </p>

      <h2>Quem tem acesso</h2>
      <p>
        Apenas funcionários da CredFacil com login e senha. Os dados ficam em servidores do Supabase, com tráfego
        protegido (HTTPS) e cópias de segurança diárias.
      </p>

      <h2>Por quanto tempo</h2>
      <p>
        Enquanto houver relação com o cliente e pelo prazo exigido por lei para registros financeiros. O histórico
        não é apagado para garantir a correção das contas.
      </p>

      <h2>Seus direitos</h2>
      <p>
        Pela Lei Geral de Proteção de Dados (LGPD), o cliente pode pedir para saber quais dados temos sobre ele e
        pedir correção. Para isso, fale com a CredFacil pelo mesmo WhatsApp usado no atendimento.
      </p>

      <p><Link to="/">Voltar</Link></p>
    </section>
  );
}
