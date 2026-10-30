// Testes das contas feitas na tela (antes de mandar para o banco)
import { describe, expect, it } from 'vitest';
import { calcularJuros, formatarParaCampo, formatarReais, jurosPorPercentual, lerPercentual, lerReais } from '../src/lib/dinheiro';
import { diasEntre, formatarData, hojeSP, somarDias, somarMeses } from '../src/lib/datas';

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
