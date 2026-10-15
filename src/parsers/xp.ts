import { norm, palavras, numBR } from '../components/formatters';
import { classificar, registroFundo } from './classification';
import type { ExtratoLido, ExtratoRegistro } from '../types';

export const DATA_RE = /\d{2}\/\d{2}\/\d{4}/g;
export const valoresRS = (l: any): number[] =>
  [...String(l).matchAll(/(-?)\s*R\$\s*(-?)([\d.]+,\d{2})/g)].map(m => (m[1] || m[2] ? -1 : 1) * numBR(m[3]));

export function lerXP(linhas: string[]): ExtratoLido {
  const txt = linhas.join('\n');
  const cli = txt.match(/Cliente:\s*(.+?)\s+Conta:\s*(\d+)/);
  const data = txt.match(/Data de refer[^:\n]*:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] || null;
  let total: number | null = null;
  const iPat = linhas.findIndex(l => /^PATRIM\S*NIO\s+INVESTIMENTO/i.test(l));
  if (iPat >= 0) total = valoresRS(linhas[iPat + 1] || '')[0] ?? null;
  if (total === null) {
    const m = txt.match(/PATRIM\S*NIO TOTAL\s+R\$\s*([\d.]+,\d{2})/i);
    if (m) total = numBR(m[1]);
  }

  const regs: ExtratoRegistro[] = [], avisos: string[] = [];
  const temData = (l: string) => DATA_RE.test(l) && !(DATA_RE.lastIndex = 0);
  const MES = /^(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/\d{4}\b/i;
  const ehRuido = (l: string) => /^(Taxa De|Ativo |Compra Judicial|Qtd\.|Disponivel|Disponível|Título |Papel |Posição$|POSIÇÃO|PRECIFICAÇÃO|<<PAGINA>>|\d{2}$)/i.test(l) || /Data de refer/i.test(l);
  const estrSub = (s: string) => {
    const n = palavras(s);
    return / (prefixad[ao]|pre fixad[ao]) /.test(n) ? 'Pré-fixado' : / (pos fixad[ao]|pos) /.test(n) ? 'Pós-fixado' : / (inflacao|ipca) /.test(n) ? 'Inflação' : null;
  };
  const LISTADOS_EXTERIOR = /^(ACWI11|AGGX11|DOLX11|GOLD11|HASH11|IVVB11|NASD11|SPXI11|BITH11|QBTC11|ETHE11|XINA11|EURP11|JPMO11|WRLD11|USDB11|BIVB39)$/;
  let cat = '', sub = '', pend: string[] = [], ultimoRF: any = null, proventos = 0;

  const limpaNomeRF = (s: string) =>
    s.replace(/(IPC-?A\s*)?[+]?\d+,\d+\s*%(\s*CDI)?/gi, '')
      .replace(/\b(IPC-?A|CDI)\b/gi, '')
      .replace(/\s+-\s*-\s*/g, ' - ')
      .replace(/\s*-\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();

  const fecharRF = (l: string) => {
    const datas = l.match(DATA_RE) || [], rs = valoresRS(l);
    const antes = l.slice(0, l.search(DATA_RE)).trim();
    const nome = [...pend, antes].join(' ').replace(/\s+/g, ' ').trim();
    pend = [];
    return { nome, datas, rs };
  };

  for (const l of linhas) {
    let m;
    if (/^(PR[ÓO]XIMOS VENCIMENTOS|N[ÍI]VEL DE ENQUADRAMENTO|DISTRIBUI[ÇC][ÃA]O DE LIQUIDEZ|RENTABILIDADE|MOVIMENTA[ÇC][ÕO]ES)\b/.test(l)) {
      cat = 'fim';
      continue;
    }
    if (cat === 'fim') continue;
    if (/^Cust[oó]dia Remunerada/i.test(l)) { cat = 'custodia'; continue; }
    if ((m = l.match(/^[\d.,]+%\s*\|\s*(.+?)(\s+-?R\$.*)?$/))) { sub = m[1].trim(); pend = []; continue; }
    if ((m = l.match(/^[\d.,]+%\s+([^|\d].*)$/))) { cat = norm(m[1]); sub = ''; pend = []; ultimoRF = null; continue; }
    if (/^(IPC-?A|CDI|PRE|PR[EÉ]-?FIXADO|SELIC|IGP-?M|DI)$/i.test(l) && /renda fixa/.test(cat)) { pend.push(l); continue; }
    if (!cat || cat === 'custodia' || /garantia|saldo projetado/.test(cat) || ehRuido(l)) continue;
    const rs = valoresRS(l);

    if (/^a[cç][oõ]es$/.test(cat)) {
      if ((m = l.match(/^([A-Z]{4}\d{1,2})\s/)) && rs.length) {
        const tk = m[1], v = rs.at(-1)!;
        const bdr = /3[2-59]$/.test(tk), ext = LISTADOS_EXTERIOR.test(tk);
        regs.push({ mercado: 'Renda Variável', sub: bdr ? 'BDR' : 'ACAO', ativo: tk, produto: tk, estrategia: bdr || ext ? 'Internacional' : 'Renda Variável', bruto: v, liquido: v });
      }
    } else if (/fundos imobiliarios|fundos listados/.test(cat)) {
      if ((m = l.match(/^([A-Z]{4}\d{2})\b/)) && rs.length) {
        regs.push({ mercado: 'Renda Variável', sub: 'FII', ativo: m[1], produto: m[1], estrategia: 'Alternativo', bruto: rs.at(-1)!, liquido: rs.at(-1)! });
      }
    } else if (/tesouro direto/.test(cat)) {
      if ((m = l.match(/^(NTN-?B1|NTNB PRINC|NTN-?B|NTN-?F|LTN|LFT)\s+(\d{2}\/\d{2}\/\d{4})/i)) && rs.length) {
        const t = m[1].toUpperCase().replace(/\s+/g, ' ');
        const produto = /PRINC/.test(t) ? 'NTN-B Principal' : /NTN-?B/.test(t) ? 'NTN-B' : /NTN-?F/.test(t) ? 'NTN-F' : t;
        const estr = /LFT/.test(t) ? 'Pós-fixado' : /LTN|NTN-?F/.test(t) ? 'Pré-fixado' : 'Inflação';
        regs.push({ mercado: 'Renda Fixa', sub: 'TITULO PUBLICO', ativo: produto, produto, emissor: 'BACEN', vencimento: m[2], estrategia: estr, taxaTexto: `Tesouro Direto • ${estr}`, bruto: rs.at(-1)!, liquido: rs.at(-1)! });
      }
    } else if (/proventos/.test(cat)) {
      if (rs.length && !/^R\$/.test(l)) proventos += rs.at(-1)!;
    } else if (/fundo/.test(cat)) {
      if (temData(l) && rs.length >= 2) {
        const nome = l.slice(0, l.search(DATA_RE)).trim();
        const qtd = l.slice(l.search(DATA_RE) + 10, l.indexOf('R$')).trim().split(/\s+/).at(-1);
        const tk = nome.match(/^([A-Z]{4}11)\b/)?.[1];
        const cls = tk && !/fip/i.test(nome) ? { classe: 'Renda Variável', sub: 'FII', estr: 'Alternativo' } : classificar(nome, { categoria: 'fundos', dica: sub || cat });
        regs.push(registroFundo(nome, cls, { ativo: tk || nome, quantidade: numBR(qtd || '0'), bruto: rs.at(-2)!, liquido: rs.at(-1)! }));
      }
    } else if (/^coe$/.test(cat)) {
      if (temData(l) && rs.length) {
        const r = fecharRF(l);
        const nomeCoe = (r.nome.replace(/BANCO [A-Z0-9 .]+S\.?A\.?$/i, '').trim() || 'COE').replace(/\s*-\s*$/, '');
        ultimoRF = {
          mercado: 'COE', sub: 'COE', ativo: nomeCoe, produto: nomeCoe, emissor: l.slice(0, l.search(DATA_RE)).trim() || null,
          vencimento: r.datas[1] || r.datas.at(-1), estrategia: /bolsa|s&p|nasdaq|americana/i.test(nomeCoe) ? 'Internacional' : 'Alternativo',
          bruto: r.rs.at(-1)!, liquido: r.rs.at(-1)!
        };
        regs.push(ultimoRF);
      } else if (!rs.length && !/^\d{2}\.\d{2}\.\d{4}$/.test(l)) pend.push(l);
    } else if (/renda fixa/.test(cat)) {
      if (temData(l) && rs.length >= 2) {
        const txtLinha = [...pend, l].join(' ');
        const r = fecharRF(l);
        const nome = limpaNomeRF(r.nome);
        const cls = classificar(nome, { indexador: sub || txtLinha, categoria: 'renda fixa' });
        ultimoRF = {
          mercado: 'Renda Fixa', sub: cls.sub, ativo: nome, produto: (cls as any).tipo || nome, emissor: null,
          vencimento: r.datas[2] || r.datas.at(-1), estrategia: estrSub(sub) || cls.estr, _txt: txtLinha,
          bruto: r.rs.at(-2)!, liquido: r.rs.at(-1)!
        };
        regs.push(ultimoRF);
      } else if (ultimoRF && (MES.test(l) || /^(CDI|[+]?\d+,\d+%)/i.test(l))) {
        ultimoRF._txt += ' ' + l;
        const mes = l.match(MES)?.[0];
        if (mes) ultimoRF.ativo = `${ultimoRF.ativo} ${mes}`.replace(/\s+/g, ' ').trim();
      } else if (!rs.length) { pend.push(l); ultimoRF = null; }
    } else if (/(opcoes|derivativ)/.test(cat)) {
      const partes = l.split(/\s+/);
      if (!/^[A-Za-z]/.test(partes[0]) || /^tipo$/i.test(partes[0]) || !rs.length) continue;
      const datas = l.match(DATA_RE) || [];
      const nome = `${partes[0].toUpperCase()} ${partes[1] || ''} ${datas[0] || ''}`.replace(/\s+/g, ' ').trim();
      regs.push({ mercado: 'Derivativos', sub: 'Derivativos', ativo: nome, produto: nome, estrategia: 'Derivativos', vencimento: datas[0] || null, bruto: rs.at(-1)!, liquido: rs.at(-1)! });
    }
  }

  for (const r of regs) {
    if (!(r as any)._txt) continue;
    const tx = (r as any)._txt.match(/(\d+,\d+)\s*%/)?.[1];
    if (tx) r.taxaTexto = /IPC-?A/i.test((r as any)._txt) ? `IPCA + ${tx}%` : /CDI/i.test((r as any)._txt) ? (numBR(tx) > 50 ? `${tx}% do CDI` : `CDI + ${tx}%`) : `${tx}% a.a.`;
    delete (r as any)._txt;
  }
  for (const r of regs) {
    if (r.mercado !== 'Renda Fixa' || (r.sub === 'TITULO PUBLICO' && r.emissor)) continue;
    const sem = (r.ativo || '').replace(/\s*-?\s*(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/\d{4}\b.*$/i, '').replace(/\s*-\s*$/, '').trim();
    r.emissor = sem.replace(/^(CDB|LCA|LCI|LC|LF|LIG|RDB|CRA|CRI|DEB(ENTURE)?|NTN-?\w*)\s+/i, '').replace(/\s*-\s*\d.*$/, '').trim() || undefined;
    if (/^NTN|^LTN|^LFT/i.test(r.ativo || '')) { r.sub = 'TITULO PUBLICO'; r.emissor = 'BACEN'; r.produto = sem.split(' - ')[0].replace(/\s+/g, ' '); }
  }
  if (proventos > 0) regs.push({ mercado: 'Valores a receber', sub: 'VR', produto: 'Proventos a receber', bruto: Math.round(proventos * 100) / 100, liquido: Math.round(proventos * 100) / 100 });
  const saldo = txt.match(/SALDO DISPON\S*VEL\s+R\$\s*([\d.]+,\d{2})/i);
  if (saldo) regs.push({ mercado: 'Conta Corrente', sub: 'CC', produto: 'Conta Corrente', bruto: numBR(saldo[1]), liquido: numBR(saldo[1]) });
  return { inst: 'XP', conta: cli?.[2] || '', clienteSugerido: cli?.[1]?.trim() || null, data, total, regs, avisos };
}
