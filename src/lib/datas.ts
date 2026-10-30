// Datas no fuso de Brasília. Vencimentos são guardados como "AAAA-MM-DD".
const FUSO = 'America/Sao_Paulo';

export function hojeSP(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

function partes(iso: string): [number, number, number] {
  const [a, m, d] = iso.split('-').map(Number);
  return [a, m, d];
}

export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = partes(iso);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

// Mesmo dia nos meses seguintes; se o dia não existir (31/02), usa o último dia do mês
export function somarMeses(iso: string, meses: number): string {
  const [a, m, d] = partes(iso);
  const ultimoDia = new Date(Date.UTC(a, m - 1 + meses + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m - 1 + meses, Math.min(d, ultimoDia))).toISOString().slice(0, 10);
}

export function diasEntre(deIso: string, ateIso: string): number {
  const [a1, m1, d1] = partes(deIso);
  const [a2, m2, d2] = partes(ateIso);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

export function formatarData(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function formatarDataHora(momento: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(momento));
}
