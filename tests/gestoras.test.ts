import { describe, it, expect } from 'vitest';
import { dgEnriquecer, GESTORA_GRUPO_CONTEA } from '../src/components/views/diagnostico';

const fundo = (nomeAtivo: string) => ({
  nomeAtivo, ativo: nomeAtivo, produto: nomeAtivo,
  classe: 'Fundos', subclasse: 'FN', estrategia: 'Retorno Absoluto (MM)',
  instituicao: 'BTG', bruto: 1000, liquido: 1000,
});

describe('Casas gestoras consolidadas', () => {
  const base = new Date(2026, 9, 22);
  it.each([
    'CONTEA CAPITAL FIC FIM',
    'CARBYNE MASTER FIM',
    'BRM ESTRATEGIA FIM CP',
    'APEX EQUITY HEDGE FIC FIM',
    'ELUJA FIM',
    'PIGNOLA FIC FIM CP',
    'XP APEX FIC FIM', // nome com distribuidor: o grupo tem prioridade
  ])('%s → mesma gestora', nome => {
    expect(dgEnriquecer(fundo(nome), base).ge).toBe(GESTORA_GRUPO_CONTEA);
  });

  it('outras gestoras continuam separadas', () => {
    expect(dgEnriquecer(fundo('KINEA ATLAS FIM'), base).ge).toBe('Kinea');
  });
});

describe('Contea Valadier (cota júnior de FIDC)', () => {
  it('é Alternativo, Crédito Estruturado, gestora do grupo e liquidez por cotização', () => {
    const r = dgEnriquecer(fundo('CONTEA VALADIER FICFIM CRPR'), new Date(2026, 9, 22));
    expect(r.classe).toBe('Alt');
    expect(r.cp).toBe('Estr');
    expect(r.ge).toBe(GESTORA_GRUPO_CONTEA);
    expect(r.janela).toBe('cot');
    expect(r.prazo).toBe('L');
    expect(r.veiculo).toBe('FIDC');
    expect(r.confirmado).toBe(true);
  });
});
