import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { mensagemDeErro } from '../lib/erros';
import { consultar, useCarregar } from '../lib/useCarregar';
import { formatarDataHora } from '../lib/datas';
import { exportarExcel, exportarPdf } from '../lib/exportar';

type RegistroBackup = { id: number; feito_em: string; origem: 'automatico' | 'exportacao'; sucesso: boolean; detalhe: string };

export function Backup() {
  const { dados, erro, recarregar } = useCarregar(() =>
    consultar<RegistroBackup[]>(supabase.from('backups').select('id, feito_em, origem, sucesso, detalhe').order('feito_em', { ascending: false }).limit(20)),
  );
  const [ocupado, setOcupado] = useState<'' | 'excel' | 'pdf'>('');
  const [erroAcao, setErroAcao] = useState('');

  const ultimoAutomatico = dados?.find((b) => b.origem === 'automatico' && b.sucesso);
  const horasDesde = ultimoAutomatico ? (Date.now() - new Date(ultimoAutomatico.feito_em).getTime()) / 3600000 : null;
  const atrasado = horasDesde === null || horasDesde > 48;

  async function exportar(tipo: 'excel' | 'pdf') {
    setErroAcao('');
    setOcupado(tipo);
    try {
      await (tipo === 'excel' ? exportarExcel() : exportarPdf());
      recarregar();
    } catch (e) {
      setErroAcao(mensagemDeErro(e));
    } finally {
      setOcupado('');
    }
  }

  return (
    <section>
      <h1>Backup</h1>

      <div className={`numero ${atrasado ? 'perigo' : ''}`}>
        <span>Último backup automático</span>
        <strong>{ultimoAutomatico ? formatarDataHora(ultimoAutomatico.feito_em) : 'Nenhum ainda'}</strong>
        <small className={atrasado ? 'desce' : 'suave'}>
          {ultimoAutomatico
            ? atrasado
              ? '⚠ Faz mais de 2 dias sem backup automático. Veja o guia "O que fazer se o backup falhar".'
              : 'Feito toda madrugada, criptografado, guardado no GitHub e enviado por e-mail.'
            : 'O backup automático começa a funcionar quando a rotina do GitHub for ligada.'}
        </small>
      </div>

      <h2>Baixar uma cópia agora</h2>
      <p className="suave pequeno">
        Todos os dados (clientes, empréstimos, lançamentos e usuários) vão para o seu aparelho. Estes arquivos abrem
        normalmente, sem senha: guarde em lugar seguro.
      </p>
      <div className="acoes-grandes">
        <button className="botao" disabled={!!ocupado} onClick={() => exportar('excel')}>
          {ocupado === 'excel' ? 'Gerando Excel…' : 'Baixar em Excel'}
        </button>
        <button className="botao secundario" disabled={!!ocupado} onClick={() => exportar('pdf')}>
          {ocupado === 'pdf' ? 'Gerando PDF…' : 'Baixar em PDF'}
        </button>
      </div>
      {erroAcao && <p className="erro" role="alert">{erroAcao}</p>}

      <h2>Últimos registros</h2>
      {erro && <p className="erro">{erro}</p>}
      {dados && dados.length === 0 && <p className="suave">Nenhum backup ou exportação ainda.</p>}
      <ul className="historico">
        {dados?.map((b) => (
          <li key={b.id} className={b.sucesso ? '' : 'desfeito'}>
            <strong>{b.origem === 'automatico' ? (b.sucesso ? 'Backup automático' : 'Backup automático FALHOU') : b.detalhe}</strong>
            <div className="pequeno suave">
              {formatarDataHora(b.feito_em)}
              {b.origem === 'automatico' && b.detalhe ? ` · ${b.detalhe}` : ''}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
