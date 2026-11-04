// Testes do cadastro completo de clientes
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { como, comoSistema, comoVisitante, criarUsuario, novoBanco, um } from './banco';

let db: PGlite;
let admin: string;
let atendente: string;

// CPFs de exemplo válidos (gerados para teste, não são de pessoas reais conhecidas)
const CPF_A = '529.982.247-25';
const CPF_B = '111.444.777-35';

const completo = {
  nome: 'Carla Mendes',
  whatsapp: '(11) 98888-7777',
  cpf: CPF_A,
  data_nascimento: '1985-04-12',
  email: 'Carla@Exemplo.com',
  cep: '01310-100',
  logradouro: 'Avenida Paulista',
  numero: '1000',
  complemento: 'Apto 12',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  uf: 'sp',
  observacoes: 'Indicada pelo João.',
};

async function salvar(id: string | null, dados: Record<string, unknown>, usuario = admin) {
  await como(db, usuario);
  return (await um<{ id: string }>(db, `select public.salvar_cliente($1, $2::jsonb) as id`, [id, JSON.stringify(dados)])).id;
}

async function ler(id: string) {
  await comoSistema(db);
  return um<Record<string, unknown>>(
    db,
    `select nome, whatsapp, cpf, data_nascimento::text, email, cep, logradouro, numero, complemento, bairro, cidade, uf, observacoes, atualizado_em
       from public.clientes where id = $1`,
    [id],
  );
}

beforeAll(async () => {
  db = await novoBanco();
  admin = await criarUsuario(db, 'dono@credfacil.test');
  atendente = await criarUsuario(db, 'atendente@credfacil.test');
});

describe('Cadastro de cliente', () => {
  it('guarda todos os dados, só com números no CPF, CEP e WhatsApp', async () => {
    const id = await salvar(null, completo);
    const c = await ler(id);
    expect(c).toMatchObject({
      nome: 'Carla Mendes',
      whatsapp: '5511988887777',
      cpf: '52998224725',
      data_nascimento: '1985-04-12',
      email: 'carla@exemplo.com',
      cep: '01310100',
      uf: 'SP',
      cidade: 'São Paulo',
      complemento: 'Apto 12',
    });
  });

  it('recusa CPF inválido', async () => {
    await expect(salvar(null, { ...completo, cpf: '123.456.789-00' })).rejects.toThrow(/CPF inválido/);
    await expect(salvar(null, { ...completo, cpf: '111.111.111-11' })).rejects.toThrow(/CPF inválido/);
  });

  it('não deixa cadastrar o mesmo CPF duas vezes', async () => {
    await expect(salvar(null, { ...completo, nome: 'Outra Pessoa' })).rejects.toThrow(/Já existe um cliente com este CPF: Carla Mendes/);
  });

  it('recusa menor de idade, e-mail, CEP e UF inválidos', async () => {
    const base = { ...completo, cpf: '' };
    await expect(salvar(null, { ...base, data_nascimento: '2015-01-01' })).rejects.toThrow(/18 anos/);
    await expect(salvar(null, { ...base, email: 'sem-arroba' })).rejects.toThrow(/E-mail inválido/);
    await expect(salvar(null, { ...base, cep: '123' })).rejects.toThrow(/CEP inválido/);
    await expect(salvar(null, { ...base, uf: 'São Paulo' })).rejects.toThrow(/UF/);
  });

  it('cadastro simples: só nome, WhatsApp e indicação', async () => {
    const id = await salvar(null, { nome: 'Rápido', whatsapp: '11955554444', indicacao: '  Seu Antônio  ' });
    await comoSistema(db);
    const c = await um<{ indicacao: string; cpf: string | null; cep: string | null }>(
      db,
      `select indicacao, cpf, cep from public.clientes where id = $1`,
      [id],
    );
    expect(c).toEqual({ indicacao: 'Seu Antônio', cpf: null, cep: null });
  });

  it('indicação muito longa é recusada, e a alteração fica no histórico', async () => {
    await expect(
      salvar(null, { nome: 'Longo', whatsapp: '11955553333', indicacao: 'x'.repeat(121) }),
    ).rejects.toThrow(/Indicado por muito longo/);

    const id = await salvar(null, { nome: 'Muda', whatsapp: '11955552222', indicacao: 'Primeira' });
    await salvar(id, { nome: 'Muda', whatsapp: '11955552222', indicacao: 'Segunda' });
    await comoSistema(db);
    const c = await um<{ indicacao: string }>(db, `select indicacao from public.clientes where id = $1`, [id]);
    const h = await um<{ antes: string }>(db, `select dados_anteriores ->> 'indicacao' as antes from public.clientes_historico where cliente_id = $1`, [id]);
    expect(c.indicacao).toBe('Segunda');
    expect(h.antes).toBe('Primeira');
  });

  it('campos vazios ficam em branco (clientes antigos continuam válidos)', async () => {
    const id = await salvar(null, { nome: 'Só Básico', whatsapp: '11977776666', cpf: '', cep: '', email: '  ' });
    const c = await ler(id);
    expect(c.cpf).toBeNull();
    expect(c.cep).toBeNull();
    expect(c.email).toBeNull();
  });
});

describe('Alteração com histórico', () => {
  it('atualiza e guarda os dados anteriores, com quem alterou', async () => {
    const id = await salvar(null, { ...completo, cpf: CPF_B, nome: 'Bruno Alves', whatsapp: '11966665555' });
    await salvar(id, { ...completo, cpf: CPF_B, nome: 'Bruno Alves', whatsapp: '11966665555', numero: '2000', bairro: 'Centro' }, atendente);
    const c = await ler(id);
    expect(c.numero).toBe('2000');
    expect(c.atualizado_em).not.toBeNull();
    await como(db, admin);
    const h = await db.query<{ dados_anteriores: Record<string, string>; usuario_id: string }>(
      `select dados_anteriores, usuario_id from public.v_clientes_historico where cliente_id = $1`,
      [id],
    );
    expect(h.rows).toHaveLength(1);
    expect(h.rows[0].dados_anteriores.numero).toBe('1000');
    expect(h.rows[0].dados_anteriores.bairro).toBe('Bela Vista');
    expect(h.rows[0].usuario_id).toBe(atendente);
  });

  it('mantém o próprio CPF ao editar (não acusa duplicado)', async () => {
    await comoSistema(db);
    const { id } = await um<{ id: string }>(db, `select id from public.clientes where cpf = '52998224725'`);
    await expect(salvar(id, { ...completo, observacoes: 'Atualizado' })).resolves.toBe(id);
  });

  it('histórico não pode ser apagado nem alterado', async () => {
    await comoSistema(db);
    await expect(db.query(`delete from public.clientes_historico`)).rejects.toThrow(/nunca são apagados/);
    await expect(db.query(`update public.clientes_historico set dados_anteriores = '{}'`)).rejects.toThrow(/não pode ser alterado/);
    await como(db, admin);
    await expect(db.query(`delete from public.clientes_historico`)).rejects.toThrow(/permission denied/);
  });
});

describe('Permissões', () => {
  it('visitante sem login não cadastra nem lê', async () => {
    await comoVisitante(db);
    await expect(db.query(`select public.salvar_cliente(null, '{"nome":"X","whatsapp":"11912345678"}')`)).rejects.toThrow(/permission denied/);
    await expect(db.query(`select * from public.clientes_historico`)).rejects.toThrow(/permission denied/);
  });

  it('ninguém grava direto na tabela de clientes', async () => {
    await como(db, atendente);
    await expect(db.query(`update public.clientes set cpf = null`)).rejects.toThrow(/permission denied/);
  });
});
