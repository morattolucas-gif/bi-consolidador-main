import { norm, numBR, brl } from '../components/formatters';
import { somaLista } from '../domain/precision';
import type { ExtratoLido, ExtratoRegistro } from '../types';

export const VALOR_RE = /(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2})(?!\d|\s*%)/g;
export const valoresTexto = (l: any): number[] => [...String(l).matchAll(VALOR_RE)].map(m => numBR(m[1]));

export function lerRhino(texto: string): ExtratoLido {
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const titulo = /^\d{1,3}\s*\/\s*[A-Z0-9][A-Z0-9 .\-]{2,}$/;
  const regs: ExtratoRegistro[] = [], avisos: string[] = [];
  let totalLiq: number | null = null;
  const iLiq = linhas.findIndex(l => /^l[ií]quido:?/i.test(l) && valoresTexto(l).length);
  if (iLiq >= 0) totalLiq = valoresTexto(linhas[iLiq]).pop() ?? null;
  const inicios = linhas.map((l, i) => (titulo.test(l) ? i : -1)).filter(i => i >= 0);

  inicios.forEach((ini, k) => {
    const bloco = linhas.slice(ini + 1, inicios[k + 1] ?? linhas.length);
    const nome = linhas[ini].replace(/\s+/g, ' ').replace(/\s*\/\s*/, '/');
    const iTaxa = bloco.findIndex(l => /^taxa/i.test(l));
    const taxa = (iTaxa >= 0 ? bloco[iTaxa + 1] : bloco.find(l => /%\s*a\.?\s*[ma]\.?/i.test(l))) || '';
    const vals = bloco.filter(l => !/%/.test(l)).flatMap(valoresTexto);
    let saldo: number, liquido: number;
    if (vals.length >= 4) {
      saldo = vals[1];
      liquido = vals[3];
    } else {
      saldo = Math.max(...vals);
      liquido = vals.filter(v => v < saldo).sort((a, b) => b - a)[0] ?? saldo;
    }
    if (!(saldo > 0)) {
      avisos.push(`Não consegui ler os valores de ${nome}: preencha na tabela.`);
      saldo = 0;
      liquido = 0;
    }
    const t = norm(taxa);
    regs.push({
      mercado: 'Renda Fixa',
      sub: 'PRIVADO',
      ativo: nome,
      produto: 'Título de securitização',
      emissor: 'RHINO SECURITIZADORA S.A.',
      estrategia: /ipca|ipc|igp/.test(t) ? 'Inflação' : /cdi|selic/.test(t) ? 'Pós-fixado' : 'Pré-fixado',
      taxaTexto: taxa.replace(/\s+/g, ' '),
      bruto: saldo,
      liquido
    });
  });

  if (!regs.length) throw new Error('Não reconheci os blocos do extrato da Rhino na foto. Tente uma foto mais nítida ou preencha pelo Excel padrão.');
  const somaLiq = somaLista(regs, r => r.liquido);
  if (totalLiq !== null) {
    avisos.unshift(
      Math.abs(somaLiq - totalLiq) < 0.05
        ? `Conferido: os líquidos lidos somam ${brl(somaLiq)}, igual ao total da foto.`
        : `Os líquidos lidos somam ${brl(somaLiq)}, mas a foto mostra ${brl(totalLiq)}: confira os valores na tabela.`
    );
  }
  avisos.push('Lido por reconhecimento de texto (foto): confira nome e valores antes de adicionar. Vencimento não aparece no extrato.');
  return { inst: 'Rhino', conta: '', clienteSugerido: null, data: null, total: null, regs, avisos, revisar: true };
}
