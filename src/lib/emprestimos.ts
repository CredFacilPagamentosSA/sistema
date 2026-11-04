import { formatarReais } from './dinheiro';
import { formatarData, formatarDataHora } from './datas';

export type Situacao = 'em_dia' | 'vence_em_breve' | 'vence_hoje' | 'atrasado' | 'quitado' | 'cancelado';
export type TipoLancamento = 'criacao' | 'juros' | 'parcial' | 'quitacao' | 'edicao' | 'desfazer' | 'cancelamento';

// Uma linha da visão v_emprestimos (valores em centavos)
export type Emprestimo = {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_whatsapp: string;
  valor_emprestado: number;
  valor_divida: number;
  juros_ciclo: number;
  vencimento: string;
  renovacoes: number;
  renovacoes_so_juros_seguidas: number;
  estado: 'aberto' | 'quitado' | 'cancelado';
  situacao: Situacao;
  dias_para_vencer: number;
  alerta_risco: boolean;
  total_para_quitar: number;
  criado_em: string;
  encerrado_em: string | null;
};

export type Lancamento = {
  id: number;
  emprestimo_id: string;
  tipo: TipoLancamento;
  valor_recebido: number;
  juros_recebido: number;
  abatimento: number;
  multa: number;
  descricao: string;
  usuario_nome: string | null;
  usuario_email: string | null;
  criado_em: string;
  desfaz_lancamento_id: number | null;
  desfeito: boolean;
};

export const nomesTipo: Record<TipoLancamento, string> = {
  criacao: 'Empréstimo criado',
  juros: 'Juros recebidos e renovado',
  parcial: 'Pagamento parcial e renovado',
  quitacao: 'Quitação',
  edicao: 'Dados editados',
  desfazer: 'Desfeito',
  cancelamento: 'Empréstimo cancelado',
};

export function textoSituacao(e: Pick<Emprestimo, 'situacao' | 'dias_para_vencer'>): string {
  switch (e.situacao) {
    case 'atrasado': {
      const dias = -e.dias_para_vencer;
      return `Atrasado há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
    }
    case 'vence_hoje':
      return 'Vence hoje';
    case 'vence_em_breve':
      return e.dias_para_vencer === 1 ? 'Vence amanhã' : `Vence em ${e.dias_para_vencer} dias`;
    case 'em_dia':
      return 'Em dia';
    case 'quitado':
      return 'Quitado';
    case 'cancelado':
      return 'Cancelado';
  }
}

// O próximo lançamento que o "Desfazer" vai desfazer (histórico em ordem do mais novo)
export function ultimoDesfazivel(historico: Lancamento[]): Lancamento | undefined {
  return [...historico].sort((a, b) => b.id - a.id).find((l) => l.tipo !== 'desfazer' && !l.desfeito);
}

export function descreverLancamento(l: Lancamento): string {
  return `"${l.descricao}" de ${formatarDataHora(l.criado_em)}`;
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

// Mensagem pronta de cobrança (Fase 1: só copiar, nada é enviado sozinho)
export function mensagemCobranca(e: Emprestimo, empresa: string | null): string {
  let quando: string;
  if (e.situacao === 'atrasado') quando = `venceu em ${formatarData(e.vencimento)}`;
  else if (e.situacao === 'vence_hoje') quando = `vence hoje (${formatarData(e.vencimento)})`;
  else quando = `vence em ${formatarData(e.vencimento)}`;

  return [
    `Olá, ${primeiroNome(e.cliente_nome)}! Tudo bem?`,
    ``,
    `Passando para lembrar que o seu empréstimo${empresa ? ` com a ${empresa}` : ''} ${quando}.`,
    ``,
    `Você pode escolher uma das opções:`,
    ``,
    `✅ Quitar tudo: ${formatarReais(e.total_para_quitar)}`,
    `(${formatarReais(e.valor_divida)} do valor em aberto + ${formatarReais(e.juros_ciclo)} de juros)`,
    ``,
    `🔄 Pagar só os juros e renovar: ${formatarReais(e.juros_ciclo)}`,
    ``,
    `Qualquer dúvida, estou à disposição.`,
  ].join('\n');
}

// WhatsApp do cliente para exibir: 5511912345678 → (11) 91234-5678
export function formatarWhatsapp(numero: string): string {
  const local = numero.startsWith('55') ? numero.slice(2) : numero;
  const ddd = local.slice(0, 2);
  const resto = local.slice(2);
  const corte = resto.length - 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

// Mesmo padrão do banco: só números, com 55 na frente
export function normalizarWhatsapp(texto: string): string | null {
  let v = texto.replace(/\D/g, '');
  if (v.length === 10 || v.length === 11) v = '55' + v;
  return /^55\d{10,11}$/.test(v) ? v : null;
}
