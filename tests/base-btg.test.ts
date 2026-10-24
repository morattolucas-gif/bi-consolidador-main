import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { ehBaseBtgExcel, lerBaseBtgExcel } from '../src/parsers/base-btg';

describe('Parser Base BTG (Export / CRM / Plano de Negócio)', () => {
  it('reconhece a planilha da Base BTG pelos cabeçalhos', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Conta', 'Nome', 'Assessor', 'Tipo', 'PL Total', 'Status Ranking', 'Tipo Investidor'],
      ['1001', 'Cliente Alfa Silva', 'Assessor 1', 'PF', 150000, 'Ativa', 'Qualificado'],
      ['1002', 'Holding Beta Participações Ltda', 'Assessor 2', 'PJ', 350000, 'Ativa', 'Profissional'],
      ['1003', 'John Doe External', 'Assessor 1', 'INVESTIDOR ESTRANG EXTERNO - CC5', 250000, 'Inativa', 'Nao Qualificado'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Export');

    expect(ehBaseBtgExcel(wb)).toBe(true);
  });

  it('lê e segmenta corretamente PF, PJ e Estrangeiro com valores de PL', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Conta', 'Nome', 'Assessor', 'Tipo', 'PL Total', 'Status Ranking', 'Tipo Investidor', 'Cidade', 'Estado'],
      ['0001', 'Carlos da Silva', 'Lucas', 'PF', '150.000,00', 'Ativa', 'Qualificado', 'São Paulo', 'SP'],
      ['0002', 'Alfa Holding Ltda', 'Lucas', 'PJ', '320.000,00', 'Ativa', 'Profissional', 'Campinas', 'SP'],
      ['0003', 'Foreign Corp', 'Marcos', 'INVESTIDOR NÃO RESIDENTE - CNR', '450.000,00', 'Ativa', 'Qualificado', 'Miami', 'FL'],
      ['0004', 'Conta Zerada', 'Lucas', 'PF', '0,00', 'Inativa', 'Nao Qualificado', 'Santos', 'SP'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Export');

    const contas = lerBaseBtgExcel(wb);
    expect(contas).toHaveLength(4);

    expect(contas[0].tipo).toBe('PF');
    expect(contas[0].plTotal).toBe(150000);
    expect(contas[0].status).toBe('Ativa');

    expect(contas[1].tipo).toBe('PJ');
    expect(contas[1].plTotal).toBe(320000);

    expect(contas[2].tipo).toBe('Estrangeiro');
    expect(contas[2].plTotal).toBe(450000);

    expect(contas[3].plTotal).toBe(0);
    expect(contas[3].status).toBe('Inativa');
  });

  it('não confunde extrato consolidado de posições com a Base BTG', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Conta', 'Nome', 'Mercado', 'Sub mercado', 'Ativo', 'Valor Bruto', 'Valor Liquido'],
      ['1001', 'Cliente', 'Renda Fixa', 'CDB', 'CDB BTG', 50000, 50000],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Posições');

    expect(ehBaseBtgExcel(wb)).toBe(false);
  });

  it('garante que a Base BTG com coluna Carteira Administrada não seja capturada por ehPoliticasExcel', async () => {
    const { ehPoliticasExcel } = await import('../src/parsers/politicas-excel');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Conta', 'Nome', 'Assessor', 'Tipo Parceiro', 'Carteira Administrada', 'Tipo', 'PL Total', 'Status Ranking'],
      ['1001', 'Cliente Alfa', 'Assessor 1', 'AAI', 'Sim', 'PF', 150000, 'Ativa'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Export');

    expect(ehBaseBtgExcel(wb)).toBe(true);
    expect(ehPoliticasExcel(wb)).toBe(false);
  });

  it('calcula corretamente a receita e evolução do simulador (0,75% a.a. PF e 0,30% a.a. PJ em 6 meses)', async () => {
    const { calcularSimulacaoPlano } = await import('../src/components/views/base-clientes');
    const { S } = await import('../src/domain/state');

    S.simuladorPlano = {
      prazoMeses: 6,
      taxaPfAa: 0.75,
      taxaPjAa: 0.30,
      faixasSelecionadas: ['100 a 500 mil'],
      excluirEstrangeiros: true,
      assessorSel: '',
      subAba: 'evolucao'
    };

    const itensMock: any[] = [
      { chave: '1', conta: '1', contas: ['1'], nome: 'PF 1', tipo: 'PF', plTotal: 200000, assessor: 'Assessor A', status: 'Ativa', tipoInvestidor: 'Geral' },
      { chave: '2', conta: '2', contas: ['2'], nome: 'PJ 1', tipo: 'PJ', plTotal: 400000, assessor: 'Assessor A', status: 'Ativa', tipoInvestidor: 'Geral' },
      { chave: '3', conta: '3', contas: ['3'], nome: 'Estrangeiro', tipo: 'Estrangeiro', plTotal: 300000, assessor: 'Assessor B', status: 'Ativa', tipoInvestidor: 'Estrangeiro' },
      { chave: '4', conta: '4', contas: ['4'], nome: 'PF 500k-1M', tipo: 'PF', plTotal: 600000, assessor: 'Assessor B', status: 'Ativa', tipoInvestidor: 'Geral' },
    ];

    const res = calcularSimulacaoPlano(itensMock);

    expect(res.totalContas).toBe(2); // PF 1 e PJ 1 (estrangeiro excluído, PF 500k-1M está na faixa seguinte)
    expect(res.pfContas).toBe(1);
    expect(res.pjContas).toBe(1);
    expect(res.totalPl).toBe(600000);

    // Taxa PF = 0.75% / 12 = 0.000625. Receita PF = 200.000 * 0.000625 = 125
    expect(res.receitaPfMensalPlena).toBeCloseTo(125, 2);
    // Taxa PJ = 0.30% / 12 = 0.00025. Receita PJ = 400.000 * 0.00025 = 100
    expect(res.receitaPjMensalPlena).toBeCloseTo(100, 2);
    // Total mensal pleno = 225
    expect(res.receitaMensalPlena).toBeCloseTo(225, 2);
    // Anual = 225 * 12 = 2700
    expect(res.receitaAnualPlena).toBeCloseTo(2700, 2);

    // 6 meses de evolução
    expect(res.evolucaoMeses.length).toBe(6);
    expect(res.evolucaoMeses[5].receitaTotal).toBeCloseTo(225, 2);

    // Agora adiciona a faixa '500 mil a 1 mi' para testar a SOMA das faixas
    S.simuladorPlano.faixasSelecionadas = ['100 a 500 mil', '500 mil a 1 mi'];
    const resSoma = calcularSimulacaoPlano(itensMock);
    expect(resSoma.totalContas).toBe(3); // 2 de antes + PF 500k-1M (600k)
    expect(resSoma.pfContas).toBe(2);
    expect(resSoma.totalPl).toBe(1200000); // 600k + 600k
    // Receita PF adicional: 600.000 * 0.000625 = 375. Total PF = 125 + 375 = 500
    expect(resSoma.receitaPfMensalPlena).toBeCloseTo(500, 2);
    expect(resSoma.receitaMensalPlena).toBeCloseTo(600, 2); // 500 PF + 100 PJ
  });
});
