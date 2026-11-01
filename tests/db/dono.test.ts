// Testes da proteção do Dono do sistema (o primeiro administrador)
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { como, comoSistema, criarUsuario, novoBanco, um } from './banco';

let db: PGlite;
let dono: string;
let socio: string;
let atendente: string;

beforeAll(async () => {
  db = await novoBanco();
  dono = await criarUsuario(db, 'dono@credfacil.test', 'Dono');
  socio = await criarUsuario(db, 'socio@credfacil.test', 'Sócio');
  atendente = await criarUsuario(db, 'atendente@credfacil.test', 'Atendente');
  await como(db, dono);
  await db.query(`select public.definir_perfil($1, 'admin')`, [socio]);
});

describe('Dono do sistema', () => {
  it('o primeiro login é o Dono, e só ele', async () => {
    await comoSistema(db);
    const r = await db.query<{ email: string }>(`select email from public.perfis where dono`);
    expect(r.rows.map((x) => x.email)).toEqual(['dono@credfacil.test']);
    await expect(db.query(`update public.perfis set dono = true where id = $1`, [socio])).rejects.toThrow(/duplicate|unique/i);
  });

  it('outro administrador não remove o acesso do Dono nem o rebaixa', async () => {
    await como(db, socio);
    await expect(db.query(`select public.definir_ativo($1, false)`, [dono])).rejects.toThrow(/Dono do sistema não pode ser removido/);
    await expect(db.query(`select public.definir_perfil($1, 'atendente')`, [dono])).rejects.toThrow(/Dono do sistema não pode deixar/);
    await comoSistema(db);
    const d = await um<{ ativo: boolean; perfil: string }>(db, `select ativo, perfil::text from public.perfis where id = $1`, [dono]);
    expect(d).toEqual({ ativo: true, perfil: 'admin' });
  });

  it('nem o próprio Dono remove o próprio acesso', async () => {
    await como(db, dono);
    await expect(db.query(`select public.definir_ativo($1, false)`, [dono])).rejects.toThrow(/Dono/);
  });

  it('o Dono continua gerenciando os outros normalmente', async () => {
    await como(db, dono);
    await db.query(`select public.definir_ativo($1, false)`, [atendente]);
    await db.query(`select public.definir_ativo($1, true)`, [atendente]);
    await db.query(`select public.definir_perfil($1, 'atendente')`, [socio]);
    await comoSistema(db);
    const s = await um<{ perfil: string }>(db, `select perfil::text from public.perfis where id = $1`, [socio]);
    expect(s.perfil).toBe('atendente');
  });
});
