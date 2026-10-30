// Testes de segurança: quem pode ver, gravar e (ninguém) apagar.
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { como, comoSistema, comoVisitante, criarUsuario, novoBanco, um } from './banco';

let db: PGlite;
let admin: string;
let atendente: string;
let emprestimoId: string;

beforeAll(async () => {
  db = await novoBanco();
  admin = await criarUsuario(db, 'dono@credfacil.test', 'Dono');
  atendente = await criarUsuario(db, 'atendente@credfacil.test', 'Atendente');
  await como(db, admin);
  emprestimoId = (
    await um<{ id: string }>(
      db,
      `select public.criar_emprestimo('Cliente', '11912345678', 100000, 10000, public.hoje_sp() + 30) as id`,
    )
  ).id;
});

describe('Perfis', () => {
  it('o primeiro usuário vira administrador e os seguintes, atendentes', async () => {
    await comoSistema(db);
    const r = await db.query<{ email: string; perfil: string }>(`select email, perfil::text from public.perfis order by criado_em, email`);
    const porEmail = Object.fromEntries(r.rows.map((x) => [x.email, x.perfil]));
    expect(porEmail['dono@credfacil.test']).toBe('admin');
    expect(porEmail['atendente@credfacil.test']).toBe('atendente');
  });
});

describe('Visitante sem login', () => {
  it('não vê nada e não executa nada', async () => {
    await comoVisitante(db);
    await expect(db.query(`select * from public.emprestimos`)).rejects.toThrow(/permission denied/);
    await expect(db.query(`select * from public.v_emprestimos`)).rejects.toThrow(/permission denied/);
    await expect(db.query(`select public.painel()`)).rejects.toThrow(/permission denied/);
    await expect(
      db.query(`select public.criar_emprestimo('X', '11912345678', 100, 10, current_date)`),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('Atendente', () => {
  it('vê empréstimos e registra recebimentos', async () => {
    await como(db, atendente);
    const r = await db.query(`select * from public.v_emprestimos`);
    expect(r.rows.length).toBe(1);
    await db.query(`select public.registrar_recebimento($1, 'juros', public.hoje_sp() + 60, 10000)`, [emprestimoId]);
    const l = await um<{ usuario_id: string }>(
      db,
      `select usuario_id from public.lancamentos where emprestimo_id = $1 order by id desc limit 1`,
      [emprestimoId],
    );
    expect(l.usuario_id).toBe(atendente); // fica registrado quem fez
  });

  it('não grava direto nas tabelas (precisa passar pelas regras)', async () => {
    await como(db, atendente);
    await expect(db.query(`update public.emprestimos set valor_divida = 1`)).rejects.toThrow(/permission denied/);
    await expect(
      db.query(`insert into public.lancamentos (emprestimo_id, tipo) values ($1, 'juros')`, [emprestimoId]),
    ).rejects.toThrow(/permission denied/);
  });

  it('não apaga nada', async () => {
    await como(db, atendente);
    await expect(db.query(`delete from public.emprestimos`)).rejects.toThrow(/permission denied/);
    await expect(db.query(`delete from public.lancamentos`)).rejects.toThrow(/permission denied/);
    await expect(db.query(`delete from public.clientes`)).rejects.toThrow(/permission denied/);
  });

  it('não vê backups e não gerencia usuários', async () => {
    await comoSistema(db);
    await db.query(`insert into public.backups (origem, sucesso) values ('automatico', true)`);
    await como(db, admin);
    expect((await db.query(`select * from public.backups`)).rows.length).toBe(1);
    await como(db, atendente);
    const r = await db.query(`select * from public.backups`);
    expect(r.rows.length).toBe(0);
    await expect(db.query(`select public.definir_perfil($1, 'admin')`, [atendente])).rejects.toThrow(/somente administradores/);
    await expect(db.query(`select public.definir_ativo($1, false)`, [admin])).rejects.toThrow(/somente administradores/);
  });
});

describe('Ninguém apaga histórico, nem o administrador nem o sistema', () => {
  it('administrador logado não consegue apagar', async () => {
    await como(db, admin);
    await expect(db.query(`delete from public.lancamentos`)).rejects.toThrow(/permission denied/);
  });

  it('nem com acesso total ao banco (painel do Supabase)', async () => {
    await comoSistema(db);
    await expect(db.query(`delete from public.lancamentos`)).rejects.toThrow(/nunca são apagados/);
    await expect(db.query(`delete from public.emprestimos`)).rejects.toThrow(/nunca são apagados/);
    await expect(db.query(`truncate public.clientes cascade`)).rejects.toThrow(/nunca são apagados/);
    await expect(db.query(`update public.lancamentos set valor_recebido = 0`)).rejects.toThrow(/não pode ser alterado/);
  });
});

describe('Administrador e gestão de usuários', () => {
  it('não deixa o sistema sem administrador', async () => {
    await como(db, admin);
    await expect(db.query(`select public.definir_ativo($1, false)`, [admin])).rejects.toThrow(/pelo menos um administrador/);
    await expect(db.query(`select public.definir_perfil($1, 'atendente')`, [admin])).rejects.toThrow(/pelo menos um administrador/);
  });

  it('usuário desativado perde o acesso na hora', async () => {
    const temp = await criarUsuario(db, 'temp@credfacil.test');
    await como(db, admin);
    await db.query(`select public.definir_ativo($1, false)`, [temp]);
    await como(db, temp);
    const r = await db.query(`select * from public.v_emprestimos`);
    expect(r.rows.length).toBe(0);
    await expect(
      db.query(`select public.registrar_recebimento($1, 'quitacao')`, [emprestimoId]),
    ).rejects.toThrow(/Acesso negado/);
  });

  it('cada usuário muda só o próprio nome', async () => {
    await como(db, atendente);
    await db.query(`select public.definir_meu_nome('  Maria Atendente  ')`);
    await expect(db.query(`select public.definir_meu_nome('')`)).rejects.toThrow(/Informe seu nome/);
    await comoSistema(db);
    const r = await um<{ nome: string }>(db, `select nome from public.perfis where id = $1`, [atendente]);
    expect(r.nome).toBe('Maria Atendente');
    const dono = await um<{ nome: string }>(db, `select nome from public.perfis where id = $1`, [admin]);
    expect(dono.nome).toBe('Dono');
    await comoVisitante(db);
    await expect(db.query(`select public.definir_meu_nome('Hacker')`)).rejects.toThrow(/permission denied/);
  });

  it('com dois administradores, um pode virar atendente', async () => {
    const segundo = await criarUsuario(db, 'socio@credfacil.test');
    await como(db, admin);
    await db.query(`select public.definir_perfil($1, 'admin')`, [segundo]);
    await db.query(`select public.definir_perfil($1, 'atendente')`, [segundo]);
    await comoSistema(db);
    const r = await um<{ perfil: string }>(db, `select perfil::text from public.perfis where id = $1`, [segundo]);
    expect(r.perfil).toBe('atendente');
  });
});
