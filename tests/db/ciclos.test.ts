// Testes das regras de ciclos, recebimentos e desfazer.
// Valores em centavos: 100000 = R$ 1.000,00
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { como, comoSistema, criarUsuario, dia, novoBanco, um } from './banco';

let db: PGlite;
let admin: string;

type Emprestimo = {
  valor_divida: number;
  juros_ciclo: number;
  vencimento: string;
  renovacoes: number;
  renovacoes_so_juros_seguidas: number;
  estado: string;
  situacao: string;
  dias_para_vencer: number;
  alerta_risco: boolean;
  total_para_quitar: number;
  cliente_nome: string;
  cliente_whatsapp: string;
};

async function novoEmprestimo(valor: number, juros: number, vencimentoEmDias = 30, nome = 'Cliente Teste') {
  await como(db, admin);
  const venc = await dia(db, vencimentoEmDias);
  const r = await um<{ id: string }>(
    db,
    `select public.criar_emprestimo($1, $2, $3, $4, $5::date) as id`,
    [nome, '(11) 91234-5678', valor, juros, venc],
  );
  return r.id;
}

async function ver(id: string): Promise<Emprestimo> {
  const r = await um<Record<string, unknown>>(
    db,
    `select valor_divida, juros_ciclo, vencimento::text, renovacoes, renovacoes_so_juros_seguidas, estado::text,
            situacao, dias_para_vencer, alerta_risco, total_para_quitar, cliente_nome, cliente_whatsapp
       from public.v_emprestimos where id = $1`,
    [id],
  );
  return {
    ...(r as Emprestimo),
    valor_divida: Number(r.valor_divida),
    juros_ciclo: Number(r.juros_ciclo),
    total_para_quitar: Number(r.total_para_quitar),
    dias_para_vencer: Number(r.dias_para_vencer),
  };
}

async function receber(
  id: string,
  tipo: 'quitacao' | 'juros' | 'parcial',
  opcoes: { novoVencimentoEmDias?: number; novosJuros?: number; abatimento?: number; multa?: number; jurosRecebido?: number } = {},
) {
  const venc = opcoes.novoVencimentoEmDias === undefined ? null : await dia(db, opcoes.novoVencimentoEmDias);
  const r = await um<{ id: number }>(
    db,
    `select public.registrar_recebimento($1, $2::public.tipo_lancamento, $3::date, $4, $5, $6, $7) as id`,
    [id, tipo, venc, opcoes.novosJuros ?? null, opcoes.abatimento ?? 0, opcoes.multa ?? 0, opcoes.jurosRecebido ?? null],
  );
  return ultimoLancamento(id);
}

async function ultimoLancamento(id: string) {
  const r = await um<Record<string, unknown>>(
    db,
    `select tipo::text, valor_recebido, juros_recebido, abatimento, multa, usuario_id, criado_em, desfeito
       from public.v_lancamentos where emprestimo_id = $1 order by id desc limit 1`,
    [id],
  );
  return {
    tipo: r.tipo as string,
    valor_recebido: Number(r.valor_recebido),
    juros_recebido: Number(r.juros_recebido),
    abatimento: Number(r.abatimento),
    multa: Number(r.multa),
    usuario_id: r.usuario_id as string,
    criado_em: r.criado_em,
  };
}

async function quantidadeLancamentos(id: string) {
  const r = await um<{ n: number }>(db, `select count(*)::int as n from public.lancamentos where emprestimo_id = $1`, [id]);
  return r.n;
}

beforeAll(async () => {
  db = await novoBanco();
  admin = await criarUsuario(db, 'dono@credfacil.test', 'Dono');
});

describe('Novo empréstimo', () => {
  it('cria com dívida igual ao valor emprestado e registra quem criou', async () => {
    const id = await novoEmprestimo(100000, 10000);
    const e = await ver(id);
    expect(e.valor_divida).toBe(100000);
    expect(e.juros_ciclo).toBe(10000);
    expect(e.estado).toBe('aberto');
    expect(e.cliente_whatsapp).toBe('5511912345678');
    const l = await ultimoLancamento(id);
    expect(l.tipo).toBe('criacao');
    expect(l.usuario_id).toBe(admin);
    expect(l.criado_em).toBeTruthy();
  });

  it('recusa valor zero e WhatsApp inválido', async () => {
    await expect(novoEmprestimo(0, 1000)).rejects.toThrow(/maior que zero/);
    await como(db, admin);
    const venc = await dia(db, 30);
    await expect(
      db.query(`select public.criar_emprestimo('Fulano', '1234', 1000, 100, $1::date)`, [venc]),
    ).rejects.toThrow(/WhatsApp inválido/);
  });
});

describe('Quitar tudo', () => {
  it('recebe dívida + juros e encerra o empréstimo', async () => {
    const id = await novoEmprestimo(100000, 10000);
    const l = await receber(id, 'quitacao');
    expect(l.valor_recebido).toBe(110000); // R$ 1.000 + R$ 100
    expect(l.abatimento).toBe(100000);
    expect(l.juros_recebido).toBe(10000);
    const e = await ver(id);
    expect(e.valor_divida).toBe(0);
    expect(e.estado).toBe('quitado');
    expect(e.situacao).toBe('quitado');
  });

  it('não aceita novo recebimento depois de quitado', async () => {
    const id = await novoEmprestimo(50000, 5000);
    await receber(id, 'quitacao');
    await expect(receber(id, 'quitacao')).rejects.toThrow(/não está aberto/);
  });
});

describe('Só juros', () => {
  it('recebe só os juros, mantém a dívida e abre novo ciclo', async () => {
    const id = await novoEmprestimo(100000, 10000, 0);
    const l = await receber(id, 'juros', { novoVencimentoEmDias: 30, novosJuros: 10000 });
    expect(l.valor_recebido).toBe(10000);
    expect(l.abatimento).toBe(0);
    const e = await ver(id);
    expect(e.valor_divida).toBe(100000);
    expect(e.dias_para_vencer).toBe(30);
    expect(e.renovacoes).toBe(1);
    expect(e.renovacoes_so_juros_seguidas).toBe(1);
  });

  it('exige novo vencimento depois do atual', async () => {
    const id = await novoEmprestimo(100000, 10000, 10);
    await expect(receber(id, 'juros', { novoVencimentoEmDias: 10, novosJuros: 10000 })).rejects.toThrow(/depois do vencimento atual/);
    await expect(receber(id, 'juros', { novosJuros: 10000 })).rejects.toThrow(/novo vencimento/);
  });
});

describe('Pagamento parcial', () => {
  it('recebe juros + abatimento e diminui a dívida', async () => {
    const id = await novoEmprestimo(100000, 10000, 0);
    const l = await receber(id, 'parcial', { abatimento: 30000, novoVencimentoEmDias: 30, novosJuros: 7000 });
    expect(l.valor_recebido).toBe(40000); // R$ 100 de juros + R$ 300 abatidos
    const e = await ver(id);
    expect(e.valor_divida).toBe(70000);
    expect(e.juros_ciclo).toBe(7000);
    expect(e.renovacoes).toBe(1);
    expect(e.renovacoes_so_juros_seguidas).toBe(0);
  });

  it('abatimento igual à dívida é bloqueado e pede "Quitar tudo"', async () => {
    const id = await novoEmprestimo(100000, 10000, 0);
    await expect(
      receber(id, 'parcial', { abatimento: 100000, novoVencimentoEmDias: 30, novosJuros: 10000 }),
    ).rejects.toThrow(/Use "Quitar tudo"/);
    await expect(
      receber(id, 'parcial', { abatimento: 150000, novoVencimentoEmDias: 30, novosJuros: 10000 }),
    ).rejects.toThrow(/Use "Quitar tudo"/);
    const e = await ver(id);
    expect(e.valor_divida).toBe(100000); // nada mudou
    expect(await quantidadeLancamentos(id)).toBe(1);
  });
});

describe('Juros diferentes a cada ciclo', () => {
  it('cada recebimento usa os juros do ciclo atual', async () => {
    const id = await novoEmprestimo(200000, 20000, 0);
    let l = await receber(id, 'juros', { novoVencimentoEmDias: 30, novosJuros: 25000 });
    expect(l.valor_recebido).toBe(20000);
    l = await receber(id, 'juros', { novoVencimentoEmDias: 60, novosJuros: 18000 });
    expect(l.valor_recebido).toBe(25000);
    l = await receber(id, 'quitacao');
    expect(l.valor_recebido).toBe(218000); // R$ 2.000 + R$ 180
  });
});

describe('Multa por atraso', () => {
  it('soma a multa ao valor recebido sem mexer na dívida', async () => {
    const id = await novoEmprestimo(100000, 10000, -5);
    const l = await receber(id, 'juros', { novoVencimentoEmDias: 25, novosJuros: 10000, multa: 2500 });
    expect(l.multa).toBe(2500);
    expect(l.valor_recebido).toBe(12500);
    expect((await ver(id)).valor_divida).toBe(100000);
  });

  it('multa também vale na quitação', async () => {
    const id = await novoEmprestimo(100000, 10000, -2);
    const l = await receber(id, 'quitacao', { multa: 1999 });
    expect(l.valor_recebido).toBe(111999);
  });
});

describe('Desfazer último lançamento', () => {
  it('desfaz "só juros": volta vencimento, juros e renovações', async () => {
    const id = await novoEmprestimo(100000, 10000, 0);
    const antes = await ver(id);
    await receber(id, 'juros', { novoVencimentoEmDias: 30, novosJuros: 15000 });
    await um(db, `select public.desfazer_ultimo($1)`, [id]);
    const depois = await ver(id);
    expect(depois).toEqual(antes);
    expect(await quantidadeLancamentos(id)).toBe(3); // criação + juros + desfazer: nada apagado
  });

  it('desfaz parcial: dívida volta ao valor anterior', async () => {
    const id = await novoEmprestimo(100000, 10000, 0);
    const antes = await ver(id);
    await receber(id, 'parcial', { abatimento: 40000, novoVencimentoEmDias: 30, novosJuros: 6000 });
    await um(db, `select public.desfazer_ultimo($1)`, [id]);
    expect(await ver(id)).toEqual(antes);
  });

  it('desfaz quitação: empréstimo volta a ficar aberto', async () => {
    const id = await novoEmprestimo(100000, 10000, 5);
    const antes = await ver(id);
    await receber(id, 'quitacao');
    await um(db, `select public.desfazer_ultimo($1)`, [id]);
    expect(await ver(id)).toEqual(antes);
  });

  it('desfaz edição: nome e WhatsApp do cliente voltam', async () => {
    const id = await novoEmprestimo(100000, 10000, 5, 'Nome Original');
    const antes = await ver(id);
    await um(db, `select public.editar_emprestimo($1, 'Nome Novo', '(21) 99999-0000')`, [id]);
    expect((await ver(id)).cliente_nome).toBe('Nome Novo');
    await um(db, `select public.desfazer_ultimo($1)`, [id]);
    expect(await ver(id)).toEqual(antes);
  });

  it('desfaz criação: empréstimo fica cancelado (sem apagar)', async () => {
    const id = await novoEmprestimo(100000, 10000);
    await um(db, `select public.desfazer_ultimo($1)`, [id]);
    expect((await ver(id)).estado).toBe('cancelado');
    await expect(um(db, `select public.desfazer_ultimo($1)`, [id])).rejects.toThrow(/Não há lançamento/);
    await expect(receber(id, 'quitacao')).rejects.toThrow(/não está aberto/);
  });

  it('desfazer duas vezes volta dois passos', async () => {
    const id = await novoEmprestimo(100000, 10000, 0);
    const original = await ver(id);
    await receber(id, 'juros', { novoVencimentoEmDias: 30, novosJuros: 11000 });
    const meio = await ver(id);
    await receber(id, 'parcial', { abatimento: 50000, novoVencimentoEmDias: 60, novosJuros: 5000 });
    await um(db, `select public.desfazer_ultimo($1)`, [id]);
    expect(await ver(id)).toEqual(meio);
    await um(db, `select public.desfazer_ultimo($1)`, [id]);
    expect(await ver(id)).toEqual(original);
  });

  it('recebimento desfeito sai do "recebido no mês"', async () => {
    await como(db, admin);
    const antes = Number((await um<{ v: number }>(db, `select public.recebido_no_mes() as v`)).v);
    const id = await novoEmprestimo(100000, 10000, 0);
    await receber(id, 'juros', { novoVencimentoEmDias: 30, novosJuros: 10000 });
    expect(Number((await um<{ v: number }>(db, `select public.recebido_no_mes() as v`)).v)).toBe(antes + 10000);
    await um(db, `select public.desfazer_ultimo($1)`, [id]);
    expect(Number((await um<{ v: number }>(db, `select public.recebido_no_mes() as v`)).v)).toBe(antes);
  });
});

describe('Situação automática e atraso', () => {
  it('classifica por dias até o vencimento', async () => {
    expect((await ver(await novoEmprestimo(1000, 100, 10))).situacao).toBe('em_dia');
    expect((await ver(await novoEmprestimo(1000, 100, 4))).situacao).toBe('em_dia');
    expect((await ver(await novoEmprestimo(1000, 100, 3))).situacao).toBe('vence_em_breve');
    expect((await ver(await novoEmprestimo(1000, 100, 1))).situacao).toBe('vence_em_breve');
    expect((await ver(await novoEmprestimo(1000, 100, 0))).situacao).toBe('vence_hoje');
    const atrasado = await ver(await novoEmprestimo(1000, 100, -7));
    expect(atrasado.situacao).toBe('atrasado');
    expect(-atrasado.dias_para_vencer).toBe(7); // 7 dias de atraso
  });

  it('atraso atravessando a virada do mês conta os dias corretamente', async () => {
    await comoSistema(db);
    const r = await um<{ d: number }>(db, `select ('2026-11-03'::date - '2026-10-28'::date) as d`);
    expect(Number(r.d)).toBe(6);
  });

  it('alerta de risco com 3 renovações seguidas só de juros; parcial zera', async () => {
    const id = await novoEmprestimo(100000, 10000, 0);
    await receber(id, 'juros', { novoVencimentoEmDias: 30, novosJuros: 10000 });
    await receber(id, 'juros', { novoVencimentoEmDias: 60, novosJuros: 10000 });
    expect((await ver(id)).alerta_risco).toBe(false);
    await receber(id, 'juros', { novoVencimentoEmDias: 90, novosJuros: 10000 });
    expect((await ver(id)).alerta_risco).toBe(true);
    await receber(id, 'parcial', { abatimento: 10000, novoVencimentoEmDias: 120, novosJuros: 9000 });
    const e = await ver(id);
    expect(e.alerta_risco).toBe(false);
    expect(e.renovacoes).toBe(4);
  });
});

describe('Recebido no mês e virada de mês (horário de Brasília)', () => {
  it('pagamento às 23h de 30/set em Brasília conta em setembro, não em outubro', async () => {
    const id = await novoEmprestimo(100000, 10000, 0, 'Virada de Mês');
    await comoSistema(db);
    // 01/out 02:00 UTC = 30/set 23:00 em Brasília
    await db.query(
      `insert into public.lancamentos (emprestimo_id, tipo, valor_recebido, juros_recebido, descricao, criado_em, estado_anterior)
       values ($1, 'juros', 7777, 7777, 'teste', '2025-10-01 02:00:00+00', '{}'::jsonb)`,
      [id],
    );
    const set = await um<{ v: number }>(db, `select public.recebido_no_mes('2025-09-15') as v`);
    const out = await um<{ v: number }>(db, `select public.recebido_no_mes('2025-10-15') as v`);
    expect(Number(set.v)).toBe(7777);
    expect(Number(out.v)).toBe(0);
  });
});

describe('Centavos', () => {
  it('valores quebrados somam exato, sem arredondamento', async () => {
    const id = await novoEmprestimo(33333, 3333, 0); // R$ 333,33 com R$ 33,33 de juros
    let l = await receber(id, 'parcial', { abatimento: 11111, novoVencimentoEmDias: 30, novosJuros: 2222 });
    expect(l.valor_recebido).toBe(14444);
    expect((await ver(id)).valor_divida).toBe(22222);
    l = await receber(id, 'quitacao', { multa: 1 });
    expect(l.valor_recebido).toBe(22222 + 2222 + 1);
  });

  it('parcial de 1 centavo a menos que a dívida é aceito', async () => {
    const id = await novoEmprestimo(100000, 0, 0);
    await receber(id, 'parcial', { abatimento: 99999, novoVencimentoEmDias: 30, novosJuros: 0 });
    expect((await ver(id)).valor_divida).toBe(1);
  });
});

describe('Painel', () => {
  it('soma dinheiro na rua e atrasados só dos empréstimos abertos', async () => {
    const outro = await novoBanco();
    const dono = await criarUsuario(outro, 'a@credfacil.test');
    await como(outro, dono);
    const d = async (n: number) => (await um<{ d: string }>(outro, `select (public.hoje_sp() + $1::int)::text as d`, [n])).d;
    await outro.query(`select public.criar_emprestimo('A', '11911111111', 100000, 10000, $1::date)`, [await d(-3)]);
    await outro.query(`select public.criar_emprestimo('B', '11922222222', 50000, 5000, $1::date)`, [await d(0)]);
    const q = await um<{ id: string }>(outro, `select public.criar_emprestimo('C', '11933333333', 70000, 7000, $1::date) as id`, [await d(10)]);
    await outro.query(`select public.registrar_recebimento($1, 'quitacao')`, [q.id]);
    const p = (await um<{ p: Record<string, number> }>(outro, `select public.painel() as p`)).p;
    expect(Number(p.dinheiro_na_rua)).toBe(150000);
    expect(Number(p.juros_ciclos_atuais)).toBe(15000);
    expect(Number(p.vencem_hoje)).toBe(1);
    expect(Number(p.atrasados_qtd)).toBe(1);
    expect(Number(p.atrasados_total)).toBe(110000);
    expect(Number(p.recebido_mes)).toBe(77000);
    await outro.close();
  });
});
