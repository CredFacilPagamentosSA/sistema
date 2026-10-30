// Cria um banco de testes no próprio computador, com as mesmas migrações do Supabase.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(import.meta.dirname, '..', '..');

export async function novoBanco(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(join(raiz, 'tests', 'db', 'supabase_stub.sql'), 'utf8'));
  const pasta = join(raiz, 'supabase', 'migrations');
  for (const arquivo of readdirSync(pasta).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(pasta, arquivo), 'utf8'));
  }
  return db;
}

// Simula o "sistema" (sem login, com poder total), como o painel do Supabase
export async function comoSistema(db: PGlite) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
}

// Simula um usuário logado no app
export async function como(db: PGlite, usuarioId: string) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [usuarioId]);
  await db.exec('set role authenticated');
}

// Simula um visitante sem login
export async function comoVisitante(db: PGlite) {
  await comoSistema(db);
  await db.exec('set role anon');
}

export async function criarUsuario(db: PGlite, email: string, nome = email): Promise<string> {
  await comoSistema(db);
  const r = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, jsonb_build_object('nome', $2::text)) returning id`,
    [email, nome],
  );
  return r.rows[0].id;
}

export async function um<T = Record<string, unknown>>(db: PGlite, sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<T>(sql, params);
  return r.rows[0];
}

// Data relativa a hoje (horário de Brasília), no formato AAAA-MM-DD
export async function dia(db: PGlite, deslocamento: number): Promise<string> {
  const r = await um<{ d: string }>(db, `select (public.hoje_sp() + $1::int)::text as d`, [deslocamento]);
  return r.d;
}
