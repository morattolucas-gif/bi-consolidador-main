import * as XLSX from 'xlsx';
import defaultData from './fund-guide-data.json';
import { norm } from '../components/formatters';

export interface FundoGuideItem {
  fundo: string;
  cge?: string;
  cnpj?: string;
  cnpjFormatado?: string;
  categoriaBtg: string;
  subcategoriaBtg: string;
  cvm?: string;
  anbima?: string;
  benchmark?: string;
  gestor?: string;
  administrador?: string;
  classe: string;
  sub: string;
  estrategia: string;
  riscoCredito?: string;
  liquidez?: string;
}

export function cleanNorm(s: string): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function cleanCnpj(c: string): string {
  return String(c || '').replace(/\D+/g, '');
}

const STOPWORDS = new Set([
  'btgp', 'btg', 'pactual', 'itau', 'bradesco', 'santander', 'safra', 'banco',
  'fic', 'fi', 'fim', 'fia', 'firf', 'ficfim', 'ficfia', 'ficfirf', 'fip', 'fidc',
  'cp', 'lp', 'rl', 'credito', 'privado', 'longo', 'prazo', 'responsabilidade',
  'limitada', 'investimento', 'no', 'exterior', 'master', 'access', 'dist',
  'de', 'da', 'do', 'e', 'subclasse', 'i', 'ii', 'iii', 'rf', 'fundo', 'acoes', 'fundo'
]);

function stem(word: string): string {
  if (word.length > 4 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

export function coreTokens(n: string): string[] {
  return cleanNorm(n)
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

export function coreName(n: string): string {
  return coreTokens(n).join(' ');
}

// Mapas internos de busca rápida
let itensAtivos: FundoGuideItem[] = (defaultData as unknown as FundoGuideItem[]) || [];
let mapCnpj = new Map<string, FundoGuideItem>();
let mapNome = new Map<string, FundoGuideItem>();
let mapCore = new Map<string, FundoGuideItem>();
let listaComTokens: { item: FundoGuideItem; tokens: string[]; core: string }[] = [];

function reindexar(itens: FundoGuideItem[]) {
  itensAtivos = itens;
  mapCnpj = new Map();
  mapNome = new Map();
  mapCore = new Map();
  listaComTokens = [];

  for (const item of itens) {
    if (item.cnpj) {
      const c = cleanCnpj(item.cnpj);
      if (c) mapCnpj.set(c, item);
    }
    const n = cleanNorm(item.fundo);
    if (n) mapNome.set(n, item);

    const tokens = coreTokens(item.fundo);
    const core = tokens.join(' ');
    if (core && !mapCore.has(core)) {
      mapCore.set(core, item);
    }
    listaComTokens.push({ item, tokens, core });
  }
}

// Inicializa com a base oficial de 1029 fundos
reindexar(itensAtivos);

export function atualizarFundGuide(novosItens: FundoGuideItem[]) {
  if (Array.isArray(novosItens) && novosItens.length > 0) {
    reindexar(novosItens);
  }
}

export function obterTotalFundosGuia(): number {
  return itensAtivos.length;
}

export function obterFundGuideAtual(): FundoGuideItem[] {
  return itensAtivos;
}

export function buscarFundoGuia(termoOuNome: string, cnpj?: string): FundoGuideItem | null {
  // 1. Busca por CNPJ informado explicitamente
  if (cnpj) {
    const cClean = cleanCnpj(cnpj);
    if (cClean && mapCnpj.has(cClean)) return mapCnpj.get(cClean)!;
  }

  const s = String(termoOuNome || '').trim();
  if (!s) return null;

  // 2. Se o próprio termo for ou contiver um CNPJ (14 dígitos)
  const possivelCnpj = cleanCnpj(s);
  if (possivelCnpj.length === 14 && mapCnpj.has(possivelCnpj)) {
    return mapCnpj.get(possivelCnpj)!;
  }

  // 3. Busca por Nome Normalizado Exato
  const n = cleanNorm(s);
  if (mapNome.has(n)) return mapNome.get(n)!;

  // 4. Busca por Core Name (sem sufixos/termos genéricos como fic/fim/rl/etc.)
  const tokensBusca = coreTokens(s);
  const coreBusca = tokensBusca.join(' ');
  if (coreBusca && mapCore.has(coreBusca)) {
    return mapCore.get(coreBusca)!;
  }

  // 5. Busca por prefixo/correspondência exata de tokens se tiver ao menos 2 tokens
  if (tokensBusca.length >= 2) {
    // 5.1 Busca item cujo core comece com o coreBusca ou vice-versa
    for (const entry of listaComTokens) {
      if (entry.core.length >= 4 && (entry.core.startsWith(coreBusca) || coreBusca.startsWith(entry.core))) {
        return entry.item;
      }
    }

    // 5.2 Se todos os tokens significativos da busca estiverem presentes no fundo
    for (const entry of listaComTokens) {
      const matchTodos = tokensBusca.every(t => entry.tokens.includes(t));
      if (matchTodos) {
        return entry.item;
      }
    }
  }

  // 6. Se tiver 1 token significativo (>= 3 caracteres)
  if (tokensBusca.length === 1 && tokensBusca[0].length >= 3) {
    const unico = tokensBusca[0];
    for (const entry of listaComTokens) {
      if (entry.tokens.includes(unico)) {
        return entry.item;
      }
    }
  }

  return null;
}

export function classificarRiscoCreditoFundo(nome: string, cat: string, sub: string, gestor?: string): string {
  const w = cleanNorm(nome);

  // Exceções e fundos de crédito conhecidos
  if (/mca\b|fidc/i.test(w) || sub === 'Crédito Estruturado') return 'Estr';
  if (/mag cash|zupo|bancario|pos fixado|di simples|referenciado di|tesouraria/i.test(w)) return 'Banc';
  if (/kinea oportunidade|sparta top|absolute creta|cred corp|plural cred corporativo|high grade|deb incentivada|infra/i.test(w)) return 'Corp';

  if (sub === 'Crédito Estruturado') return 'Estr';
  if (sub === 'Crédito Pós') {
    if (/cash|liquidez|banc|banco/i.test(w)) return 'Banc';
    return 'Corp';
  }

  if (cat === 'Renda Fixa') {
    if (/tesouro|selic|soberano|lft|ltn|ntn|simples/i.test(w)) return 'Sob';
    if (/deb|infra|corp|credito privado|crpr/i.test(w)) return 'Corp';
    if (/banc|banco|cdb|lfs/i.test(w)) return 'Banc';
    return 'Corp';
  }

  if (cat === 'Renda Variável') return 'Acoes';
  if (cat === 'Multimercado' || cat === 'Alocação') return 'MM';
  if (cat === 'Alternativos') {
    if (/cripto/i.test(w) || sub === 'Criptoativo') return 'Cripto';
    if (/imobiliario|fii/i.test(w) || sub === 'Imobiliário') return 'Imob';
    return 'Alt';
  }
  if (cat === 'Cambial' || sub === 'Investimento no Exterior') return 'Intl';

  return 'Outros';
}

export function mapearLinhaFundGuide(r: any): FundoGuideItem {
  const cat = (r['Categoria BTG'] || '').trim();
  const sub = (r['Subcategoria BTG'] || '').trim();
  const cvm = (r['Classificação CVM'] || '').trim();
  const anb = (r['Classificação Anbima'] || '').trim();
  const bench = (r['Benchmark'] || '').trim().toUpperCase();
  const nome = (r['Fundo'] || '').trim();
  const nomeUp = nome.toUpperCase();

  let estr = 'Sem classificação';

  if (cat === 'Multimercado') {
    if (sub === 'Investimento no Exterior') estr = 'Internacional';
    else estr = 'Retorno Absoluto (MM)';
  } else if (cat === 'Renda Variável') {
    estr = 'Renda Variável';
  } else if (cat === 'Alternativos') {
    estr = 'Alternativo';
  } else if (cat === 'Cambial') {
    estr = 'Internacional';
  } else if (cat === 'Alocação') {
    if (sub === 'Investimento no Exterior' || anb.includes('Exterior') || bench === 'DOLAR') estr = 'Internacional';
    else estr = 'Retorno Absoluto (MM)';
  } else if (cat === 'Renda Fixa') {
    if (sub === 'Inflação') estr = 'Inflação';
    else if (sub === 'Pré-fixado') estr = 'Pré-fixado';
    else if (sub === 'Crédito Pós' || sub === 'Pós-fixado' || sub === 'Crédito Estruturado') estr = 'Pós-fixado';
    else if (sub === 'Ativo') {
      if (bench.includes('IMA') || bench.includes('IPCA') || /IPCA|INFLA|IMAB/i.test(nomeUp)) estr = 'Inflação';
      else if (bench.includes('PRE') || bench.includes('IRF') || /PRE/i.test(nomeUp)) estr = 'Pré-fixado';
      else estr = 'Pós-fixado';
    } else {
      if (bench.includes('IMA') || bench.includes('IPCA') || /IPCA|INFLA|IMAB/i.test(nomeUp)) estr = 'Inflação';
      else if (bench.includes('PRE') || /PRE/i.test(nomeUp)) estr = 'Pré-fixado';
      else estr = 'Pós-fixado';
    }
  } else {
    // Outros / Categoria BTG vazia
    if (cvm === 'Renda Fixa' || anb.includes('RF') || /FIRF|RF/i.test(nomeUp)) {
      if (bench.includes('IMA') || bench.includes('IPCA') || /IPCA|INFLA|IMAB/i.test(nomeUp)) estr = 'Inflação';
      else if (bench.includes('PRE') || /PRE/i.test(nomeUp)) estr = 'Pré-fixado';
      else estr = 'Pós-fixado';
    } else if (cvm === 'Ações' || anb.includes('Ações') || /FIA/i.test(nomeUp)) {
      estr = 'Renda Variável';
    } else if (cvm === 'Multimercados' || anb.includes('Multimercado') || /FIM/i.test(nomeUp)) {
      estr = 'Retorno Absoluto (MM)';
    } else if (cvm === 'Cambial' || anb.includes('Cambial')) {
      estr = 'Internacional';
    }
  }

  let subClasse = 'FN';
  let classe = 'Fundos';
  if (/ FII |FUNDO IMOBILIARIO|SHOPPING|LOGISTICA|LAJES CORPORATIVAS/i.test(' ' + nomeUp + ' ') || sub === 'Imobiliário') {
    classe = 'Renda Variável';
    subClasse = 'FII';
    estr = 'Alternativo';
  } else if (/PREVIDENCIA|PREV|VGBL|PGBL/i.test(nomeUp)) {
    classe = 'Previdência';
    subClasse = 'PP';
  }

  const rawCnpj = r['CNPJ'] ? String(r['CNPJ']).trim() : '';

  let liq: string | undefined;
  for (const k of Object.keys(r)) {
    const nk = norm(k);
    if ((nk.includes('liquidez') || nk.includes('resgate') || nk.includes('cotizacao')) && !nk.includes('horario')) {
      const v = String(r[k] || '').trim();
      if (v) {
        liq = v;
        break;
      }
    }
  }

  return {
    fundo: nome,
    cge: r['CGE'] ? String(r['CGE']).trim() : undefined,
    cnpj: cleanCnpj(rawCnpj) || undefined,
    cnpjFormatado: rawCnpj || undefined,
    categoriaBtg: cat || 'Fundos',
    subcategoriaBtg: sub || '-',
    cvm: cvm || undefined,
    anbima: anb || undefined,
    benchmark: r['Benchmark'] || undefined,
    gestor: r['Gestão'] || undefined,
    administrador: r['Administrador'] || undefined,
    classe,
    sub: subClasse,
    estrategia: estr,
    riscoCredito: classificarRiscoCreditoFundo(nome, cat, sub, r['Gestão']),
    liquidez: liq || (r['Liquidez'] ? String(r['Liquidez']).trim() : undefined)
  };
}

export function ehFundGuideExcel(wb: XLSX.WorkBook): boolean {
  for (const s of wb.SheetNames) {
    if (/fundguide|plataforma aberta/i.test(norm(s))) return true;
    const sheet = wb.Sheets[s];
    if (!sheet) continue;
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
    for (const r of rows.slice(0, 10)) {
      const line = (r || []).map(c => norm(String(c)));
      const temFundo = line.some(c => c === 'fundo' || c === 'nome do fundo');
      const temCnpj = line.some(c => c === 'cnpj');
      const temCatBtg = line.some(c => c.includes('categoria btg'));
      if (temFundo && (temCnpj || temCatBtg)) return true;
    }
  }
  return false;
}

export function lerFundGuideExcel(wb: XLSX.WorkBook): FundoGuideItem[] {
  const itens: FundoGuideItem[] = [];

  for (const s of wb.SheetNames) {
    const sheet = wb.Sheets[s];
    if (!sheet) continue;
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);
    if (!rows.length) continue;

    // Confere se as linhas têm Fundo e Categoria BTG ou CNPJ
    const r0 = rows[0] || {};
    const keys = Object.keys(r0).map(norm);
    if (keys.some(k => k === 'fundo') && keys.some(k => k.includes('categoria btg') || k === 'cnpj')) {
      for (const r of rows) {
        if (!r['Fundo']) continue;
        itens.push(mapearLinhaFundGuide(r));
      }
      if (itens.length > 0) break;
    }
  }

  return itens;
}
