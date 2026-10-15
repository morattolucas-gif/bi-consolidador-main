import { numero, num } from '../components/formatters';
import { classificar } from './classification';
import type { ExtratoLido, ExtratoRegistro } from '../types';

export function lerCaixaInformativo(linhas: string[]): ExtratoLido {
  const txt = linhas.join('\n');
  const ct = txt.match(/(\d{4})\s*\.\s*(\d{4})\s*\.\s*(\d{6,})\s*-\s*(\d)\s+\d{5}\/\d{5}/);
  const conta = ct ? `${ct[1]}.${ct[2]}.${ct[3]}-${ct[4]}` : null;
  const nomeL = linhas.find(l => /^[A-ZÀ-Ý][A-ZÀ-Ý .'&-]{5,}\s+\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(l.trim()));
  const cliente = nomeL ? nomeL.trim().replace(/\s+\d{3}\.\d{3}\.\d{3}-\d{2}$/, '') : null;
  const iPos = nomeL ? linhas.indexOf(nomeL) : -1;
  const data = iPos >= 0 ? (linhas[iPos + 1] || '').match(/(\d{2}\/\d{2}\/\d{4})/)?.[1] || null : null;
  const iTot = linhas.findIndex(l => /^[\d.]+,\d{2}(\s+[\d.]+,\d{2}){5}$/.test(l.trim()));
  const total = iTot >= 0 ? numero(linhas[iTot].trim().split(/\s+/).pop()) : null;
  const regs: ExtratoRegistro[] = [], vistos = new Set<string>();
  let nota: { num: string; modalidade: string; venc?: string; taxa?: string } | null = null;

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].trim();
    let m;
    if ((m = l.match(/^(\d{8})\s+(\d{6})\s+(.+?)\s+(antecipado|no vencimento|sim|n\S+o)\b/i)) && /Nota/i.test(linhas[i - 1] || '')) {
      nota = { num: m[1] + ' ' + m[2], modalidade: m[3].trim() };
      continue;
    }
    if (nota && (m = l.match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+[\d.]+,\d{2}\s+([\d.,]+)\s*%\s*CDI/i))) {
      nota.venc = m[2];
      nota.taxa = `${num(numero(m[3]) || 0, 2)}% do CDI`;
      continue;
    }
    if (nota && /^%Rend/i.test(l) && /Saldo em/i.test(l)) {
      const saldo = numero((linhas[i + 1] || '').trim().split(/\s+/).pop());
      if (!vistos.has(nota.num) && saldo) {
        vistos.add(nota.num);
        const tipo = /lci/i.test(nota.modalidade) ? 'LCI' : /lca/i.test(nota.modalidade) ? 'LCA' : /cdb/i.test(nota.modalidade) ? 'CDB' : nota.modalidade;
        regs.push({
          mercado: 'Renda Fixa',
          sub: 'BANCARIO',
          ativo: tipo,
          produto: tipo,
          emissor: 'CAIXA ECONOMICA FEDERAL',
          vencimento: nota.venc || null,
          estrategia: /cdi/i.test(nota.taxa || '') ? 'Pós-fixado' : 'Sem classificação',
          taxaTexto: nota.taxa || '',
          bruto: saldo,
          liquido: saldo
        });
      }
      nota = null;
    }
  }
  if (!regs.length) throw new Error('Reconheci o informativo da Caixa, mas não encontrei as aplicações.');
  return {
    inst: 'Caixa',
    modelo: 'caixa-informativo',
    conta: conta || '',
    clienteSugerido: cliente,
    data,
    total,
    regs,
    avisos: ['Valores do informativo mensal da Caixa (saldo de cada nota na data da posição).']
  };
}

export function lerCaixaSaldo(linhas: string[]): ExtratoLido {
  const cliente = (linhas[0] || '').trim() || null;
  const data = linhas.join('\n').match(/Data\s*-\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] || null;
  const regs: ExtratoRegistro[] = [];
  let total = 0, secao = '';

  for (const bruta of linhas) {
    const l = bruta.trim();
    let m;
    if (/^Investimentos\s+DT\.REF/i.test(l)) { secao = 'rf'; continue; }
    if (/^Investimentos\s+Convers/i.test(l)) { secao = 'fundos'; continue; }
    if ((m = l.match(/^R\$\s*([\d.]+,\d{2})$/))) { total += numero(m[1]) || 0; continue; }
    if (secao === 'rf' && (m = l.match(/^(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d.,]+)\s+R\$\s*([\d.]+,\d{2})$/))) {
      const mod = m[1].trim(), tipo = /lci/i.test(mod) ? 'LCI' : /lca/i.test(mod) ? 'LCA' : /cdb/i.test(mod) ? 'CDB' : mod;
      regs.push({
        mercado: 'Renda Fixa',
        sub: 'BANCARIO',
        ativo: tipo,
        produto: tipo,
        emissor: 'CAIXA ECONOMICA FEDERAL',
        vencimento: m[3],
        estrategia: 'Pós-fixado',
        taxaTexto: `${num(numero(m[4]) || 0, 2)}% do CDI`,
        bruto: numero(m[5]) || 0,
        liquido: numero(m[5]) || 0
      });
      continue;
    }
    if (secao === 'fundos' && (m = l.match(/^(.+?)\s+(imediato|D\s*\+\s*\d+)\s+R\$\s*([\d.]+,\d{2})$/i))) {
      const nome = `CAIXA ${m[1].trim()}`, cls = classificar(nome + ' FI', { categoria: 'fundos' });
      regs.push({
        mercado: 'Fundos',
        sub: 'FN',
        produto: nome,
        ativo: nome,
        estrategia: cls.estr,
        bruto: numero(m[3]) || 0,
        liquido: numero(m[3]) || 0
      });
    }
  }
  if (!regs.length) throw new Error('Reconheci o saldo em carteira da Caixa, mas não encontrei as aplicações.');
  return {
    inst: 'Caixa',
    modelo: 'caixa-saldo',
    conta: '',
    clienteSugerido: cliente,
    data,
    total: total || null,
    regs,
    avisos: ['O "Saldo em carteira" da Caixa não traz o número da conta. Se este cliente já tem o informativo mensal da Caixa, os dois são combinados: cada aplicação é contada uma vez, com o valor mais recente.']
  };
}
