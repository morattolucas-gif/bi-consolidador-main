import * as XLSX from 'xlsx';
import { norm } from '../components/formatters';
import type { BaseBtgConta } from '../types';

export function ehBaseBtgExcel(wb: XLSX.WorkBook): boolean {
  for (const s of wb.SheetNames) {
    const sheet = wb.Sheets[s];
    if (!sheet) continue;
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
    for (const r of rows.slice(0, 20)) {
      const line = (r || []).map(c => norm(String(c)));
      const temConta = line.some(c => c === 'conta' || c.includes('numero da conta') || c.includes('num conta'));
      const temPl = line.some(c => c.includes('pl total') || c === 'pl' || c.includes('faixa cliente') || c.includes('pl declarado'));
      const temTipo = line.some(c => c === 'tipo' || c.includes('tipo parceiro') || c.includes('tipo investidor') || c.includes('tipo pessoa') || c.includes('tipo de'));
      if (temConta && temPl && temTipo) return true;
    }
  }
  return false;
}

function parseNum(v: any): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  if (!v) return 0;
  const s = String(v).trim().replace(/R\$\s*/g, '');
  if (!s || s === '-') return 0;
  // Trata formato brasileiro 1.234,56 ou americano 1234.56
  if (s.includes(',') && s.includes('.')) {
    return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
  }
  if (s.includes(',')) {
    return Number(s.replace(',', '.')) || 0;
  }
  return Number(s) || 0;
}

export function lerBaseBtgExcel(wb: XLSX.WorkBook): BaseBtgConta[] {
  const contas: BaseBtgConta[] = [];

  for (const s of wb.SheetNames) {
    const sheet = wb.Sheets[s];
    if (!sheet) continue;
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    if (!rows.length) continue;

    const iCab = rows.slice(0, 15).findIndex(r => {
      const line = (r || []).map(c => norm(String(c ?? '')));
      return line.includes('conta') && line.some(c => c.includes('pl total') || c.includes('faixa cliente'));
    });
    if (iCab < 0) continue;

    const cabBruto = rows[iCab].map(c => String(c ?? '').trim());
    const cab = cabBruto.map(norm);

    const colConta = cab.indexOf('conta');
    const colNome = cab.indexOf('nome');
    const colTipo = cab.indexOf('tipo');
    const colPl = cab.findIndex(c => c.includes('pl total') || c === 'pl');
    const colAssessor = cab.indexOf('assessor');
    const colStatus = cab.findIndex(c => c.includes('status ranking') || c === 'status');
    const colTipoInv = cab.findIndex(c => c.includes('tipo investidor'));
    const colIdCli = cab.findIndex(c => c.includes('id cliente'));
    const colFaixaBtg = cab.findIndex(c => c.includes('faixa cliente'));
    const colCidade = cab.indexOf('cidade');
    const colEstado = cab.indexOf('estado');
    const colDataAbertura = cab.findIndex(c => c.includes('data de abertura'));

    for (const r of rows.slice(iCab + 1)) {
      if (!r) continue;
      const contaVal = r[colConta];
      if (contaVal === null || contaVal === undefined || String(contaVal).trim() === '') continue;

      const rawTipo = String(r[colTipo] ?? '').toUpperCase().trim();
      let tipo: 'PF' | 'PJ' | 'Estrangeiro' | 'Outro' = 'Outro';
      if (rawTipo === 'PF' || rawTipo.startsWith('PESSOA FISICA')) tipo = 'PF';
      else if (rawTipo === 'PJ' || rawTipo.startsWith('PESSOA JURIDICA')) tipo = 'PJ';
      else if (/ESTRANG|EXTERNO|CC5|CNR|NAO RESIDENTE|NÃO RESIDENTE/i.test(rawTipo)) tipo = 'Estrangeiro';

      contas.push({
        conta: String(contaVal).trim(),
        nome: String(r[colNome] ?? '').trim(),
        tipo,
        plTotal: colPl >= 0 ? parseNum(r[colPl]) : 0,
        assessor: colAssessor >= 0 ? String(r[colAssessor] ?? '').trim() : '',
        status: colStatus >= 0 ? String(r[colStatus] ?? '').trim() : 'Ativa',
        tipoInvestidor: colTipoInv >= 0 ? String(r[colTipoInv] ?? '').trim() : '',
        idCliente: colIdCli >= 0 && r[colIdCli] ? String(r[colIdCli]).trim() : undefined,
        faixaBtg: colFaixaBtg >= 0 && r[colFaixaBtg] ? String(r[colFaixaBtg]).trim() : undefined,
        cidade: colCidade >= 0 && r[colCidade] ? String(r[colCidade]).trim() : undefined,
        estado: colEstado >= 0 && r[colEstado] ? String(r[colEstado]).trim() : undefined,
        dataAbertura: colDataAbertura >= 0 && r[colDataAbertura] ? String(r[colDataAbertura]).trim() : undefined
      });
    }

    if (contas.length > 0) break; // achou a aba principal
  }

  return contas;
}
