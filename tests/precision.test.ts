import { describe, it, expect } from 'vitest';
import {
  somaPrecisa,
  subPrecisa,
  multPrecisa,
  divPrecisa,
  somaLista,
  arredondarFinanceiro
} from '../src/domain/precision';

describe('Precisão Numérica Financeira (BigNumber Engine)', () => {
  it('elimina a dízima flutuante clássica do IEEE-754 (0.1 + 0.2 === 0.3)', () => {
    // No IEEE-754 puro: 0.1 + 0.2 === 0.30000000000000004
    expect(0.1 + 0.2).not.toBe(0.3);
    // Com somaPrecisa:
    expect(somaPrecisa(0.1, 0.2)).toBe(0.3);
  });

  it('calcula subtração exata sem resíduos binários', () => {
    // 1.03 - 0.42 = 0.6100000000000001 no float nativo
    expect(1.03 - 0.42).not.toBe(0.61);
    expect(subPrecisa(1.03, 0.42)).toBe(0.61);
  });

  it('executa multiplicação precisa para taxas e câmbio PTAX', () => {
    const usd = 12500.5;
    const ptax = 5.6789;
    const res = multPrecisa(usd, ptax);
    expect(res).toBe(70989.08945);
    expect(arredondarFinanceiro(res, 2)).toBe(70989.09);
  });

  it('calcula divisões de percentual sem overflow de dízima', () => {
    const total = 300000;
    const parcela = 100000;
    const res = divPrecisa(parcela, total);
    expect(res).toBeCloseTo(0.3333333333, 8);
  });

  it('somaLista acumula arrays de posições financeiras sem perda de centavos', () => {
    const valores = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    // Soma matemática esperada: 4.5
    const somaFloat = valores.reduce((a, b) => a + b, 0);
    // Reduções normais podem divergir em centésimos de float
    const soma = somaLista(valores);
    expect(soma).toBe(4.5);

    const posicoes = [
      { valor: 10450.33 },
      { valor: 25000.67 },
      { valor: 0.01 },
      { valor: 99.99 }
    ];
    const totalPos = somaLista(posicoes, p => p.valor);
    expect(totalPos).toBe(35551.0);
  });

  it('arredondarFinanceiro preserva arredondamento de duas casas bancárias', () => {
    expect(arredondarFinanceiro(10.005, 2)).toBe(10.01);
    expect(arredondarFinanceiro(10.004, 2)).toBe(10.0);
    expect(arredondarFinanceiro(1234567.891, 2)).toBe(1234567.89);
  });
});
