import { carregarScript } from './script-loader';
import { palavras } from '../components/formatters';
import { lerBTGPdf } from './btg';
import { lerCaixaInformativo, lerCaixaSaldo } from './caixa';
import { lerDebenturesDetalhe } from './debentures';
import { lerNomad } from './nomad';
import { lerSafra } from './safra';
import { lerXP } from './xp';
import type { ExtratoLido } from '../types';

declare global {
  interface Window {
    'pdfjs-dist/build/pdf'?: any;
    pdfjsLib?: any;
  }
}

export async function leitorPdf(): Promise<any> {
  const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  if (!window['pdfjs-dist/build/pdf']) {
    await carregarScript(CDN + 'pdf.min.js', 'sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e');
    await carregarScript(CDN + 'pdf.worker.min.js', 'sha384-SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2'); // roda no próprio navegador, sem enviar nada
  }
  const lib = window['pdfjs-dist/build/pdf'];
  lib.GlobalWorkerOptions.workerSrc = CDN + 'pdf.worker.min.js';
  return lib;
}

// Texto do PDF em linhas (junta os pedaços que estão na mesma altura da página)
export async function lerPdfLinhas(buffer: ArrayBuffer): Promise<string[]> {
  const lib = await leitorPdf();
  const pdf = await lib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const linhas: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const itens = tc.items
      .filter((it: any) => it.str && it.str.trim())
      .map((it: any) => ({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width }));
    const grupos: { y: number; itens: typeof itens }[] = [];
    for (const it of itens.sort((a: any, b: any) => b.y - a.y)) {
      const g = grupos.find(g => Math.abs(g.y - it.y) < 2.5);
      if (g) g.itens.push(it);
      else grupos.push({ y: it.y, itens: [it] });
    }
    for (const g of grupos.sort((a, b) => b.y - a.y)) {
      let s = '', fim: number | null = null;
      for (const it of g.itens.sort((a: any, b: any) => a.x - b.x)) {
        if (fim !== null && it.x - fim > 1) s += ' ';
        s += it.s;
        fim = it.x + it.w;
      }
      const l = s.replace(/[ \s]+/g, ' ').trim();
      if (l) linhas.push(l);
    }
    linhas.push('<<PAGINA>>');
  }
  return linhas;
}

export function lerExtratoPdf(linhas: string[], inst?: string): ExtratoLido {
  // O PDF do BTG usa uma fonte em que a letra "a" vem como caractere vazio: devolve o "a" antes de ler
  const linhasLimpass = linhas.map(l => l.replace(/\u0000/g, 'a'));
  const topo = palavras(linhasLimpass.slice(0, 60).join(' '));
  // Reconhece pelo conteúdo (vale mesmo se a instituição escolhida no anexo estiver errada)
  if (/ extrato da conta investimento /.test(topo) && linhasLimpass.some(l => /Posi\S+o - /i.test(l))) return lerBTGPdf(linhasLimpass);
  if (/ informativo mensal /.test(topo) && / caixa /.test(topo)) return lerCaixaInformativo(linhasLimpass);
  if (linhasLimpass.some(l => /^Investimentos\s+DT\.REF\s+DT\.VENCTO/i.test(l))) return lerCaixaSaldo(linhasLimpass);
  if (/ detalhes das debentures /.test(topo)) return lerDebenturesDetalhe(linhasLimpass, inst);
  if (inst === 'Nomad' || linhasLimpass.some(l => /^Nome\s+Tipo\s+Ticker/i.test(l))) return lerNomad(linhasLimpass);
  if (inst === 'Safra') return lerSafra(linhasLimpass);
  if (inst === 'XP') return lerXP(linhasLimpass);
  const t = palavras(linhasLimpass.slice(0, 80).join(' '));
  if (/ safra /.test(t)) return lerSafra(linhasLimpass);
  if (/ (xp investimentos|posicao consolidada) /.test(t) || / xp /.test(palavras(linhasLimpass.join(' ')))) return lerXP(linhasLimpass);
  throw new Error('Ainda não sei ler PDFs desta instituição. Anexe como foto (o painel mostra a conferência), use o Excel padrão, ou mande um exemplo para o Claude incluir.');
}
