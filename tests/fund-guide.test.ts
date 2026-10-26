import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buscarFundoGuia,
  ehFundGuideExcel,
  lerFundGuideExcel,
  obterTotalFundosGuia
} from '../src/parsers/fund-guide';
import { classificar } from '../src/parsers/classification';

describe('Fund Guide BTG - Classificação Oficial de Fundos e Estratégias', () => {
  it('contém a base oficial pré-carregada com mais de 1000 fundos', () => {
    const total = obterTotalFundosGuia();
    expect(total).toBeGreaterThanOrEqual(1029);
  });

  it('encontra fundos pelo CNPJ oficial com e sem pontuação', () => {
    // 3R Genus Hedge FIM RL: 22.232.929/0001-89
    const fundoPontuado = buscarFundoGuia('22.232.929/0001-89');
    expect(fundoPontuado).not.toBeNull();
    expect(fundoPontuado?.fundo).toBe('3R Genus Hedge FIM RL');
    expect(fundoPontuado?.estrategia).toBe('Retorno Absoluto (MM)');

    const fundoLimpo = buscarFundoGuia('22232929000189');
    expect(fundoLimpo).not.toBeNull();
    expect(fundoLimpo?.fundo).toBe('3R Genus Hedge FIM RL');
  });

  it('classifica fundos pelo nome exato ou variações de sufixo (FIC / FIM / RL)', () => {
    const f1 = buscarFundoGuia('4UM Marlim Dividendos FIA RL');
    expect(f1).not.toBeNull();
    expect(f1?.estrategia).toBe('Renda Variável');
    expect(f1?.subcategoriaBtg).toBe('Long Only');

    // Variação comum em extratos sem o "RL" ou com "FIC FIA"
    const f2 = buscarFundoGuia('4UM MARLIM DIVIDENDOS FIC FIA');
    expect(f2).not.toBeNull();
    expect(f2?.fundo).toBe('4UM Marlim Dividendos FIA RL');
    expect(f2?.estrategia).toBe('Renda Variável');
  });

  it('classifica fundos de Renda Fixa de acordo com a Subcategoria BTG oficial (Crédito Pós, Inflação, etc.)', () => {
    // A1 CP D30 FICFIRF LP CrPr RL -> Crédito Pós -> Pós-fixado
    const a1 = buscarFundoGuia('A1 CP D30 FICFIRF LP CrPr RL');
    expect(a1).not.toBeNull();
    expect(a1?.estrategia).toBe('Pós-fixado');
    expect(a1?.categoriaBtg).toBe('Renda Fixa');

    // A1 CP Deb Incentivadas Infra FICFIRF CrPr RL -> Inflação
    const a1Infra = buscarFundoGuia('A1 CP Deb Incentivadas Infra FICFIRF CrPr RL');
    expect(a1Infra).not.toBeNull();
    expect(a1Infra?.estrategia).toBe('Inflação');
  });

  it('classifica fundos de Investimento no Exterior / Cambial', () => {
    // BTG Autoinvest Global Balanced USD FIM -> Alocação / Exterior -> Internacional
    const btgGlobal = buscarFundoGuia('BTG Autoinvest Global Balanced USD FIM');
    expect(btgGlobal).not.toBeNull();
    expect(btgGlobal?.estrategia).toBe('Internacional');
  });

  it('reconhece a planilha FundGuide_175_20261026.xlsx via ehFundGuideExcel e faz a leitura', () => {
    const wb = XLSX.readFile('FundGuide_175_20261026.xlsx');
    expect(ehFundGuideExcel(wb)).toBe(true);

    const itens = lerFundGuideExcel(wb);
    expect(itens.length).toBeGreaterThanOrEqual(1029);
    expect(itens[0].fundo).toBe('3R Genus Hedge FIM RL');
    expect(itens[0].estrategia).toBe('Retorno Absoluto (MM)');
  });

  it('integração direta com a função classificar() priorizando o Fund Guide', () => {
    const res = classificar('4UM Marlim Dividendos FIA RL');
    expect(res.classe).toBe('Fundos');
    expect(res.sub).toBe('FN');
    expect(res.estr).toBe('Renda Variável');
    expect((res as any).guia?.categoriaBtg).toBe('Renda Variável');
    expect((res as any).guia?.subcategoriaBtg).toBe('Long Only');
  });

  it('reconhece a visão de risco de crédito solicitada para fundos e ativos específicos', () => {
    // 1. Kinea Oportunidades -> Crédito Privado Corporativo (Corp)
    const kinea = classificar('Kinea Oportunidades');
    expect(kinea.riscoCredito).toBe('Corp');

    // 2. MAG CASH 10 FIRF CrPr -> Crédito Bancário (Banc)
    const magCash = classificar('MAG CASH 10 FIRF CrPr');
    expect(magCash.riscoCredito).toBe('Banc');

    // 3. MCA II -> Crédito Estruturado (Estr)
    const mca = classificar('MCA II');
    expect(mca.riscoCredito).toBe('Estr');

    // 4. Bradesco Zupo -> Crédito Bancário (Banc)
    const zupo = classificar('Bradesco Zupo');
    expect(zupo.riscoCredito).toBe('Banc');

    // 5. SPARTA TOP FIC RF CrPr LP -> Crédito Privado Corporativo (Corp)
    const sparta = classificar('SPARTA TOP FIC RF CrPr LP');
    expect(sparta.riscoCredito).toBe('Corp');

    // 6. ABSOLUTE CRETA P FICFIRF CrPr -> Crédito Privado Corporativo (Corp)
    const creta = classificar('ABSOLUTE CRETA P FICFIRF CrPr');
    expect(creta.riscoCredito).toBe('Corp');

    // 7. BTG CRED CORP FICFIRF CrPr -> Crédito Privado Corporativo (Corp)
    const btgCredCorp = classificar('BTG CRED CORP FICFIRF CrPr');
    expect(btgCredCorp.riscoCredito).toBe('Corp');

    // 8. BANCO BTG PACTUAL S.A. — CDB CDI (CDBA25FCYXD) -> Crédito Bancário (Banc)
    const cdbCdi = classificar('BANCO BTG PACTUAL S.A. — CDB CDI (CDBA25FCYXD)');
    expect(cdbCdi.riscoCredito).toBe('Banc');

    // 9. BANCO BTG PACTUAL S.A. — CDB IPCA + 10,07% (CDBA25FCYXV) -> Crédito Bancário (Banc)
    const cdbIpca = classificar('BANCO BTG PACTUAL S.A. — CDB IPCA + 10,07% (CDBA25FCYXV)');
    expect(cdbIpca.riscoCredito).toBe('Banc');
  });
});
