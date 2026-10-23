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
});
