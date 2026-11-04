// Testes das contas feitas na tela (antes de mandar para o banco)
import { describe, expect, it } from 'vitest';
import { calcularJuros, formatarParaCampo, formatarReais, jurosPorPercentual, lerPercentual, lerReais } from '../src/lib/dinheiro';
import { diasEntre, formatarData, hojeSP, somarDias, somarMeses } from '../src/lib/datas';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { clienteVazio, cpfValido, formatarCep, formatarCpf, problemaNoCadastro } from '../src/lib/clientes';
import { FormCliente } from '../src/componentes/FormCliente';

describe('CPF e CEP na tela', () => {
  it('confere os dígitos do CPF igual ao banco', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('11144477735')).toBe(true);
    expect(cpfValido('123.456.789-00')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('5299822472')).toBe(false);
  });

  it('formata para exibir', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25');
    expect(formatarCep('01310100')).toBe('01310-100');
  });
});

describe('Leitura de valores digitados', () => {
  it('entende os jeitos comuns de digitar dinheiro', () => {
    expect(lerReais('1.234,56')).toBe(123456);
    expect(lerReais('1234,56')).toBe(123456);
    expect(lerReais('1234,5')).toBe(123450);
    expect(lerReais('1234')).toBe(123400);
    expect(lerReais('R$ 50')).toBe(5000);
    expect(lerReais('0,01')).toBe(1);
    expect(lerReais('1.000')).toBe(100000); // ponto de milhar
    expect(lerReais('10.50')).toBe(1050); // ponto como vírgula
    expect(lerReais('1.000.000,00')).toBe(100000000);
  });

  it('recusa valores inválidos', () => {
    expect(lerReais('')).toBeNull();
    expect(lerReais('abc')).toBeNull();
    expect(lerReais('1,234,5')).toBeNull();
    expect(lerReais('10,999')).toBeNull(); // mais de 2 casas de centavos
    expect(lerReais('-10')).toBeNull();
  });

  it('formata para mostrar na tela', () => {
    expect(formatarReais(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56');
    expect(formatarReais(1).replace(/\s/g, ' ')).toBe('R$ 0,01');
    expect(formatarParaCampo(5000)).toBe('50,00');
  });
});

describe('Juros em porcentagem convertidos para reais', () => {
  it('lê a porcentagem', () => {
    expect(lerPercentual('10')).toBe(1000);
    expect(lerPercentual('10,5')).toBe(1050);
    expect(lerPercentual('2.75%')).toBe(275);
    expect(lerPercentual('10,555')).toBeNull();
  });

  it('arredonda para o centavo mais próximo', () => {
    expect(jurosPorPercentual(100000, 1000)).toBe(10000); // 10% de R$ 1.000 = R$ 100
    expect(jurosPorPercentual(33333, 1000)).toBe(3333); // 10% de R$ 333,33 = R$ 33,333 → R$ 33,33
    expect(jurosPorPercentual(33335, 1000)).toBe(3334); // R$ 33,335 → R$ 33,34 (meio centavo sobe)
    expect(jurosPorPercentual(12345, 1550)).toBe(1913); // 15,5% de R$ 123,45 = R$ 19,13475 → R$ 19,13
    expect(jurosPorPercentual(1, 1000)).toBe(0); // 10% de 1 centavo
  });

  it('campo de juros aceita R$ ou %', () => {
    expect(calcularJuros('reais', '150,00', 100000)).toBe(15000);
    expect(calcularJuros('percentual', '15', 100000)).toBe(15000);
    expect(calcularJuros('percentual', 'x', 100000)).toBeNull();
  });
});

describe('Datas (horário de Brasília)', () => {
  it('"hoje" segue Brasília, não o horário de Londres', () => {
    // 30/out 02:00 em Londres (UTC) ainda é 29/out 23:00 em Brasília
    expect(hojeSP(new Date('2026-10-30T02:00:00Z'))).toBe('2026-10-29');
    expect(hojeSP(new Date('2026-10-30T03:00:00Z'))).toBe('2026-10-30');
  });

  it('soma dias atravessando a virada do mês e do ano', () => {
    expect(somarDias('2026-10-28', 6)).toBe('2026-11-03');
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02');
    expect(diasEntre('2026-10-28', '2026-11-03')).toBe(6);
  });

  it('próximo mês no mesmo dia, ajustando fevereiro e meses de 30 dias', () => {
    expect(somarMeses('2026-10-15', 1)).toBe('2026-11-15');
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(somarMeses('2028-01-31', 1)).toBe('2028-02-29'); // ano bissexto
    expect(somarMeses('2026-12-10', 1)).toBe('2027-01-10');
  });

  it('formata no padrão brasileiro', () => {
    expect(formatarData('2026-11-03')).toBe('03/11/2026');
  });
});

describe('Cadastro simples e completo', () => {
  const basico = { ...clienteVazio, nome: 'Maria', whatsapp: '(24) 99999-0000' };
  const endereco = { cep: '01310-100', logradouro: 'Av. Paulista', numero: '1000', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP' };

  it('simples: só nome e WhatsApp são obrigatórios', () => {
    expect(problemaNoCadastro(basico, true)).toBeNull();
    expect(problemaNoCadastro({ ...basico, indicacao: 'Seu Antônio' }, true)).toBeNull();
    expect(problemaNoCadastro({ ...basico, nome: ' ' }, true)).toMatch(/nome/);
    expect(problemaNoCadastro({ ...basico, whatsapp: '123' }, true)).toMatch(/WhatsApp/);
  });

  it('simples: o que for preenchido a mais continua sendo conferido', () => {
    expect(problemaNoCadastro({ ...basico, cpf: '123.456.789-00' }, true)).toMatch(/CPF inválido/);
    expect(problemaNoCadastro({ ...basico, email: 'sem-arroba' }, true)).toMatch(/E-mail/);
    expect(problemaNoCadastro({ ...basico, cep: '123' }, true)).toMatch(/CEP/);
    expect(problemaNoCadastro({ ...basico, cpf: '529.982.247-25', ...endereco }, true)).toBeNull();
  });

  it('completo: CPF e endereço continuam obrigatórios', () => {
    expect(problemaNoCadastro(basico, false)).toMatch(/CPF/);
    expect(problemaNoCadastro({ ...basico, cpf: '529.982.247-25' }, false)).toMatch(/CEP/);
    expect(problemaNoCadastro({ ...basico, cpf: '529.982.247-25', ...endereco }, false)).toBeNull();
  });
});

describe('Tela do cadastro', () => {
  const tela = (simples: boolean, dados = clienteVazio) =>
    renderToStaticMarkup(createElement(FormCliente, { dados, aoMudar: () => {}, simples }));

  it('simples mostra só nome, WhatsApp e indicação, com o botão de mais dados', () => {
    const html = tela(true);
    expect(html).toContain('WhatsApp');
    expect(html).toContain('Indicado por');
    expect(html).toContain('Mais dados');
    expect(html).not.toContain('000.000.000-00');
    expect(html).not.toContain('Rua / avenida');
  });

  it('simples abre sozinho os dados extras de quem já tem CPF', () => {
    expect(tela(true, { ...clienteVazio, cpf: '529.982.247-25' })).toContain('Rua / avenida');
  });

  it('completo mostra tudo, sem o botão', () => {
    const html = tela(false);
    expect(html).toContain('000.000.000-00');
    expect(html).toContain('Rua / avenida');
    expect(html).toContain('Indicado por');
    expect(html).not.toContain('Mais dados');
  });
});
