import * as XLSX from 'xlsx';
import { norm, numero, dataBR } from '../components/formatters';
import { classificar } from './classification';
import type { Posicao, ExtratoLido, ExtratoRegistro } from '../types';

export const COLUNAS: Record<string, string> = {
  'conta': 'conta', 'nome': 'nome', 'mercado': 'mercado', 'sub mercado': 'sub', 'ativo': 'ativo',
  'produto': 'produto', 'cnpj': 'cnpj', 'emissor': 'emissor', 'data compra': 'dataCompra',
  'taxa compra': 'taxaCompra', 'taxa emissao': 'taxaEmissao', 'vencimento': 'vencimento',
  'quantidade': 'quantidade', 'valor bruto': 'bruto', 'ir': 'ir', 'iof': 'iof',
  'valor liquido': 'liquido', 'estrategia': 'estrategia', 'data': 'data', 'tipo plano': 'tipoPlano',
  'grupo': 'grupo', 'grupo familiar': 'grupo', 'familia': 'grupo',
};
export const OBRIGATORIAS = ['conta', 'nome', 'mercado', 'sub mercado', 'valor bruto'];

export const ESTRATEGIA_PADRAO: Record<string, string> = {
  'conta corrente': 'Caixa',
  'valor em transito': 'Valores a receber',
  'valores em transito': 'Valores a receber',
  'criptoativos': 'Cripto',
  'derivativos': 'Derivativos',
  'internacional': 'Internacional'
};

export function texto(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' || s === '-' ? null : s;
}

export function data(v: any): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === 'number') {
    const p = (XLSX as any).SSF.parse_date_code(v);
    return p ? new Date(p.y, p.m - 1, p.d) : null;
  }
  const s = texto(v);
  if (!s) return null;
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}

export function conta(v: any): string | null {
  if (typeof v === 'number') return String(Math.round(v)).padStart(9, '0');
  return texto(v);
}

// Nome legível do ativo: o BTG usa colunas diferentes conforme o mercado
export function nomeDoAtivo(p: Partial<Posicao>): string {
  const m = norm(p.classe);
  if (['renda variavel', 'criptoativos', 'coe'].includes(m) && p.ativo) return p.ativo;
  if (m === 'renda fixa') {
    const venc = p.vencimento ? dataBR(p.vencimento) : 's/ venc.';
    if (['titulo publico', 'tesouro direto'].includes(norm(p.subclasse))) return `${p.produto || p.ativo} ${venc}`;
    return [p.ativo || p.produto, p.emissor, venc].filter(Boolean).join(' · ');
  }
  return p.produto || p.ativo || 'Sem identificação';
}

// Transforma um registro bruto numa posição padronizada (ou null para linhas de rodapé)
export function montarPosicao(r: any): Posicao | null {
  const mercado = texto(r.mercado);
  const bruto = numero(r.bruto);
  if (!mercado || bruto === null) return null;
  const p: Posicao = {
    conta: conta(r.conta) || 'sem conta',
    nome: texto(r.nome) || 'Sem nome',
    classe: mercado,
    subclasse: texto(r.sub) || '—',
    ativo: texto(r.ativo) || undefined,
    produto: texto(r.produto) || undefined,
    emissor: texto(r.emissor) || undefined,
    cnpj: texto(r.cnpj) || undefined,
    dataCompra: data(r.dataCompra) || undefined,
    vencimento: data(r.vencimento) || undefined,
    taxaCompra: numero(r.taxaCompra) || undefined,
    taxaEmissao: numero(r.taxaEmissao) || undefined,
    quantidade: numero(r.quantidade) || undefined,
    bruto,
    liquido: numero(r.liquido) ?? bruto,
    ir: numero(r.ir) || 0,
    iof: numero(r.iof) || 0,
    data: data(r.data) || undefined,
    tipoPlano: texto(r.tipoPlano) || undefined,
    grupo: texto(r.grupo) || undefined,
    instituicao: texto(r.instituicao) || 'BTG',
    usd: numero(r.usd) || undefined,
    cambio: numero(r.cambio) || undefined,
    cambioData: texto(r.cambioData) || undefined,
    taxaTexto: texto(r.taxaTexto) || undefined,
    titular: texto(r.titular) || null,  // titular como veio no extrato (ex.: a PJ do cliente)
    estrategia: texto(r.estrategia) || ESTRATEGIA_PADRAO[norm(mercado)] || 'Sem classificação',
    caixa: norm(mercado) === 'conta corrente',
    receber: ['valor em transito', 'valores em transito', 'valores a receber', 'proventos a receber'].includes(norm(mercado)),
    transito: norm(mercado) === 'derivativos',
    nomeAtivo: ''
  };
  if (p.receber) {
    p.classe = 'Valores a receber';
    p.subclasse = 'VR';
    p.estrategia = 'Valores a receber';
  }
  p.nomeAtivo = nomeDoAtivo(p);
  return p;
}

export function lerPlanilha(buffer: ArrayBuffer): any[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  for (const nomeAba of wb.SheetNames) {
    const matriz: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[nomeAba], { header: 1, raw: true, defval: null });
    // O cabeçalho pode não estar na 1ª linha: procura nas 15 primeiras
    const iCab = matriz.slice(0, 15).findIndex(l => {
      const n = (l || []).map(norm);
      return OBRIGATORIAS.every(c => n.includes(c));
    });
    if (iCab < 0) continue;
    const cab = matriz[iCab].map((c: any) => COLUNAS[norm(c)] || null);
    return matriz.slice(iCab + 1).map(l => {
      const r: Record<string, any> = {};
      cab.forEach((campo, i) => { if (campo) r[campo] = l[i]; });
      return r;
    });
  }
  throw new Error('Não encontrei as colunas do export de posição do BTG (Conta, Nome, Mercado, Sub Mercado, Valor Bruto). Confira se é o relatório de Posição.');
}

export function ehExtratoBTG(wb: XLSX.WorkBook): boolean {
  const abas = wb.SheetNames.map(norm);
  return abas.includes('sumario') && abas.includes('capa');
}

export function lerExtratoBTG(wb: XLSX.WorkBook): ExtratoLido {
  const aba = (nome: string) => {
    const k = wb.SheetNames.find(n => norm(n) === nome);
    return k ? XLSX.utils.sheet_to_json<any[]>(wb.Sheets[k], { header: 1, raw: true, defval: null }) : [];
  };
  const cheias = (l: any[]) => (l || []).filter(v => v !== null && v !== '');
  let cliente: string | null = null, contaBTG: string | null = null, dataStr: string | null = null;
  for (const l of aba('capa').map(cheias).filter(l => l.length)) {
    const s = String(l[0]).trim();
    let m;
    if ((m = s.match(/Conta(?: Controle)?:\s*(\d+)/i))) contaBTG = m[1];
    else if ((m = s.match(/a\s+(\d{2})\/(\d{2})\/(\d{2,4})\s*$/))) dataStr = `${m[1]}/${m[2]}/${m[3].length === 2 ? '20' + m[3] : m[3]}`;
    else if (!cliente && /^[A-ZÀ-Ý][A-ZÀ-Ý .'&-]{5,}$/.test(s) && !/EXTRATO|BANCO|PER[IÍ]ODO|AG[EÊ]NCIA/.test(s)) cliente = s;
  }
  let total: number | null = null;
  const sum = aba('sumario');
  const iCab = sum.findIndex(l => (l || []).some(v => norm(v) === 'mercados'));
  if (iCab >= 0) {
    const cab = sum[iCab].map(norm);
    const col = cab.map((c, i) => c.startsWith('saldo bruto') ? i : -1).filter(i => i >= 0).pop();
    const tot = sum.slice(iCab + 1).find(l => norm(l?.[cab.indexOf('mercados')]) === 'total');
    if (tot && col !== undefined) total = numero(tot[col]);
  }
  const regs: ExtratoRegistro[] = [], avisos: string[] = [];
  const tipoRF = (bloco: string) => {
    const b = norm(bloco);
    if (/ntn|ltn|lft|tesouro|titulo publico/.test(b)) return { sub: 'TITULO PUBLICO', produto: bloco.replace(/^NTN-?B$/i, 'NTN-B').replace(/^NTN-?F$/i, 'NTN-F') };
    if (/cdb|lca|lci|\blf\b|\blc\b|rdb|lig/.test(b)) return { sub: 'BANCARIO', produto: bloco.toUpperCase() };
    if (/coe/.test(b)) return { mercado: 'COE', sub: 'COE', produto: 'COE' };
    return { sub: 'PRIVADO', produto: /deb/.test(b) ? 'DEBENTURE' : bloco.toUpperCase() };
  };
  const estrPorTaxa = (t: any) => {
    const s = norm(t);
    return /ipca|ipc|igp/.test(s) ? 'Inflação' : /cdi|\bdi\b|selic/.test(s) ? 'Pós-fixado' : s ? 'Pré-fixado' : null;
  };

  for (const nomeAba of wb.SheetNames) {
    const na = norm(nomeAba);
    if (['capa', 'sumario', 'fale conosco'].includes(na)) continue;
    const M = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[nomeAba], { header: 1, raw: true, defval: null });
    let emPosicao = na === 'valores em transito', bloco = '', cab: string[] | null = null, fundo: string | null = null;
    for (const row of M) {
      const c = cheias(row);
      if (!c.length) continue;
      const s0 = norm(c[0]);
      if (c.length === 1) {
        if (/^posic(ao|oes)$/.test(s0)) { emPosicao = true; bloco = ''; cab = null; continue; }
        if (/^(posicoes detalhadas|detalhamento|movimentac|rentabilidade|posicao consolidada por emissor)/.test(s0)) { emPosicao = false; cab = null; continue; }
        if (/^posicao >/.test(s0)) { bloco = String(c[0]).split('>').slice(1).join('>').trim(); cab = null; continue; }
        if (emPosicao && na === 'fundos') fundo = String(c[0]).split(/ - (?:Classe|Fundo)\b/i)[0].trim();
        continue;
      }
      if (!emPosicao) continue;
      const n = row.map(norm);
      if (n.some((v: any) => /^saldo bruto r\$$|^valor financeiro r\$$|^valor r\$$/.test(v))) { cab = n; continue; }
      if (!cab || /^total/.test(s0)) continue;
      const v = (nome: string) => { const i = cab!.indexOf(nome); return i >= 0 ? row[i] : null; };
      const bruto = numero(v('saldo bruto r$') ?? v('valor financeiro r$') ?? v('valor r$'));
      if (!bruto) continue;
      const liq = numero(v('saldo liquido r$'));
      const ir = numero(v('ir r$')) || numero(v('provisao de ir r$')) || 0;
      if (na === 'fundos') {
        const cls = classificar(fundo || 'Fundo', { categoria: 'fundos' });
        regs.push({ mercado: 'Fundos', sub: 'FN', produto: fundo || 'Fundo', estrategia: cls.estr, quantidade: numero(v('quantidade de cotas')) || undefined, bruto, liquido: liq ?? bruto });
      } else if (na === 'renda fixa') {
        const t = tipoRF(bloco), taxa = texto(v('taxa media ponderada') ?? v('taxa compra'));
        regs.push({ mercado: (t as any).mercado || 'Renda Fixa', sub: t.sub, ativo: texto(v('ativo')) || t.produto, produto: t.produto, emissor: texto(v('emissor')) || undefined, vencimento: v('vencimento'),
          estrategia: estrPorTaxa(taxa) || undefined, taxaTexto: taxa || undefined, quantidade: numero(v('quantidade')) || undefined, bruto, liquido: liq ?? bruto - ir });
      } else if (na === 'renda variavel') {
        const cod = texto(v('codigo')), tipo = norm(v('tipo') || bloco);
        const fii = /fii|fiagro|infra/.test(tipo);
        regs.push({ mercado: 'Renda Variável', sub: fii ? 'FII' : /bdr/.test(norm(bloco)) ? 'BDR' : 'ACAO', ativo: cod || undefined, produto: cod || undefined, estrategia: fii ? 'Alternativo' : 'Renda Variável', quantidade: numero(v('qtde.')) || undefined, bruto, liquido: bruto });
      } else if (na === 'conta corrente') {
        regs.push({ mercado: 'Conta Corrente', sub: 'CC', produto: 'Conta Corrente', bruto, liquido: bruto });
      } else if (na === 'valores em transito') {
        regs.push({ mercado: 'Valores a receber', sub: 'VR', produto: texto(v('descricao')) || 'Valor a receber', vencimento: v('data liquidacao') ?? v('data'), bruto, liquido: bruto });
      } else if (/^previdencia/.test(na) && v('fundo')) {
        const fundoPrev = texto(v('fundo')) || 'Previdência', cls = classificar(fundoPrev, { categoria: 'Previdência' });
        regs.push({ mercado: 'Previdência', sub: 'PP', ativo: fundoPrev, produto: fundoPrev, estrategia: cls.estr, tipoPlano: (bloco.match(/VGBL|PGBL/i) || [null])[0]?.toUpperCase() || null,
          quantidade: numero(v('quantidade de cotas')) || undefined, bruto, liquido: liq ?? bruto });
      } else {
        const nomeAt = texto(v('ativo') ?? v('produto') ?? v('fundo') ?? v('plano') ?? v('descricao') ?? v('codigo')) || bloco || nomeAba;
        const mercado = /previd/.test(na) ? 'Previdência' : /coe/.test(na) ? 'COE' : /deriv/.test(na) ? 'Derivativos' : 'Outros';
        const cls = classificar(nomeAt, { categoria: mercado });
        regs.push({ mercado, sub: mercado === 'Previdência' ? 'PP' : mercado, ativo: nomeAt, produto: nomeAt, estrategia: cls.estr, tipoPlano: texto(v('tipo plano') ?? v('plano')), bruto, liquido: liq ?? bruto });
        avisos.push(`A aba "${nomeAba}" foi lida de forma genérica: confira a classificação.`);
      }
    }
  }
  if (!regs.length) throw new Error('O Excel parece ser um extrato do BTG, mas não encontrei posições nas abas.');
  return { inst: 'BTG', conta: contaBTG || '', clienteSugerido: cliente, data: dataStr, total, regs, avisos: [...new Set(avisos)], contaBTG };
}

export function lerBTGPdf(linhas: string[]): ExtratoLido {
  const txt = linhas.join('\n');
  const conta = txt.match(/Conta investimento\s+(\d+)/i)?.[1] || null;
  const iInv = linhas.findIndex(l => /^investimentos$/i.test(l.trim()));
  const cliente = iInv >= 0 && /^[A-ZÀ-Ý][A-ZÀ-Ý .'&-]{5,}$/.test(linhas[iInv + 1] || '') ? linhas[iInv + 1].trim() : null;
  const per = txt.match(/Per\S+odo de \d{2}\/\d{2}\/\d{2}\s+a\s+(\d{2})\/(\d{2})\/(\d{2})/i);
  const dataStr = per ? `${per[1]}/${per[2]}/20${per[3]}` : null;
  const totLinha = linhas.find(l => /^Total\s+[\d.]+,\d{2}\s+[\d.]+,\d{2}\s+[\d.]+,\d{2}\s+[\d.]+,\d{2}$/.test(l));
  const total = totLinha ? numero(totLinha.split(/\s+/)[3]) : null;
  const regs: ExtratoRegistro[] = [], avisos: string[] = [];
  const v = (s: string) => s === '-' ? 0 : (numero(s) || 0);
  const ano4 = (d: string) => d.replace(/^(\d{2})\/(\d{2})\/(\d{2})$/, '$1/$2/20$3');
  const estrPorTaxa = (s: string) => { const n = norm(s); return /ipca|ipc|igp/.test(n) ? 'Inflação' : /cdi|selic/.test(n) ? 'Pós-fixado' : n ? 'Pré-fixado' : null; };
  const tipoRF = (b: string) => { const n = norm(b); return /ntn|ltn|lft|tesouro|titulo/.test(n) ? 'TITULO PUBLICO' : /cdb|lca|lci|\blf\b|rdb|lig/.test(n) ? 'BANCARIO' : 'PRIVADO'; };
  const produtoRF = (b: string) => /deb/i.test(norm(b)) ? 'DEBENTURE' : tipoRF(b) === 'TITULO PUBLICO' ? b.replace(/^NTN-?B$/i, 'NTN-B').replace(/^NTN-?F$/i, 'NTN-F') : b.toUpperCase();
  let secao = '', bloco = '', pre: string[] = [], emissorCoe = '', plano = '';

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].trim();
    let m;
    if (/^(Extrato da Conta Investimento|Per\S+odo de|<<PAGINA>>)/i.test(l)) continue;
    if ((m = l.match(/^Fundo de Investimento - Posi\S+o/i))) { secao = 'fundos'; continue; }
    if ((m = l.match(/^Renda\s+(?!vari)\S+\s+-\s+Posi\S+o\s+-\s+(.+)$/i)) && !/Consolidad/i.test(l)) { secao = 'rf'; bloco = m[1].trim(); pre = []; continue; }
    if ((m = l.match(/^Renda vari\S+vel - Posi\S+o - (.+)$/i))) { secao = 'rv'; bloco = m[1].trim(); continue; }
    if (/^Conta corrente - Posi\S+o/i.test(l)) { secao = 'cc'; continue; }
    if ((m = l.match(/^COE - Posi\S+o(?: - (.+))?$/i))) { secao = 'coe'; emissorCoe = (m[1] || '').trim(); continue; }
    if ((m = l.match(/^Previd\S+ncia Individual - Posi\S+o(?: - (.+))?$/i))) { secao = 'prev'; plano = (m[1] || '').match(/VGBL|PGBL/i)?.[0]?.toUpperCase() || ''; continue; }
    if (/^Valores em tr\S+nsito/i.test(l)) { secao = 'transito'; continue; }
    if (/ - (Detalhamento|Movimenta\S+o|Posi\S+o Consolidada)/i.test(l) || /^Disclaimers|^Fale Conosco|^Perfil de Risco/i.test(l)) { secao = ''; continue; }

    if (secao === 'fundos') {
      if (/^Total em fundos/i.test(l)) { secao = ''; continue; }
      if ((m = l.match(/^\d{2}\/\d{2}\/\d{2}\s+(.+)$/)) && /CNPJ/i.test(linhas[i - 1] || '')) {
        const n = m[1].split(/\s+/);
        const nome = linhas[i - 1].split(/\s+-\s+Classe\b|\s+-\s+CNPJ/i)[0].trim();
        const cls = classificar(nome, { categoria: 'fundos' });
        regs.push({ mercado: 'Fundos', sub: 'FN', produto: nome, estrategia: cls.estr, quantidade: v(n[1]), bruto: v(n[3]), liquido: v(n[6]) });
      }
      continue;
    }
    if (secao === 'rf') {
      if ((m = l.match(/^(.*?)\s*(\d{2}\/\d{2}\/\d{2})\s+(\d{2}\/\d{2}\/\d{2})\s+(Sim|N\S+o)\s+(\S+)\s+(\S+)\s+(.+?)\s+([\d.]+,\d+)\s+([\d.]+,\d+)\s+([\d.]+,\d{2})\s+(\S+)\s+(\S+)\s+([\d.]+,\d{2})$/i))) {
        const pos = (linhas[i + 1] || '').trim().split(/\s+/).filter(Boolean);
        const preTok = pre.join(' ').trim().split(/\s+/).filter(Boolean);
        const prefixo = /-$/.test(preTok.at(-1) || '') ? preTok.pop() : '';
        let ativo, emissor;
        if (prefixo) {
          ativo = prefixo + (pos.pop() || '');
          emissor = [...preTok, m[1], ...pos].join(' ');
        } else {
          ativo = m[1] || produtoRF(bloco);
          emissor = [...preTok, ...pos].join(' ');
        }
        emissor = emissor.replace(/\s+/g, ' ').trim();
        const sub = tipoRF(bloco);
        regs.push({ mercado: 'Renda Fixa', sub, ativo, produto: produtoRF(bloco), emissor: emissor || (sub === 'TITULO PUBLICO' ? 'TESOURO NACIONAL' : ''),
          vencimento: ano4(m[3]), estrategia: estrPorTaxa(m[7]) || undefined, taxaTexto: m[7], quantidade: v(m[8]), bruto: v(m[10]), liquido: v(m[13]) });
        pre = []; i++;
        continue;
      }
      if (/^[\d.]+,\d{2}(\s+(-|[\d.]+,\d{2})){3}$/.test(l)) { pre = []; continue; }
      if (/^(Dias de|Emissor\s+Ativo|liquidez|par\S* liquidez|Ponderad)/i.test(l)) continue;
      pre.push(l);
      continue;
    }
    if (secao === 'rv') {
      if (/^Total/i.test(l)) { secao = ''; continue; }
      if ((m = l.match(/^([A-Z0-9]{4}\d{1,2}[A-Z]?)\s+(.+?)\s+([\d.]+)\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})$/))) {
        const fii = /fii|fiagro|infra/i.test(m[2]) || /fii|fiagro/i.test(bloco);
        regs.push({ mercado: 'Renda Variável', sub: fii ? 'FII' : /bdr/i.test(bloco) ? 'BDR' : 'ACAO', ativo: m[1], produto: m[1], estrategia: fii ? 'Alternativo' : 'Renda Variável', quantidade: v(m[3]), bruto: v(m[6]), liquido: v(m[6]) });
      }
      continue;
    }
    if (secao === 'coe') {
      if ((m = l.match(/^(\S+)\s+\d{2}\/\d{2}\/\d{2}\s+(\d{2}\/\d{2}\/\d{2})\s+\S+\s+\d{2}\/\d{2}\/\d{2}\s+([\d.]+,\d+)\s+[\d.]+,\d+\s+[\d.]+,\d{2}\s+[\d.]+,\d+\s+([\d.]+,\d{2})\s+(\S+)\s+(\S+)\s+([\d.]+,\d{2})$/))) {
        const cls = classificar(m[1], { categoria: 'COE' });
        regs.push({ mercado: 'COE', sub: 'COE', ativo: m[1], produto: m[1], emissor: emissorCoe, vencimento: ano4(m[2]), estrategia: cls.estr, quantidade: v(m[3]), bruto: v(m[4]), liquido: v(m[7]) });
      } else if (/^[\d.]+,\d{2}(\s+(-|[\d.]+,\d{2})){3}$/.test(l)) secao = '';
      continue;
    }
    if (secao === 'prev') {
      if (/^Total/i.test(l)) { secao = ''; continue; }
      if ((m = l.match(/^(.+?)\s+\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\s+\d{2}\/\d{2}\/\d{2}\s+([\d.]+,\d+)\s+[\d.]+,\d+\s+([\d.]+,\d{2})$/))) {
        const cls = classificar(m[1], { categoria: 'Previdência' });
        regs.push({ mercado: 'Previdência', sub: 'PP', ativo: m[1], produto: m[1], estrategia: cls.estr, tipoPlano: plano || null, quantidade: v(m[2]), bruto: v(m[3]), liquido: v(m[3]) });
      }
      continue;
    }
    if (secao === 'transito') {
      if (/^Total/i.test(l)) { secao = ''; continue; }
      if ((m = l.match(/^(\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+(-?[\d.]+,\d{2})$/))) {
        regs.push({ mercado: 'Valores a receber', sub: 'VR', produto: m[2].replace(/\s+/g, ' '), vencimento: ano4(m[1]), bruto: v(m[3]), liquido: v(m[3]) });
      }
      continue;
    }
    if (secao === 'cc' && (m = l.match(/^\d{2}\/\d{2}\/\d{2}\s+(-?[\d.]+,\d{2})$/))) {
      regs.push({ mercado: 'Conta Corrente', sub: 'CC', produto: 'Conta Corrente', bruto: v(m[1]), liquido: v(m[1]) });
      secao = '';
    }
  }
  if (!regs.length) throw new Error('Reconheci o extrato do BTG em PDF, mas não encontrei as posições. Use o Excel do extrato.');
  return { inst: 'BTG', conta: conta || '', clienteSugerido: cliente, data: dataStr, total, regs, avisos, contaBTG: conta || undefined };
}

export function ehBTGRelatorioPerformance(linhas: string[]): boolean {
  const txt = linhas.slice(0, 50).join(' ');
  return /relat\S+rio de performance/i.test(txt) && linhas.some(l => /detalhamento dos ativos|posi\S+o consolidada/i.test(l));
}

export function lerBTGRelatorioPerformancePdf(linhas: string[]): ExtratoLido {
  const txt = linhas.join('\n');
  const conta = txt.match(/Cont\S*\s+Investimento\s+(\d+)/i)?.[1] || '';

  let cliente: string | null = null;
  for (const l of linhas.slice(0, 30)) {
    const m = l.match(/^Nome\s+([A-ZÀ-Ý0-9\s.'&-]+)$/i);
    if (m) {
      cliente = m[1].trim();
      break;
    }
  }

  const per = txt.match(/Per\S+odo de \d{2}\/\d{2}\/\d{4}\s+a\s+(\d{2}\/\d{2}\/\d{4})/i);
  const dataStr = per ? per[1] : null;

  let total: number | null = null;
  const totMatch = txt.match(/Patrim\S+nio bruto.*?R\$\s*([\d.]+,\d{2})/i) || txt.match(/Total\s+100,00%\s+R\$\s*([\d.]+,\d{2})/i);
  if (totMatch) total = numero(totMatch[1]);

  const regs: ExtratoRegistro[] = [], avisos: string[] = [];
  let inDet = false;
  let currEstr: string | null = null;

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].trim();
    if (!l) continue;

    if (/detalhamento dos ativos/i.test(l)) {
      inDet = true;
      continue;
    }

    if (inDet) {
      if (/^(A rentabilidade completa|Movimenta\S+o|Disclaimer|Perfil de Risco)/i.test(l)) {
        inDet = false;
        continue;
      }

      if (/em carteira/i.test(l)) {
        const n = norm(l);
        if (/pos.*xado/.test(n)) currEstr = 'Pós-fixado';
        else if (/infla/.test(n)) currEstr = 'Inflação';
        else if (/pre.*xado/.test(n)) currEstr = 'Pré-fixado';
        else if (/multi/.test(n)) currEstr = 'Retorno Absoluto (MM)';
        else if (/vari|acoes/.test(n)) currEstr = 'Renda Variável';
        else if (/alt/.test(n)) currEstr = 'Alternativo';
        else if (/intern/.test(n)) currEstr = 'Internacional';
        continue;
      }

      if (/^(Ativo|TOTAL R\$|P\S+gina \d+|<<PAGINA>>|Relat\S+rio de Performance|Per\S+odo de)/i.test(l)) {
        continue;
      }

      const mVal = l.match(/R\$\s*([\d.]+,\d{2})(?:\s+(?:-|\S+)\s+R\$\s*([\d.]+,\d{2}))?/);
      if (mVal) {
        const bruto = numero(mVal[1]);
        if (!bruto) continue;
        const liq = mVal[2] ? numero(mVal[2]) : bruto;

        const prefix = l.slice(0, mVal.index).trim();
        const mDt = prefix.match(/(\d{2}\/\d{2}\/\d{4})/);
        let nomeAtivo = prefix;
        let venc: string | undefined;
        let resg: string | undefined;
        let qtd: number | undefined;
        let taxa: string | undefined;

        if (mDt) {
          nomeAtivo = prefix.slice(0, mDt.index).trim();
          let resto = prefix.slice(mDt.index + mDt[0].length).trim();

          const mVenc = resto.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
          if (mVenc) {
            venc = mVenc[1];
            resto = resto.replace(mVenc[0], '');
          }

          const mResg = resto.match(/\b(D\+\d+)\b/i);
          if (mResg) {
            resg = mResg[1].toUpperCase();
            resto = resto.replace(mResg[0], '');
          }

          const mQtd = resto.match(/^([\d.]+,\d{2})/);
          if (mQtd) {
            qtd = numero(mQtd[1]) || undefined;
            resto = resto.replace(mQtd[0], '');
          }

          taxa = resto.replace(/\s+/g, ' ').trim() || undefined;
        }

        const cls = classificar(nomeAtivo, { indexador: taxa, dica: currEstr || '' });
        const emissorPadrao = cls.tipo === 'LFT'
          ? 'BANCO CENTRAL DO BRASIL'
          : nomeAtivo.includes(' - ')
          ? nomeAtivo.split(' - ')[0].trim()
          : undefined;

        regs.push({
          mercado: cls.classe,
          sub: cls.sub,
          ativo: nomeAtivo,
          produto: nomeAtivo,
          emissor: emissorPadrao,
          vencimento: venc,
          quantidade: qtd,
          bruto,
          liquido: liq ?? bruto,
          estrategia: currEstr || cls.estr,
          taxaTexto: taxa,
          riscoCredito: cls.riscoCredito,
          contraparte: cls.contraparte || cls.riscoCredito,
          cnpj: (cls as any).guia?.cnpjFormatado,
          gestor: (cls as any).guia?.gestor,
          benchmark: (cls as any).guia?.benchmark,
          categoriaBtg: (cls as any).guia?.categoriaBtg,
          subcategoriaBtg: (cls as any).guia?.subcategoriaBtg
        });
      }
    }
  }

  if (!regs.length) {
    let inPos = false;
    for (const l of linhas) {
      if (/posi\S+o consolidada dos investimentos/i.test(l)) {
        inPos = true;
        continue;
      }
      if (inPos) {
        if (/^(P\S+gina \d+|<<PAGINA>>|quando abrimos a rentabilidade)/i.test(l)) {
          inPos = false;
          continue;
        }
        const matches = [...l.matchAll(/([A-ZÀ-Ý0-9\s.'&-]+?)\s+([\d.]+,\d{2})\s+[\d.]+,\d{2}/g)];
        for (const m of matches) {
          const nome = m[1].trim();
          const bruto = numero(m[2]);
          if (!bruto || /^(Total|Ativo|Fundo de Investimento|Renda Fixa|P[óo]s-[f|a]xado|Infla[çc][ãa]o)$/i.test(nome)) continue;
          const cls = classificar(nome);
          regs.push({
            mercado: cls.classe,
            sub: cls.sub,
            ativo: nome,
            produto: nome,
            bruto,
            liquido: bruto,
            estrategia: cls.estr,
            riscoCredito: cls.riscoCredito,
            contraparte: cls.contraparte || cls.riscoCredito,
            cnpj: (cls as any).guia?.cnpjFormatado,
            gestor: (cls as any).guia?.gestor,
            benchmark: (cls as any).guia?.benchmark
          });
        }
      }
    }
  }

  if (!regs.length) {
    throw new Error('Reconheci o Relatório de Performance do BTG, mas não foi possível extrair as posições.');
  }

  if (total === null) {
    total = regs.reduce((acc, r) => acc + (r.bruto || 0), 0);
  }

  return {
    inst: 'BTG',
    conta: conta || '',
    clienteSugerido: cliente,
    data: dataStr,
    total,
    regs,
    avisos,
    contaBTG: conta || undefined
  };
}

