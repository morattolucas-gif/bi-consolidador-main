import { carregarScript } from './script-loader';
import { valoresTexto, lerRhino, VALOR_RE } from './rhino';
import type { ExtratoLido, ExtratoRegistro } from '../types';

declare global {
  interface Window {
    Tesseract?: any;
  }
}

export async function lerFoto(arquivo: Blob | File, progresso: (msg: string) => void): Promise<string> {
  if (!window.Tesseract) {
    await carregarScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js', 'sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F');
  }
  const worker = await window.Tesseract.createWorker('por', 1, {
    logger: (m: any) => {
      if (m.status === 'recognizing text') progresso(`Lendo a foto… ${Math.round(m.progress * 100)}%`);
    }
  });
  try {
    return (await worker.recognize(arquivo)).data.text;
  } finally {
    await worker.terminate();
  }
}

export function lerFotoGenerica(texto: string, inst?: string): ExtratoLido {
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const regs: ExtratoRegistro[] = [];
  let ultimoNome = '';

  for (const l of linhas) {
    const vals = valoresTexto(l);
    const nome = l.replace(VALOR_RE, '').replace(/R\$/g, '').replace(/\s+/g, ' ').trim();
    if (!vals.length) {
      if (/[A-Za-z]{3,}/.test(l)) ultimoNome = l;
      continue;
    }
    const nomeFinal = nome.length >= 3 ? nome : ultimoNome;
    regs.push({
      mercado: 'Outros',
      sub: 'Outros',
      ativo: nomeFinal,
      produto: nomeFinal,
      estrategia: 'Sem classificação',
      bruto: vals.at(-1)!,
      liquido: vals.at(-1)!
    });
  }

  if (!regs.length) throw new Error('Não encontrei valores na foto. Tente uma foto mais nítida.');
  return {
    inst: inst || '',
    conta: '',
    clienteSugerido: null,
    data: null,
    total: null,
    regs,
    revisar: true,
    avisos: ['Leitura genérica de foto: confira cada linha (nome, classe e valor), remova o que não for posição e acerte a classificação.']
  };
}

export function lerFotoExtrato(texto: string, inst?: string): ExtratoLido {
  if (inst === 'Rhino' || /rhino/i.test(texto)) return lerRhino(texto);
  return lerFotoGenerica(texto, inst);
}
