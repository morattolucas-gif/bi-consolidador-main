import { numero } from '../components/formatters';
import type { ExtratoLido } from '../types';

/* ---------- "Detalhes das Debêntures" (agente da emissão): uma debênture, saldo por data ----------
   Colunas: Data, Qtde, PU, Rendimento, Resgate, Saldo, IRRF, Resgate Líquido. Vale o "Tot. Geral" (ou a última data). */
export function lerDebenturesDetalhe(linhas: string[], inst?: string): ExtratoLido {
  const txt = linhas.join('\n');
  const cliente = txt.match(/Debenturista:\s*(.+)/i)?.[1].trim() || null;
  const serie = txt.match(/Emiss\S+o e S\S+rie:\s*(.+)/i)?.[1].trim() || '';
  const partes = serie.split(/\s+-\s+/).map(s => s.trim()).filter(Boolean);
  const nome = 'Debênture ' + [...new Set(partes.slice(1).map(s => s.replace(/\bEMISS\S+O\b/i, 'Emissão').replace(/\bS\S+RIE\b/i, 'Série')))].join(' — ');
  const reais = (l: string) => [...l.matchAll(/-?R\$\s*([\d.]+,\d{2})/g)].map(m => numero(m[1]));
  // Linhas de data: Data Qtde PU Rendimento [Resgate] Saldo IRRF Líquido (o saldo é o antepenúltimo valor)
  const datas = linhas.map(l => l.trim()).filter(l => /^\d{2}\/\d{2}\/\d{4}\s+[\d.]+\s+R\$/.test(l));
  const ult = datas.at(-1), tot = linhas.find(l => /^Tot\.?\s*Geral/i.test(l.trim()));
  const fonte = tot || ult;
  if (!fonte) throw new Error('Reconheci o "Detalhes das Debêntures", mas não encontrei o saldo.');
  const [saldo, irrf, liquido] = reais(fonte).slice(-3);
  const data = ult ? ult.match(/^(\d{2}\/\d{2}\/\d{4})/)?.[1] || null : null;
  const qtd = ult ? numero(ult.split(/\s+/)[1]) : null;
  const avisos = ['Debênture sem emissor e sem indexador no documento: confira a classe e a estratégia na conferência.'];
  if (/valores estimados|proje\S+o|simula/i.test(txt)) avisos.unshift('Este documento é uma simulação: o próprio PDF diz que os valores são estimados, não emitidos pelo agente.');
  return {
    inst: inst || '', modelo: 'debentures-detalhe', conta: '', clienteSugerido: cliente, data, total: saldo, revisar: true,
    regs: [{ mercado: 'Renda Fixa', sub: 'PRIVADO', ativo: nome, produto: 'DEBENTURE', emissor: '', quantidade: qtd, estrategia: 'Sem classificação',
      bruto: saldo, liquido: liquido ?? saldo, ir: irrf || 0 }],
    avisos,
  };
}
