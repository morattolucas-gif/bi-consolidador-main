import * as XLSX from 'xlsx';
import { norm, chaveConta } from '../components/formatters';
import { POLITICA_PADRAO, CLASSES_EST, RISCO_CREDITO } from '../domain/constants';
import type { PoliticaInvestimento } from '../types';

export function ehPoliticasExcel(wb: XLSX.WorkBook): boolean {
  const abas = wb.SheetNames.map(norm);
  if (abas.some(a => a.includes('politica') || a.includes('classes estrategicas') || a.includes('risco credito') || a.includes('alocacao alvo'))) {
    return true;
  }
  for (const s of wb.SheetNames) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[s], { header: 1, raw: true, defval: '' });
    for (const r of rows.slice(0, 10)) {
      const line = (r || []).map(c => norm(String(c)));
      if (line.includes('conta') && (line.some(c => c.includes('alvo') || c.includes('min') || c.includes('max')) || line.some(c => c.includes('pos') || c.includes('infl')))) {
        return true;
      }
    }
  }
  return false;
}

export function lerPoliticasExcel(wb: XLSX.WorkBook): Map<string, PoliticaInvestimento> {
  const mapa = new Map<string, PoliticaInvestimento>();
  for (const nomeAba of wb.SheetNames) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[nomeAba], { header: 1, raw: true, defval: null });
    if (!rows.length) continue;
    const iCab = rows.slice(0, 15).findIndex(r => {
      const line = (r || []).map(norm);
      return line.includes('conta') && line.some(c => c.includes('alvo') || c.includes('min') || c.includes('max') || c.includes('pos') || c.includes('classe'));
    });
    if (iCab < 0) continue;
    const cab = rows[iCab].map(norm);
    const colConta = cab.indexOf('conta');
    if (colConta < 0) continue;

    const isVertical = cab.includes('categoria') || cab.includes('classe') || cab.includes('tipo') || cab.includes('item');

    for (const row of rows.slice(iCab + 1)) {
      if (!row || row[colConta] === null || row[colConta] === undefined || String(row[colConta]).trim() === '') continue;
      const conta = chaveConta(String(row[colConta]).trim());
      if (!conta) continue;

      let pol = mapa.get(conta);
      if (!pol) {
        pol = {
          conta,
          nome: `Política Conta ${conta}`,
          classes: JSON.parse(JSON.stringify(POLITICA_PADRAO.classes)),
          credito: JSON.parse(JSON.stringify(POLITICA_PADRAO.credito))
        };
        mapa.set(conta, pol);
      }

      const parsePct = (v: any) => {
        if (v === null || v === undefined) return null;
        if (typeof v === 'number') return v > 1 ? v / 100 : v;
        const n = Number(String(v).replace('%', '').replace(',', '.').trim());
        return isNaN(n) ? null : (n > 1 ? n / 100 : n);
      };

      if (isVertical) {
        const colCat = cab.findIndex(c => c === 'categoria' || c === 'classe' || c === 'tipo' || c === 'item');
        const colMin = cab.findIndex(c => c.startsWith('min'));
        const colAlvo = cab.findIndex(c => c.startsWith('alvo'));
        const colMax = cab.findIndex(c => c.startsWith('max'));
        const catStr = norm(row[colCat]);
        const minVal = parsePct(row[colMin]), alvoVal = parsePct(row[colAlvo]), maxVal = parsePct(row[colMax]);

        for (const [k, nomeCl] of Object.entries(CLASSES_EST)) {
          if (catStr === norm(k) || catStr.includes(norm(k)) || catStr.includes(norm(nomeCl.split(' ')[0]))) {
            if (minVal !== null) pol.classes[k].min = minVal;
            if (alvoVal !== null) pol.classes[k].alvo = alvoVal;
            if (maxVal !== null) pol.classes[k].max = maxVal;
          }
        }
        for (const [k, nomeCr] of Object.entries(RISCO_CREDITO)) {
          if (catStr === norm(k) || catStr.includes(norm(k)) || catStr.includes(norm(nomeCr.split(' ')[0]))) {
            if (minVal !== null) pol.credito[k].min = minVal;
            if (alvoVal !== null) pol.credito[k].alvo = alvoVal;
            if (maxVal !== null) pol.credito[k].max = maxVal;
          }
        }
      } else {
        cab.forEach((colName, idx) => {
          const val = parsePct(row[idx]);
          if (val === null) return;
          for (const k of Object.keys(pol!.classes)) {
            const kn = norm(k);
            if (colName.includes(kn)) {
              if (colName.includes('min')) pol!.classes[k].min = val;
              else if (colName.includes('alvo')) pol!.classes[k].alvo = val;
              else if (colName.includes('max')) pol!.classes[k].max = val;
            }
          }
          for (const k of Object.keys(pol!.credito)) {
            const kn = norm(k);
            if (colName.includes(kn)) {
              if (colName.includes('min')) pol!.credito[k].min = val;
              else if (colName.includes('alvo')) pol!.credito[k].alvo = val;
              else if (colName.includes('max')) pol!.credito[k].max = val;
            }
          }
        });
      }
    }
  }
  return mapa;
}

export function baixarModeloPoliticaExcel() {
  const wb = XLSX.utils.book_new();

  // Aba 1: Classes Estratégicas
  const dadosClasses = [
    ['Conta', 'Perfil', 'Pos_Min', 'Pos_Alvo', 'Pos_Max', 'Infl_Min', 'Infl_Alvo', 'Infl_Max', 'Pre_Min', 'Pre_Alvo', 'Pre_Max', 'Acoes_Min', 'Acoes_Alvo', 'Acoes_Max', 'FII_Min', 'FII_Alvo', 'FII_Max', 'Alt_Min', 'Alt_Alvo', 'Alt_Max', 'Intl_Min', 'Intl_Alvo', 'Intl_Max', 'Caixa_Min', 'Caixa_Alvo', 'Caixa_Max'],
    ['123456', 'Moderado Exemplo', 0.10, 0.20, 0.35, 0.15, 0.25, 0.40, 0.00, 0.05, 0.10, 0.05, 0.10, 0.15, 0.05, 0.10, 0.15, 0.00, 0.05, 0.10, 0.05, 0.10, 0.15, 0.02, 0.05, 0.10],
    ['789012', 'Arrojado Exemplo', 0.05, 0.15, 0.25, 0.10, 0.20, 0.30, 0.00, 0.05, 0.10, 0.10, 0.20, 0.30, 0.05, 0.15, 0.20, 0.05, 0.10, 0.15, 0.05, 0.15, 0.20, 0.02, 0.05, 0.08]
  ];
  const wsClasses = XLSX.utils.aoa_to_sheet(dadosClasses);
  XLSX.utils.book_append_sheet(wb, wsClasses, 'Classes_Estrategicas');

  // Aba 2: Risco de Crédito
  const dadosCredito = [
    ['Conta', 'Soberano_Min', 'Soberano_Alvo', 'Soberano_Max', 'Bancario_Min', 'Bancario_Alvo', 'Bancario_Max', 'Corporativo_Min', 'Corporativo_Alvo', 'Corporativo_Max', 'Estruturado_Min', 'Estruturado_Alvo', 'Estruturado_Max', 'Tijolo_Min', 'Tijolo_Alvo', 'Tijolo_Max', 'Societarias_Min', 'Societarias_Alvo', 'Societarias_Max'],
    ['123456', 0.20, 0.35, 0.50, 0.10, 0.20, 0.30, 0.05, 0.15, 0.25, 0.00, 0.05, 0.10, 0.05, 0.10, 0.20, 0.00, 0.05, 0.10],
    ['789012', 0.10, 0.25, 0.40, 0.10, 0.20, 0.30, 0.05, 0.15, 0.25, 0.00, 0.05, 0.10, 0.05, 0.10, 0.15, 0.00, 0.05, 0.10]
  ];
  const wsCredito = XLSX.utils.aoa_to_sheet(dadosCredito);
  XLSX.utils.book_append_sheet(wb, wsCredito, 'Risco_Credito');

  // Aba 3: Instruções LGPD
  const dadosAjuda = [
    ['Instruções e Conformidade LGPD'],
    ['1. Este arquivo associa parâmetros de política de investimento EXCLUSIVAMENTE ao número da Conta (ou código da família).'],
    ['2. Para não ferir a LGPD, NUNCA inclua dados pessoais como Nome Completo, CPF, Telefone ou E-mail nesta planilha.'],
    ['3. Os percentuais podem ser informados como números decimais (ex: 0.15) ou com o símbolo % (ex: 15%).'],
    ['4. Para carregar no B.I., basta arrastar esta planilha para o painel ou clicar no botão "Políticas" > "Importar Planilha".']
  ];
  const wsAjuda = XLSX.utils.aoa_to_sheet(dadosAjuda);
  XLSX.utils.book_append_sheet(wb, wsAjuda, 'Instrucoes_LGPD');

  XLSX.writeFile(wb, 'politica_investimentos_modelo.xlsx');
}
