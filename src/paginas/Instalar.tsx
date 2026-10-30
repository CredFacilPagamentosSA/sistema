import { NOME_EMPRESA } from '../marca';

export function Instalar() {
  return (
    <section className="texto">
      <h1>Instalar no iPhone</h1>
      <ol className="passos">
        <li>Abra este endereço no <strong>Safari</strong> (não funciona em outros navegadores do iPhone).</li>
        <li>Toque no botão <strong>Compartilhar</strong> (o quadrado com uma seta para cima, na barra de baixo).</li>
        <li>Role as opções e toque em <strong>Adicionar à Tela de Início</strong>.</li>
        <li>Confirme o nome "{NOME_EMPRESA}" e toque em <strong>Adicionar</strong>.</li>
      </ol>
      <p>
        Pronto: o ícone aparece na tela do iPhone e o sistema abre em tela cheia, como um aplicativo.
      </p>
      <p className="suave">
        Na primeira vez que abrir pelo ícone, será preciso entrar com e-mail e senha de novo: o iPhone guarda o login
        do ícone separado do Safari.
      </p>
    </section>
  );
}
