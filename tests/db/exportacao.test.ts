// Testes da exportação completa
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { como, criarUsuario, novoBanco, um } from './banco';

let db: PGlite;
let admin: string;
let atendente: string;

beforeAll(async () => {
  db = await novoBanco();
  admin = await criarUsuario(db, 'dono@credfacil.test', 'Dono');
  atendente = await criarUsuario(db, 'atendente@credfacil.test');
  await como(db, admin);
  const { id } = await um<{ id: string }>(db, `select public.criar_emprestimo('Cliente Um', '11912345678', 100000, 10000, public.hoje_sp() + 30) as id`);
  await db.query(`select public.registrar_recebimento($1, 'juros', public.hoje_sp() + 60, 10000)`, [id]);
});

describe('Exportação completa', () => {
  it('traz clientes, empréstimos, lançamentos e usuários', async () => {
    await como(db, admin);
    const { d } = await um<{ d: Record<string, unknown[]> }>(db, `select public.exportar_dados() as d`);
    expect(d.clientes).toHaveLength(1);
    expect(d.emprestimos).toHaveLength(1);
    expect(d.lancamentos).toHaveLength(2);
    expect(d.usuarios).toHaveLength(2);
    expect((d.lancamentos[0] as Record<string, unknown>).cliente_nome).toBe('Cliente Um');
    // a "foto" interna do desfazer não vai para a planilha
    expect((d.lancamentos[0] as Record<string, unknown>).estado_anterior).toBeUndefined();
  });

  it('registra quem exportou e quando', async () => {
    await como(db, admin);
    await db.query(`select public.registrar_exportacao('Excel')`);
    const r = await um<{ origem: string; detalhe: string; usuario_id: string }>(db, `select origem, detalhe, usuario_id from public.backups order by id desc limit 1`);
    expect(r).toMatchObject({ origem: 'exportacao', detalhe: 'Exportação Excel', usuario_id: admin });
  });

  it('atendente não exporta', async () => {
    await como(db, atendente);
    await expect(db.query(`select public.exportar_dados()`)).rejects.toThrow(/somente administradores/);
    await expect(db.query(`select public.registrar_exportacao('Excel')`)).rejects.toThrow(/somente administradores/);
  });
});
