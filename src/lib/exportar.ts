// Gera as cópias em Excel e PDF no próprio celular/computador (nada passa por outro servidor).
// As bibliotecas só são carregadas quando a pessoa clica em exportar.
import { supabase } from './supabase';
import { formatarReais } from './dinheiro';
import { formatarData, formatarDataHora, hojeSP } from './datas';
import { enderecoEmUmaLinha, formatarCpf, type Cliente } from './clientes';
import { formatarWhatsapp, nomesTipo, textoSituacao, type Emprestimo, type Lancamento } from './emprestimos';
import { NOME_EMPRESA } from '../marca';

type Usuario = { nome: string; email: string; perfil: string; ativo: boolean; criado_em: string };
type Exportacao = {
  gerado_em: string;
  clientes: Cliente[];
  emprestimos: Emprestimo[];
  lancamentos: (Lancamento & { cliente_nome: string })[];
  usuarios: Usuario[];
};

async function buscarTudo(): Promise<Exportacao> {
  const { data, error } = await supabase.rpc('exportar_dados');
  if (error) throw error;
  return data as Exportacao;
}

function nomeArquivo(extensao: string) {
  const empresa = NOME_EMPRESA.normalize('NFD').replace(/[^\w]/g, '');
  return `${empresa}-dados-${hojeSP()}.${extensao}`;
}

// Tabelas com os mesmos títulos no Excel e no PDF (valores em reais, não em centavos)
function montarTabelas(d: Exportacao) {
  return [
    {
      nome: 'Clientes',
      colunas: ['Nome', 'CPF', 'WhatsApp', 'Nascimento', 'E-mail', 'Endereço', 'Observações', 'Cliente desde'],
      larguras: [28, 16, 18, 12, 28, 60, 40, 18],
      linhas: d.clientes.map((c) => [
        c.nome,
        c.cpf ? formatarCpf(c.cpf) : '',
        formatarWhatsapp(c.whatsapp),
        c.data_nascimento ? formatarData(c.data_nascimento) : '',
        c.email ?? '',
        enderecoEmUmaLinha(c),
        c.observacoes ?? '',
        formatarDataHora(c.criado_em),
      ]),
    },
    {
      nome: 'Empréstimos',
      colunas: ['Cliente', 'Situação', 'Emprestado', 'Dívida atual', 'Juros do ciclo', 'Para quitar', 'Vencimento', 'Renovações', 'Criado em'],
      larguras: [28, 20, 14, 14, 14, 14, 12, 11, 18],
      linhas: d.emprestimos.map((e) => [
        e.cliente_nome,
        textoSituacao(e),
        formatarReais(e.valor_emprestado),
        formatarReais(e.valor_divida),
        formatarReais(e.juros_ciclo),
        e.estado === 'aberto' ? formatarReais(e.total_para_quitar) : '',
        e.estado === 'aberto' ? formatarData(e.vencimento) : '',
        String(e.renovacoes),
        formatarDataHora(e.criado_em),
      ]),
    },
    {
      nome: 'Lançamentos',
      colunas: ['Data', 'Cliente', 'Tipo', 'Recebido', 'Juros', 'Abatido', 'Multa', 'Descrição', 'Quem fez', 'Desfeito?'],
      larguras: [18, 28, 26, 13, 13, 13, 11, 40, 28, 10],
      linhas: d.lancamentos.map((l) => [
        formatarDataHora(l.criado_em),
        l.cliente_nome,
        nomesTipo[l.tipo],
        formatarReais(l.valor_recebido),
        formatarReais(l.juros_recebido),
        formatarReais(l.abatimento),
        formatarReais(l.multa),
        l.descricao,
        l.usuario_nome || l.usuario_email || '',
        l.desfeito ? 'Sim' : '',
      ]),
    },
    {
      nome: 'Usuários',
      colunas: ['Nome', 'E-mail', 'Perfil', 'Ativo', 'Desde'],
      larguras: [28, 32, 14, 8, 18],
      linhas: d.usuarios.map((u) => [u.nome, u.email, u.perfil === 'admin' ? 'Administrador' : 'Atendente', u.ativo ? 'Sim' : 'Não', formatarDataHora(u.criado_em)]),
    },
  ];
}

export async function exportarExcel() {
  const [{ default: writeXlsxFile, getSheetData }, dados] = await Promise.all([import('write-excel-file/browser'), buscarTudo()]);
  const planilhas = montarTabelas(dados).map((t) => {
    const colunas = t.colunas.map((titulo, i) => ({
      header: { value: titulo, fontWeight: 'bold' as const },
      cell: (linha: string[]) => ({ value: linha[i] }),
      width: t.larguras[i],
    }));
    return { data: getSheetData(t.linhas, colunas), sheet: t.nome, columns: colunas, stickyRowsCount: 1 };
  });
  await writeXlsxFile(planilhas).toFile(nomeArquivo('xlsx'));
  await supabase.rpc('registrar_exportacao', { p_formato: 'Excel' });
}

export async function exportarPdf() {
  const [{ jsPDF }, { default: autoTable }, dados] = await Promise.all([import('jspdf'), import('jspdf-autotable'), buscarTudo()]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(16);
  doc.text(`${NOME_EMPRESA} – cópia completa dos dados`, 40, 40);
  doc.setFontSize(10);
  doc.text(`Gerado em ${formatarDataHora(dados.gerado_em)}. Valores em reais.`, 40, 58);

  let y = 80;
  for (const t of montarTabelas(dados)) {
    doc.setFontSize(13);
    doc.text(`${t.nome} (${t.linhas.length})`, 40, y);
    autoTable(doc, {
      head: [t.colunas],
      body: t.linhas.length ? t.linhas : [[`Nenhum registro em ${t.nome.toLowerCase()}.`, ...t.colunas.slice(1).map(() => '')]],
      startY: y + 8,
      margin: { left: 40, right: 40 },
      styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [15, 81, 50] },
    });
    y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? y) + 30;
    if (y > 500) {
      doc.addPage();
      y = 40;
    }
  }
  doc.save(nomeArquivo('pdf'));
  await supabase.rpc('registrar_exportacao', { p_formato: 'PDF' });
}
