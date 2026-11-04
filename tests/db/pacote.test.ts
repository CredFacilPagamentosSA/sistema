// O pacote de cliente cola todas as atualizações de uma vez num banco novo: precisa funcionar assim
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { mensagemCobranca, type Emprestimo } from '../../src/lib/emprestimos';

const raiz = join(import.meta.dirname, '..', '..');

describe('Instalação nova para um cliente', () => {
  it('o banco completo instala de uma vez, e o primeiro login vira administrador e Dono', async () => {
    const pasta = join(raiz, 'supabase', 'migrations');
    const completo = readdirSync(pasta).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(join(pasta, f), 'utf8')).join('\n');
    const db = new PGlite();
    await db.exec(readFileSync(join(raiz, 'tests', 'db', 'supabase_stub.sql'), 'utf8'));
    await db.exec(completo);

    await db.query(`insert into auth.users (email) values ('novo@cliente.test')`);
    await db.query(`insert into auth.users (email) values ('ajudante@cliente.test')`);
    const r = await db.query<{ email: string; perfil: string; dono: boolean }>(`select email, perfil::text, dono from public.perfis order by email`);
    expect(r.rows).toEqual([
      { email: 'ajudante@cliente.test', perfil: 'atendente', dono: false },
      { email: 'novo@cliente.test', perfil: 'admin', dono: true },
    ]);
    const c = await db.query<{ n: number }>(`select count(*)::int as n from public.clientes`);
    expect(c.rows[0].n).toBe(0);
    await db.close();
  });
});

describe('Mensagem de cobrança', () => {
  const e = {
    cliente_nome: 'Maria Silva', situacao: 'vence_hoje', vencimento: '2026-11-03',
    total_para_quitar: 110000, valor_divida: 100000, juros_ciclo: 10000,
  } as Emprestimo;

  it('cita a empresa quando há nome e não cita quando a instalação desliga', () => {
    expect(mensagemCobranca(e, 'Empresa X')).toContain('seu empréstimo com a Empresa X vence hoje');
    const semNome = mensagemCobranca(e, null);
    expect(semNome).toContain('o seu empréstimo vence hoje');
    expect(semNome).not.toContain('null');
  });
});
