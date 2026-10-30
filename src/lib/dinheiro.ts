// Dinheiro sempre em CENTAVOS (números inteiros): R$ 1.234,56 = 123456.
// Assim nunca há erro de arredondamento nas contas.

const formatador = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatadorCampo = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatarReais(centavos: number): string {
  return formatador.format(centavos / 100);
}

// Valor para preencher um campo de digitação, sem o "R$": 1.234,56
export function formatarParaCampo(centavos: number): string {
  return formatadorCampo.format(centavos / 100);
}

// Lê o que a pessoa digitou ("1.234,56", "1234,5", "1234", "R$ 50") e devolve centavos.
// Devolve null se não for um valor válido.
export function lerReais(texto: string): number | null {
  const t = texto.replace(/R\$|\s/g, '');
  if (!t || !/^[0-9.,]+$/.test(t)) return null;

  let inteiro: string;
  let fracao = '';
  if (t.includes(',')) {
    const partes = t.split(',');
    if (partes.length !== 2) return null;
    inteiro = partes[0].replace(/\./g, '');
    fracao = partes[1];
  } else {
    const partes = t.split('.');
    if (partes.length === 2 && partes[1].length <= 2) {
      // "1234.5" ou "10.50": ponto como vírgula
      inteiro = partes[0];
      fracao = partes[1];
    } else {
      // "1.234" ou "1.234.567": pontos de milhar
      inteiro = t.replace(/\./g, '');
    }
  }
  if (fracao.length > 2 || !/^\d*$/.test(inteiro) || !/^\d*$/.test(fracao)) return null;
  if (inteiro === '' && fracao === '') return null;
  return Number(inteiro || '0') * 100 + Number(fracao.padEnd(2, '0'));
}

// Lê uma porcentagem ("10", "10,5", "2.75") e devolve em centésimos de ponto: 10,5% = 1050.
export function lerPercentual(texto: string): number | null {
  const t = texto.replace(/%|\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [inteiro, fracao = ''] = t.split('.');
  return Number(inteiro) * 100 + Number(fracao.padEnd(2, '0'));
}

// Juros em reais a partir de uma porcentagem, arredondando para o centavo mais próximo.
// Ex.: 10% de R$ 333,33 = R$ 33,33 (33.333 centavos arredondam para 3.333)
export function jurosPorPercentual(baseCentavos: number, percentualCentesimos: number): number {
  return Math.floor((baseCentavos * percentualCentesimos + 5000) / 10000);
}

export type ModoJuros = 'reais' | 'percentual';

// Converte o campo de juros (em R$ ou %) para centavos
export function calcularJuros(modo: ModoJuros, texto: string, baseCentavos: number): number | null {
  if (modo === 'reais') return lerReais(texto);
  const p = lerPercentual(texto);
  return p === null ? null : jurosPorPercentual(baseCentavos, p);
}
