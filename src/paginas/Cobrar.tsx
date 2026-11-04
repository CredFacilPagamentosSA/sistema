import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useCarregar } from '../lib/useCarregar';
import { formatarWhatsapp, mensagemCobranca } from '../lib/emprestimos';
import { EMPRESA_NA_COBRANCA } from '../marca';
import { buscarEmprestimo } from './DetalheEmprestimo';

export function Cobrar() {
  const { id = '' } = useParams();
  const { dados, erro, carregando } = useCarregar(() => buscarEmprestimo(id), [id]);
  const [copiado, setCopiado] = useState(false);

  if (carregando) return <p className="suave">Carregando…</p>;
  if (erro || !dados) return <p className="erro">{erro || 'Empréstimo não encontrado.'}</p>;

  const e = dados.emprestimo;
  const texto = mensagemCobranca(e, EMPRESA_NA_COBRANCA);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      alert('Não foi possível copiar automaticamente. Toque e segure no texto para copiar.');
    }
  }

  return (
    <section>
      <Link to={`/emprestimos/${e.id}`} className="voltar">‹ {e.cliente_nome}</Link>
      <h1>Cobrar agora</h1>
      <p className="suave">
        Mensagem pronta para {e.cliente_nome} · {formatarWhatsapp(e.cliente_whatsapp)}
      </p>
      <pre className="mensagem">{texto}</pre>
      <div className="acoes-grandes">
        <button className="botao" onClick={copiar}>{copiado ? 'Copiado ✓' : 'Copiar mensagem'}</button>
        <a
          className="botao secundario"
          href={`https://wa.me/${e.cliente_whatsapp}?text=${encodeURIComponent(texto)}`}
          target="_blank"
          rel="noreferrer"
        >
          Abrir no WhatsApp
        </a>
      </div>
      <p className="suave pequeno">
        Nada é enviado sozinho: o WhatsApp abre com a mensagem escrita e você confere antes de enviar.
      </p>
    </section>
  );
}
