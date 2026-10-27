import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { lerExtratoPdf } from '../src/parsers/pdf-reader';
import { ehBTGRelatorioPerformance, lerBTGRelatorioPerformancePdf } from '../src/parsers/btg';

// O arquivo de exemplo só existe no computador de quem escreveu o teste: sem ele (ex.: no GitHub), o teste é pulado
// e a publicação do site não trava.
const jsonPath = path.resolve('C:/Users/Moratto/.gemini/antigravity-ide/brain/02e100e6-5cb3-4464-aca0-2d0ced3aea07/scratch/pdf_lines.json');
const temArquivo = fs.existsSync(jsonPath);
describe.skipIf(!temArquivo)('Parser BTG - Relatório de Performance PDF', () => {
  const linhasPdf: string[] = temArquivo ? JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) : [];

  it('reconhece o formato Relatório de Performance do BTG', () => {
    const limpas = linhasPdf.map(l => l.replace(/\u0000/g, 'a'));
    expect(ehBTGRelatorioPerformance(limpas)).toBe(true);
  });

  it('extrai corretamente metadados da conta, titular, período e total bruto', () => {
    const ext = lerExtratoPdf(linhasPdf);
    expect(ext.inst).toBe('BTG');
    expect(ext.conta).toBe('015270424');
    expect(ext.clienteSugerido).toBe('HOLDINGBRAS-M. PRISON - ADMINISTRACAO LTDA.');
    expect(ext.data).toBe('25/10/2026');
    expect(ext.total).toBeCloseTo(50501711.47, 2);
  });

  it('extrai as 10 posições ativas do Detalhamento dos Ativos', () => {
    const ext = lerExtratoPdf(linhasPdf);
    expect(ext.regs).toHaveLength(10);

    const somaBruto = ext.regs.reduce((acc, r) => acc + (r.bruto || 0), 0);
    expect(somaBruto).toBeCloseTo(50501711.47, 2);

    const somaLiquido = ext.regs.reduce((acc, r) => acc + (r.liquido || 0), 0);
    expect(somaLiquido).toBeCloseTo(49702854.85, 2);
  });

  it('classifica todos os 10 ativos com suas respectivas visões de risco de crédito e estratégias', () => {
    const ext = lerExtratoPdf(linhasPdf);
    const mapa = new Map(ext.regs.map(r => [r.ativo, r]));

    // 1. Kinea Oportunidade -> Corp
    const kinea = mapa.get('KINEA OPORTUNIDADE FIRF CrPr SUBCLASSE I');
    expect(kinea).toBeDefined();
    expect(kinea?.riscoCredito).toBe('Corp');
    expect(kinea?.bruto).toBeCloseTo(6208231.52, 2);

    // 2. MAG Cash -> Banc
    const mag = mapa.get('MAG CASH 10 FIRF CrPr');
    expect(mag).toBeDefined();
    expect(mag?.riscoCredito).toBe('Banc');
    expect(mag?.bruto).toBeCloseTo(5664831.59, 2);

    // 3. MCA II -> Estr
    const mca = mapa.get('MCA II FICFIDC');
    expect(mca).toBeDefined();
    expect(mca?.riscoCredito).toBe('Estr');
    expect(mca?.bruto).toBeCloseTo(5741522.06, 2);

    // 4. Bradesco Zupo -> Banc
    const zupo = mapa.get('BRADESCO ZUPO FICFIRF LP CrPr');
    expect(zupo).toBeDefined();
    expect(zupo?.riscoCredito).toBe('Banc');
    expect(zupo?.bruto).toBeCloseTo(5611991.38, 2);

    // 5. Sparta Top -> Corp
    const sparta = mapa.get('SPARTA TOP FIC RF CrPr LP');
    expect(sparta).toBeDefined();
    expect(sparta?.riscoCredito).toBe('Corp');
    expect(sparta?.bruto).toBeCloseTo(5600812.64, 2);

    // 6. Absolute Creta -> Corp
    const absolute = mapa.get('ABSOLUTE CRETA P FICFIRF CrPr');
    expect(absolute).toBeDefined();
    expect(absolute?.riscoCredito).toBe('Corp');
    expect(absolute?.bruto).toBeCloseTo(5578782.96, 2);

    // 7. BTG Cred Corp -> Corp
    const btgCred = mapa.get('BTG CRED CORP FICFIRF CrPr');
    expect(btgCred).toBeDefined();
    expect(btgCred?.riscoCredito).toBe('Corp');
    expect(btgCred?.bruto).toBeCloseTo(3379197.25, 2);

    // 8. CDB BTG Pactual CDI -> Banc
    const cdbCdi = mapa.get('BANCO BTG PACTUAL S A - CDB-CDBA25FCYXD');
    expect(cdbCdi).toBeDefined();
    expect(cdbCdi?.riscoCredito).toBe('Banc');
    expect(cdbCdi?.estrategia).toBe('Pós-fixado');
    expect(cdbCdi?.vencimento).toBe('01/11/2027');
    expect(cdbCdi?.bruto).toBeCloseTo(5324818.06, 2);

    // 9. CDB BTG Pactual IPCA -> Banc
    const cdbIpca = mapa.get('BANCO BTG PACTUAL S A - CDB-CDBA25FCYXV');
    expect(cdbIpca).toBeDefined();
    expect(cdbIpca?.riscoCredito).toBe('Banc');
    expect(cdbIpca?.estrategia).toBe('Inflação');
    expect(cdbIpca?.vencimento).toBe('30/10/2026');
    expect(cdbIpca?.bruto).toBeCloseTo(4010215.14, 2);

    // 10. Bacen LFT -> Sob
    const lft = mapa.get('BACEN-BANCO CENTRAL DO BRASIL - RJ - LFT');
    expect(lft).toBeDefined();
    expect(lft?.riscoCredito).toBe('Sob');
    expect(lft?.vencimento).toBe('01/03/2029');
    expect(lft?.bruto).toBeCloseTo(3381308.87, 2);
  });
});
