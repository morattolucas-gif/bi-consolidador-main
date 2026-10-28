import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { lerExtratoPdf } from '../src/parsers/pdf-reader';
import { calcularDiagnosticoBase } from '../src/domain/portfolio-risk';
import { S } from '../src/domain/state';
import { adicionarFonte } from '../src/domain/pipeline';

const jsonPath = path.resolve('C:/Users/Moratto/.gemini/antigravity-ide/brain/02e100e6-5cb3-4464-aca0-2d0ced3aea07/scratch/pdf_lines.json');
const temArquivo = fs.existsSync(jsonPath);

describe.skipIf(!temArquivo)('Módulo de Gestão de Portfólio e Risco', () => {
  const linhasPdf = temArquivo ? JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) : [];
  const ext = lerExtratoPdf(linhasPdf);

  it('calcula corretamente o diagnóstico executivo para a carteira real do BTG', () => {
    (global as any).window = { CADASTRO_CLIENTES: [] };
    (global as any).document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
    (global as any).localStorage = { getItem: () => null, setItem: () => {} };

    // Carrega a fonte no pipeline
    adicionarFonte({
      id: 'BTG',
      inst: 'BTG',
      rotulo: 'HOLDINGBRAS',
      registros: ext.regs.map(r => ({ ...r, conta: ext.conta, clienteNome: ext.clienteSugerido, clienteId: ext.clienteSugerido }))
    });

    const diag = calcularDiagnosticoBase(S.posicoes, 'cliente', new Date(2026, 9, 28));

    expect(diag.totalPL).toBeCloseTo(50501711.47, 2);
    expect(diag.qtdClientesTotal).toBe(1);
    expect(diag.qtdClientesDesenquadrados).toBe(1); // Porque Pós-fixado está em 92% (teto é 35%)

    // Encontra desvio em Pós-fixado (excesso) e Inflação (déficit)
    const u = diag.unidades[0];
    expect(u.status).toBe('desenquadrado');

    const desvioPos = u.desviosClasses.find(d => d.chave === 'Pos');
    expect(desvioPos).toBeDefined();
    expect(desvioPos?.tipo).toBe('excesso');
    expect(desvioPos?.pctAtual).toBeGreaterThan(0.90);

    const desvioInfl = u.desviosClasses.find(d => d.chave === 'Infl');
    expect(desvioInfl).toBeDefined();
    expect(desvioInfl?.tipo).toBe('deficit');
    expect(desvioInfl?.pctAtual).toBeLessThan(0.10);

    // Identifica o vencimento do CDB IPCA nos próximos dias
    expect(u.vencimentosProximos.length).toBeGreaterThan(0);
    expect(u.vencimentosProximos[0].ativo).toContain('CDB BTG Pactual');
    expect(u.vencimentosProximos[0].valor).toBeCloseTo(4010215.14, 2);

    // Gera sugestões de swaps casando excessos/vencimentos com déficits
    expect(diag.sugestoesSwaps.length).toBeGreaterThan(0);
  });
});
