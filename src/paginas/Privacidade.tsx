import { Link } from 'react-router';
import { NOME_EMPRESA } from '../marca';

export function Privacidade() {
  return (
    <section className="texto">
      <h1>Política de privacidade</h1>
      <p className="suave">{NOME_EMPRESA} – sistema interno de controle de empréstimos</p>

      <h2>Quais dados guardamos</h2>
      <p>
        De cada cliente, quando informados: <strong>nome, CPF, data de nascimento, WhatsApp, e-mail, endereço e quem indicou</strong>, além de
        observações sobre o atendimento e dos valores, datas e pagamentos dos empréstimos. Dos usuários do sistema:
        nome, e-mail e o registro das ações que cada um fez.
      </p>

      <h2>Para que usamos</h2>
      <p>
        Para identificar corretamente quem recebe o empréstimo, controlar vencimentos e recebimentos, entrar em
        contato sobre o empréstimo e, se necessário, cobrar valores em atraso. A base legal é a execução do contrato
        de empréstimo e a proteção do crédito (Lei 13.709/2018 – LGPD, art. 7º, incisos V e X). Não vendemos nem
        compartilhamos esses dados para outras finalidades.
      </p>
      <p>
        Ao digitar um CEP, apenas o CEP é consultado no serviço público ViaCEP para preencher o endereço
        automaticamente.
      </p>

      <h2>Quem tem acesso</h2>
      <p>
        Apenas funcionários da {NOME_EMPRESA} com login e senha. Os dados ficam em servidores do Supabase, com tráfego
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
        pedir correção. Toda alteração no cadastro fica registrada, com data e responsável. Para isso, fale com a {NOME_EMPRESA} pelo mesmo WhatsApp usado no atendimento.
      </p>

      <p><Link to="/">Voltar</Link></p>
    </section>
  );
}
