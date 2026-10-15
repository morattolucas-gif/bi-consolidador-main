import { describe, it, expect } from 'vitest';
import { lerDebenturesDetalhe } from '../src/parsers/debentures';
import { nomeRepetido, rotuloContas, soPrimeiroNome } from '../src/components/formatters';
import { classificar } from '../src/parsers/classification';

describe('Melhorias de 14 e 15/10 (organização de nomes, contas e leitores)', () => {
  it('lê o PDF "Detalhes das Debêntures" pelo Tot. Geral', () => {
    const linhas = [
      'Detalhes das Debêntures Simula IRRF',
      'Debenturista: José Carlos da Silva',
      'Emissão e Série: 04/05/2026 - 1ª EMISSÃO - 19ª SERIE - 1ª EMISSÃO - 19ª SERIE',
      '30/09/2026 100 R$ 1.112,45 R$ 1.644,01 R$ 111.244,69 R$ 2.530,06 R$ 108.714,63',
      '15/10/2026 100 R$ 1.120,36 R$ 791,51 R$ 112.036,20 R$ 2.708,15 R$ 109.328,05',
      'Tot. Geral 100 R$ 8.794,20 R$ 0,00 R$ 112.036,20 R$ 2.708,15 R$ 109.328,05',
      'Valores estimados, não emitidos pelo agente.',
    ];
    const e = lerDebenturesDetalhe(linhas, 'Outra');
    expect(e.total).toBeCloseTo(112036.2, 2);
    expect(e.regs[0].bruto).toBeCloseTo(112036.2, 2);
    expect(e.regs[0].liquido).toBeCloseTo(109328.05, 2);
    expect(e.data).toBe('15/10/2026');
    expect(e.clienteSugerido).toBe('José Carlos da Silva');
    expect(e.regs[0].ativo).toContain('19ª');
    expect(e.avisos[0]).toMatch(/simulação/);
  });

  it('diferencia nomes repetidos e reconhece nome só com o primeiro nome', () => {
    const lista = [{ nome: 'Carlos' }, { nome: 'Carlos' }, { nome: 'Maria' }];
    expect(nomeRepetido('Carlos', lista)).toBe(true);
    expect(nomeRepetido('Maria', lista)).toBe(false);
    expect(rotuloContas(['000123456'])).toBe('conta 123456');
    expect(rotuloContas(['001', '002'])).toBe('contas 1, 2');
    expect(soPrimeiroNome('Carlos')).toBe(true);
    expect(soPrimeiroNome('José Carlos da Silva')).toBe(false);
  });

  it('fundo "BTG Tesouro Selic" é Pós-fixado (não é título público)', () => {
    const f = classificar('BTG Tesouro Selic FIRFRefDI', { categoria: 'Fundos' });  // como vem do extrato (aba Fundos)
    expect(f.classe).toBe('Fundos');
    expect(f.estr).toBe('Pós-fixado');
  });
});

import { palavras } from '../src/components/formatters';
import { lerExtratoPdf } from '../src/parsers/pdf-reader';
describe('Reconhecimento de PDFs pelo conteúdo', () => {
  it('palavras() devolve o texto sem acento, minúsculo e com espaço nas pontas', () => {
    expect(palavras('Extrato da Conta Investimento — Posição')).toBe(' extrato da conta investimento posicao ');
  });
  it('reconhece "Detalhes das Debêntures" mesmo com outra instituição escolhida', () => {
    const e = lerExtratoPdf(['Detalhes das Debêntures Simula IRRF', 'Debenturista: José Carlos da Silva',
      'Tot. Geral 100 R$ 8.794,20 R$ 0,00 R$ 112.036,20 R$ 2.708,15 R$ 109.328,05'], 'Itaú');
    expect(e.modelo).toBe('debentures-detalhe');
    expect(e.total).toBeCloseTo(112036.2, 2);
  });
});
