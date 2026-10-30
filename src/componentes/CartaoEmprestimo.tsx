import { Link } from 'react-router';
import { formatarReais } from '../lib/dinheiro';
import { formatarData } from '../lib/datas';
import { textoSituacao, type Emprestimo } from '../lib/emprestimos';

export function EtiquetaSituacao({ e }: { e: Pick<Emprestimo, 'situacao' | 'dias_para_vencer'> }) {
  return <span className={`situacao situacao-${e.situacao}`}>{textoSituacao(e)}</span>;
}

export function CartaoEmprestimo({ e }: { e: Emprestimo }) {
  const aberto = e.estado === 'aberto';
  return (
    <li>
      <Link to={`/emprestimos/${e.id}`} className="cartao-emprestimo">
        <div className="linha">
          <strong>{e.cliente_nome}</strong>
          <span className="valor">{formatarReais(aberto ? e.total_para_quitar : e.valor_emprestado)}</span>
        </div>
        <div className="linha pequeno">
          <EtiquetaSituacao e={e} />
          {aberto && <span className="suave">Vence {formatarData(e.vencimento)}</span>}
        </div>
        {aberto && (
          <div className="linha pequeno suave">
            <span>Dívida {formatarReais(e.valor_divida)} + juros {formatarReais(e.juros_ciclo)}</span>
          </div>
        )}
        {e.alerta_risco && (
          <div className="risco pequeno">⚠ {e.renovacoes_so_juros_seguidas} renovações seguidas só com juros</div>
        )}
      </Link>
    </li>
  );
}
