import * as XLSX from 'xlsx';
import { norm, numero } from '../components/formatters';
import { texto } from './btg';
import { classificar } from './classification';
import type { ExtratoLido, ExtratoRegistro } from '../types';

export const COLUNAS_PADRAO = [
  'Instituição', 'Conta', 'Cliente', 'Classe', 'Subclasse', 'Estratégia',
  'Ativo', 'Emissor', 'Vencimento', 'Taxa', 'Quantidade', 'Valor Bruto', 'Valor Líquido'
];

export function lerExcelPadrao(buffer: ArrayBuffer): ExtratoLido {
  const wb = XLSX.read(buffer, { type: 'array' });
  const matriz: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
  const iCab = matriz.slice(0, 15).findIndex(l => (l || []).map(norm).includes('valor bruto') && (l || []).map(norm).includes('ativo'));
  if (iCab < 0) throw new Error('Este Excel não está no formato do BTG nem no Excel padrão. Use o botão "Modelo Excel" para baixar o modelo.');

  const cab = matriz[iCab].map(norm);
  const col = (nome: string) => cab.indexOf(norm(nome));
  const val = (l: any[], nome: string) => col(nome) >= 0 ? l[col(nome)] : null;
  const regs: ExtratoRegistro[] = [];
  let inst = '', conta = '', cliente: string | null = null;

  for (const l of matriz.slice(iCab + 1)) {
    const bruto = numero(val(l, 'Valor Bruto'));
    const ativo = texto(val(l, 'Ativo'));
    if (bruto === null || !ativo) continue;
    inst = inst || texto(val(l, 'Instituição')) || '';
    conta = conta || String(texto(val(l, 'Conta')) || '');
    cliente = cliente || texto(val(l, 'Cliente'));
    const auto = classificar(ativo, { categoria: texto(val(l, 'Classe')) || '' });
    regs.push({
      mercado: texto(val(l, 'Classe')) || auto.classe,
      sub: texto(val(l, 'Subclasse')) || auto.sub,
      ativo,
      produto: ativo,
      emissor: texto(val(l, 'Emissor')) || undefined,
      vencimento: val(l, 'Vencimento'),
      estrategia: texto(val(l, 'Estratégia')) || auto.estr,
      taxaCompra: numero(val(l, 'Taxa')) || undefined,
      quantidade: numero(val(l, 'Quantidade')) || undefined,
      bruto,
      liquido: numero(val(l, 'Valor Líquido')) ?? bruto
    });
  }

  if (!regs.length) throw new Error('O Excel padrão foi lido, mas não tem nenhuma linha com Ativo e Valor Bruto.');
  return { inst, conta, clienteSugerido: cliente, data: null, total: null, regs, avisos: [] };
}

export function baixarModelo() {
  const ws = XLSX.utils.aoa_to_sheet([
    COLUNAS_PADRAO,
    ['Itaú', '12345-6', 'Nome do Cliente', 'Renda Fixa', 'BANCARIO', 'Pós-fixado', 'CDB', 'BANCO ITAU', '15/08/2028', 102, 1, 50000, 49500],
    ['Itaú', '12345-6', 'Nome do Cliente', 'Fundos', 'FN', 'Retorno Absoluto (MM)', 'FUNDO MULTIMERCADO X FIC FIM', '', '', '', 1000, 30000, 29800]
  ]);
  ws['!cols'] = COLUNAS_PADRAO.map(c => ({ wch: Math.max(12, c.length + 4) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Posição');
  XLSX.writeFile(wb, 'modelo_extrato_outras_instituicoes.xlsx');
}
