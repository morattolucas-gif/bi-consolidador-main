import { describe, it, expect } from 'vitest';
import { emissorCurto, dgEnriquecer } from '../src/components/views/diagnostico';

describe('Nomes de emissores diretos', () => {
  it.each([
    ['BOA SAFRA SEMENTES S.A.', 'Boa Safra Sementes'],
    ['Boa Safra Sementes', 'Boa Safra Sementes'],
    ['BANCO SAFRA S/A', 'Banco Safra'],
    ['BCO SAFRA', 'Banco Safra'],
    ['BANCO BTG PACTUAL S.A.', 'BTG Pactual'],
  ])('%s → %s', (bruto, esperado) => {
    expect(emissorCurto(bruto)).toBe(esperado);
  });

  it('CRA Boa Safra sai com o emissor certo no relatório', () => {
    const p = { nomeAtivo: 'CRA BOA SAFRA', ativo: 'CRA0240001', produto: 'CRA', emissor: 'BOA SAFRA SEMENTES S.A.',
      classe: 'Renda Fixa', subclasse: 'PRIVADO', estrategia: 'Inflação', instituicao: 'BTG', bruto: 1000, liquido: 1000,
      vencimento: new Date(2030, 5, 15) };
    const r = dgEnriquecer(p, new Date(2026, 9, 22));
    expect(r.ge).toBe('Boa Safra Sementes');
    expect(r.nome).toContain('Boa Safra Sementes');
    expect(r.nome).not.toContain('Banco Safra');
  });
});
