import { norm, numBR, compacto, brl } from '../components/formatters';
import { somaLista } from '../domain/precision';
import { classificar, registroFundo } from './classification';
import type { ExtratoLido, ExtratoRegistro } from '../types';

export function lerSafra(linhas: string[]): ExtratoLido {
  const txt = linhas.join('\n');
  const data = txt.match(/Data da posi[^:\n]*:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] || null;
  const ag = txt.match(/Ag\S*ncia:\s*(\d+)\s*\/\s*Conta:\s*([\w.-]+)/i);
  const tot = linhas.map(l => l.match(/^Carteira\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+(-|[\d.]+,\d{2})\s+([\d.]+,\d{2})/)).find(Boolean);
  const CATEG = new Set(['renda fixa', 'curto prazo', 'fundos de investimento', 'fundos', 'previdencia', 'renda variavel', 'corretora', 'multimercado', 'acoes', 'cambio', 'poupanca', 'coe', 'derivativos', 'ativos virtuais']);
  let secao = '', categoria = '';
  const resumo: { nome: string; bruto: number; imp: number; liq: number; categoria: string }[] = [];
  const rf: string[] = [];
  const fundos: { nome: string; qtd: number; bruto: number; liq: number }[] = [];

  for (const l of linhas) {
    if (/^Posi\S*o de Investimentos/i.test(l)) { secao = 'resumo'; continue; }
    if (/^Detalhamento de Fundos/i.test(l)) { secao = /Extrato/i.test(l) ? '' : 'fundos'; continue; }
    if (/^Detalhamento de Ativos de Renda Fixa/i.test(l)) { secao = /Extrato/i.test(l) ? '' : 'rf'; continue; }
    if (/^(Investimentos Resumo|Rentabilidade|Hist\S*rico|Composi\S*o da carteira|Notas)/i.test(l)) { secao = ''; continue; }
    let m;
    if (secao === 'resumo' && (m = l.match(/^(.+?)\s+(-?[\d.]+,\d{2})\s+(-|-?[\d.]+,\d{2})\s+(-?[\d.]+,\d{2})\s+(-?[\d.]+,\d{2})(\s|$)/))) {
      const nome = m[1].trim();
      if (CATEG.has(norm(nome))) categoria = nome;
      else resumo.push({ nome, bruto: numBR(m[2]), imp: numBR(m[3]), liq: numBR(m[4]), categoria });
    }
    if (secao === 'fundos' && !/^\d{2}\//.test(l) && (m = l.match(/^(.+?)\s+([\d.]+,\d{3,})\s+([\d.]+,\d{3,})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+(-|[\d.]+,\d{2})\s+([\d.]+,\d{2})$/))) {
      fundos.push({ nome: m[1].trim(), qtd: numBR(m[2]), bruto: numBR(m[5]), liq: numBR(m[7]) });
    }
    if (secao === 'rf') rf.push(l);
  }

  // Linhas de renda fixa: "<produto> <emissor> <indexador> <%idx> <taxa> <aplicação> <vencimento> <qtd> <aplicado> <bruto> <impostos> <líquido>"
  const produtos = [...resumo].sort((a, b) => compacto(b.nome).length - compacto(a.nome).length);
  const detalhes: { produto: string; emissor: string; indexador: string; pctIdx: number; taxa: number; venc: string; qtd: number; bruto: number; liq: number }[] = [];
  for (const l of rf) {
    const p = produtos.find(p => compacto(l).startsWith(compacto(p.nome)));
    if (!p) continue;
    let n = 0, i = 0;
    const alvo = compacto(p.nome).length;
    while (i < l.length && n < alvo) {
      if (/[a-z0-9]/.test(compacto(l[i]))) n += compacto(l[i]).length;
      i++;
    }
    const m = l.slice(i).match(/^\s*(.*?)\s*\b(CDI|IPCA|IPC-A|PRE|SELIC|IGPM|IGP-M)\s+(-|[\d.,]+)\s+(-|[+\-]?[\d.,]+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+(-|[\d.,]+)\s+([\d.,]+)$/);
    if (!m) continue;
    detalhes.push({ produto: p.nome, emissor: m[1].trim(), indexador: m[2], pctIdx: numBR(m[3]), taxa: numBR(m[4]), venc: m[6], qtd: numBR(m[7]), bruto: numBR(m[9]), liq: numBR(m[11]) });
  }

  const regs: ExtratoRegistro[] = [], avisos: string[] = [];
  for (const r of resumo) {
    const det = detalhes.filter(d => d.produto === r.nome);
    const fundo = fundos.find(f => compacto(f.nome) === compacto(r.nome));
    if (det.length) {
      for (const d of det) {
        const cls = classificar(r.nome, { indexador: d.indexador, categoria: r.categoria });
        regs.push({
          mercado: cls.classe,
          sub: cls.sub,
          ativo: (cls as any).tipo || r.nome,
          produto: (cls as any).tipo || r.nome,
          emissor: d.emissor,
          vencimento: d.venc,
          estrategia: cls.estr,
          taxaCompra: /cdi/i.test(d.indexador) ? d.pctIdx : d.taxa,
          quantidade: d.qtd,
          bruto: d.bruto,
          liquido: d.liq
        });
      }
      const soma = somaLista(det, d => d.bruto);
      if (Math.abs(soma - r.bruto) > 1) avisos.push(`${r.nome}: o detalhe soma ${brl(soma)}, mas o resumo mostra ${brl(r.bruto)}.`);
    } else if (fundo) {
      regs.push(registroFundo(r.nome, classificar(r.nome, { categoria: 'fundos' }), { quantidade: fundo.qtd, bruto: fundo.bruto, liquido: fundo.liq }));
    } else {
      regs.push(registroFundo(r.nome, classificar(r.nome, { categoria: r.categoria }), { bruto: r.bruto, liquido: r.liq }));
    }
  }
  avisos.push('O extrato do Safra não inclui o saldo em conta corrente.');
  return { inst: 'Safra', conta: ag ? `${ag[1]}/${ag[2]}` : '', clienteSugerido: null, data, total: tot ? numBR(tot[1]) : null, regs, avisos };
}
