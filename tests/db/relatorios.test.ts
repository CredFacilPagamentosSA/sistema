// Testes do relatório por período
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { como, comoSistema, criarUsuario, novoBanco, um } from './banco';

let db: PGlite;
let admin: string;
let atendente: string;

type Relatorio = {
  agrupamento: 'dia' | 'mes';
  totais: Record<string, number>;
  serie: { periodo: string; juros: number; abatimento: number; multa: number; emprestado: number; novos: number }[];
};

async function relatorio(inicio: string, fim: string): Promise<Relatorio> {
  await como(db, admin);
  return (await um<{ r: Relatorio }>(db, `select public.relatorio($1, $2) as r`, [inicio, fim])).r;
}

// Cria um empréstimo com data de criação e recebimentos em datas escolhidas (como se fosse no passado)
async function emprestimoNoPassado(criadoEm: string, valor: number, recebimentos: { em: string; tipo: string; juros: number; abat?: number; multa?: number }[]) {
  await como(db, admin);
  const { id } = await um<{ id: string }>(db, `select public.criar_emprestimo('Hist', '11912345678', $1, 1000, '2030-01-01') as id`, [valor]);
  await comoSistema(db);
  await db.query(`update public.emprestimos set criado_em = $2 where id = $1`, [id, criadoEm]);
  const ids: number[] = [];
  for (const r of recebimentos) {
    const abat = r.abat ?? 0;
    const multa = r.multa ?? 0;
    const { id: lid } = await um<{ id: number }>(
      db,
      `insert into public.lancamentos (emprestimo_id, tipo, valor_recebido, juros_recebido, abatimento, multa, criado_em, estado_anterior)
       values ($1, $2::public.tipo_lancamento, $3, $4, $5, $6, $7, '{}'::jsonb) returning id`,
      [id, r.tipo, r.juros + abat + multa, r.juros, abat, multa, r.em],
    );
    ids.push(lid);
  }
  return { id, ids };
}

beforeAll(async () => {
  db = await novoBanco();
  admin = await criarUsuario(db, 'dono@credfacil.test');
  atendente = await criarUsuario(db, 'atendente@credfacil.test');

  // Janeiro/2026: empréstimo de R$ 1.000; juros de R$ 100 em 10/jan e R$ 100 + multa R$ 20 em 10/fev
  await emprestimoNoPassado('2026-01-05 12:00:00-03', 100000, [
    { em: '2026-01-10 12:00:00-03', tipo: 'juros', juros: 10000 },
    { em: '2026-02-10 12:00:00-03', tipo: 'juros', juros: 10000, multa: 2000 },
  ]);
  // Fevereiro/2026: empréstimo de R$ 500, parcial em 20/fev (juros 50 + abate 200) e quitação em 20/mar (juros 30 + 300)
  await emprestimoNoPassado('2026-02-01 09:00:00-03', 50000, [
    { em: '2026-02-20 12:00:00-03', tipo: 'parcial', juros: 5000, abat: 20000 },
    { em: '2026-03-20 12:00:00-03', tipo: 'quitacao', juros: 3000, abat: 30000 },
  ]);
});

describe('Relatório por período', () => {
  it('soma faturamento, capital devolvido e multas no período', async () => {
    const r = await relatorio('2026-01-01', '2026-03-31');
    expect(r.agrupamento).toBe('mes');
    expect(r.totais.juros).toBe(10000 + 10000 + 5000 + 3000);
    expect(r.totais.multa).toBe(2000);
    expect(r.totais.abatimento).toBe(50000);
    expect(r.totais.recebido).toBe(28000 + 2000 + 50000);
    expect(r.totais.emprestado).toBe(150000);
    expect(r.totais.novos).toBe(2);
    expect(r.totais.quitados).toBe(1);
  });

  it('separa por mês, incluindo meses sem movimento', async () => {
    const r = await relatorio('2025-12-01', '2026-03-31');
    expect(r.serie.map((s) => s.periodo)).toEqual(['2025-12-01', '2026-01-01', '2026-02-01', '2026-03-01']);
    const [dez, jan, fev, mar] = r.serie.map((s) => ({ ...s, juros: Number(s.juros), emprestado: Number(s.emprestado) }));
    expect(dez.juros).toBe(0);
    expect(jan).toMatchObject({ juros: 10000, emprestado: 100000 });
    expect(fev).toMatchObject({ juros: 15000, emprestado: 50000 });
    expect(Number(fev.multa)).toBe(2000);
    expect(Number(fev.abatimento)).toBe(20000);
    expect(mar.juros).toBe(3000);
  });

  it('períodos curtos são agrupados por dia', async () => {
    const r = await relatorio('2026-02-01', '2026-02-28');
    expect(r.agrupamento).toBe('dia');
    expect(r.serie).toHaveLength(28);
    expect(Number(r.serie.find((s) => s.periodo === '2026-02-10')!.multa)).toBe(2000);
  });

  it('respeita o horário de Brasília na virada do mês', async () => {
    // 31/mar 23:30 em Brasília = 01/abr 02:30 UTC: deve contar em março
    await emprestimoNoPassado('2026-03-01 10:00:00-03', 10000, [{ em: '2026-04-01 02:30:00+00', tipo: 'juros', juros: 777 }]);
    const marco = await relatorio('2026-03-01', '2026-03-31');
    const abril = await relatorio('2026-04-01', '2026-04-30');
    expect(Number(marco.totais.juros)).toBe(3000 + 777);
    expect(Number(abril.totais.juros)).toBe(0);
  });

  it('recebimento desfeito não conta', async () => {
    const { id } = await emprestimoNoPassado('2026-05-02 10:00:00-03', 10000, []);
    await como(db, admin);
    await db.query(`select public.registrar_recebimento($1, 'juros', '2030-02-01', 1000)`, [id]);
    const hoje = (await um<{ d: string }>(db, `select public.hoje_sp()::text as d`)).d;
    const antes = Number((await relatorio(hoje, hoje)).totais.recebido);
    await como(db, admin);
    await db.query(`select public.desfazer_ultimo($1)`, [id]);
    const depois = Number((await relatorio(hoje, hoje)).totais.recebido);
    expect(antes - depois).toBe(1000);
  });

  it('atendente não acessa relatórios', async () => {
    await como(db, atendente);
    await expect(db.query(`select public.relatorio('2026-01-01', '2026-12-31')`)).rejects.toThrow(/somente administradores/);
  });

  it('recusa período invertido', async () => {
    await expect(relatorio('2026-03-01', '2026-01-01')).rejects.toThrow(/Período inválido/);
  });
});
