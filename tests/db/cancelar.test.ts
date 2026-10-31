// Testes de cancelar empréstimo lançado por engano e arquivar cliente
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { como, comoSistema, criarUsuario, novoBanco, um } from './banco';

let db: PGlite;
let admin: string;
let atendente: string;

async function painel() {
  await como(db, admin);
  const { p } = await um<{ p: Record<string, number> }>(db, `select public.painel() as p`);
  return { naRua: Number(p.dinheiro_na_rua), recebidoMes: Number(p.recebido_mes) };
}

async function relatorioHoje() {
  await como(db, admin);
  const { r } = await um<{ r: { totais: Record<string, number> } }>(db, `select public.relatorio(public.hoje_sp(), public.hoje_sp()) as r`);
  return { recebido: Number(r.totais.recebido), emprestado: Number(r.totais.emprestado) };
}

async function novoComRecebimento(nome: string) {
  await como(db, admin);
  const { id } = await um<{ id: string }>(db, `select public.criar_emprestimo($1, '11912345678', 100000, 10000, public.hoje_sp()) as id`, [nome]);
  await db.query(`select public.registrar_recebimento($1, 'juros', public.hoje_sp() + 30, 10000)`, [id]);
  return id;
}

beforeAll(async () => {
  db = await novoBanco();
  admin = await criarUsuario(db, 'dono@credfacil.test');
  atendente = await criarUsuario(db, 'atendente@credfacil.test');
});

describe('Cancelar empréstimo lançado por engano', () => {
  it('tira o empréstimo e os recebimentos dele do Painel e dos Relatórios', async () => {
    const antesPainel = await painel();
    const antesRel = await relatorioHoje();
    const id = await novoComRecebimento('Engano');
    expect((await painel()).naRua).toBe(antesPainel.naRua + 100000);
    expect((await painel()).recebidoMes).toBe(antesPainel.recebidoMes + 10000);

    await como(db, admin);
    await db.query(`select public.cancelar_emprestimo($1, 'Cadastrado em duplicidade')`, [id]);

    expect(await painel()).toEqual(antesPainel);
    expect(await relatorioHoje()).toEqual(antesRel);
    const e = await um<{ estado: string }>(db, `select estado::text from public.emprestimos where id = $1`, [id]);
    expect(e.estado).toBe('cancelado');
    // nada foi apagado: criação, juros e cancelamento continuam no histórico
    const { n } = await um<{ n: number }>(db, `select count(*)::int as n from public.lancamentos where emprestimo_id = $1`, [id]);
    expect(n).toBe(3);
  });

  it('exige motivo e não cancela duas vezes', async () => {
    const id = await novoComRecebimento('Sem motivo');
    await expect(db.query(`select public.cancelar_emprestimo($1, '')`, [id])).rejects.toThrow(/motivo/);
    await db.query(`select public.cancelar_emprestimo($1, 'Teste')`, [id]);
    await expect(db.query(`select public.cancelar_emprestimo($1, 'De novo')`, [id])).rejects.toThrow(/já está cancelado/);
  });

  it('desfazer o cancelamento volta tudo como era (só administrador)', async () => {
    const id = await novoComRecebimento('Volta');
    const antes = await painel();
    await como(db, admin);
    await db.query(`select public.cancelar_emprestimo($1, 'Engano')`, [id]);
    await como(db, atendente);
    await expect(db.query(`select public.desfazer_ultimo($1)`, [id])).rejects.toThrow(/somente administradores/);
    await como(db, admin);
    await db.query(`select public.desfazer_ultimo($1)`, [id]);
    expect(await painel()).toEqual(antes);
  });

  it('atendente não cancela', async () => {
    const id = await novoComRecebimento('Atendente');
    await como(db, atendente);
    await expect(db.query(`select public.cancelar_emprestimo($1, 'Quero cancelar')`, [id])).rejects.toThrow(/somente administradores/);
  });
});

describe('Arquivar cliente', () => {
  it('não arquiva quem tem empréstimo em aberto', async () => {
    const id = await novoComRecebimento('Aberto');
    await comoSistema(db);
    const { cliente_id } = await um<{ cliente_id: string }>(db, `select cliente_id from public.emprestimos where id = $1`, [id]);
    await como(db, admin);
    await expect(db.query(`select public.arquivar_cliente($1, true)`, [cliente_id])).rejects.toThrow(/em aberto/);
  });

  it('arquiva e reativa, guardando no histórico do cadastro', async () => {
    const id = await novoComRecebimento('Arquivar');
    await como(db, admin);
    await db.query(`select public.cancelar_emprestimo($1, 'Teste')`, [id]);
    await comoSistema(db);
    const { cliente_id } = await um<{ cliente_id: string }>(db, `select cliente_id from public.emprestimos where id = $1`, [id]);
    await como(db, admin);
    await db.query(`select public.arquivar_cliente($1, true)`, [cliente_id]);
    let c = await um<{ arquivado_em: string | null }>(db, `select arquivado_em from public.clientes where id = $1`, [cliente_id]);
    expect(c.arquivado_em).not.toBeNull();
    await db.query(`select public.arquivar_cliente($1, false)`, [cliente_id]);
    c = await um<{ arquivado_em: string | null }>(db, `select arquivado_em from public.clientes where id = $1`, [cliente_id]);
    expect(c.arquivado_em).toBeNull();
    const { n } = await um<{ n: number }>(db, `select count(*)::int as n from public.clientes_historico where cliente_id = $1`, [cliente_id]);
    expect(n).toBe(2);
  });

  it('atendente não arquiva', async () => {
    await comoSistema(db);
    const { id } = await um<{ id: string }>(db, `select id from public.clientes limit 1`);
    await como(db, atendente);
    await expect(db.query(`select public.arquivar_cliente($1, true)`, [id])).rejects.toThrow(/somente administradores/);
  });
});
