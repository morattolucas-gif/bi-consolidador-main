import { numBR, num } from '../components/formatters';
import { somaLista } from '../domain/precision';
import type { ExtratoLido, ExtratoRegistro } from '../types';

export function lerNomad(linhas: string[]): ExtratoLido {
  const TIPOS: Record<string, string> = {
    ETF: 'ETF',
    STOCK: 'Ação',
    REIT: 'REIT',
    FIXED_INCOME_ETF: 'ETF de renda fixa',
    BOND: 'Título',
    MUTUAL_FUND: 'Fundo',
    CRYPTO: 'Cripto',
    OPTION: 'Opção'
  };
  const re = new RegExp(`^(.+?)\\s+(${Object.keys(TIPOS).join('|')})\\s+([A-Z][A-Z0-9.\\-]*)\\s+([\\d.,]+)\\s+\\$\\s*([\\d.,]+)\\s+\\$\\s*([\\d.,]+)\\s+([\\d.,]+)\\s*%$`);
  const regs: ExtratoRegistro[] = [];
  let somaPct = 0;

  for (const l of linhas) {
    const m = l.match(re);
    if (!m) continue;
    const usd = numBR(m[6]);
    somaPct += numBR(m[7]);
    regs.push({
      mercado: 'Internacional',
      sub: TIPOS[m[2]],
      ativo: m[3],
      produto: m[1].trim(),
      estrategia: 'Internacional',
      usd,
      moeda: 'USD',
      bruto: 0,
      liquido: 0
    });
  }

  if (!regs.length) throw new Error('Não encontrei a tabela de posições da Nomad (Nome, Tipo, Ticker, QTD, Valor unt, Posição, Porcentagem).');
  const avisos = [
    'Valores em dólar: informe o câmbio (já sugerido pela PTAX do Banco Central).',
    'O extrato da Nomad não traz o nome do cliente nem a data da posição.'
  ];
  if (Math.abs(somaPct - 100) > 0.5) avisos.push(`Os percentuais lidos somam ${num(somaPct, 2)}%: pode faltar alguma linha. Confira na tabela.`);

  return {
    inst: 'Nomad',
    conta: '',
    clienteSugerido: null,
    data: null,
    total: null,
    totalUSD: somaLista(regs, r => r.usd || 0),
    moeda: 'USD',
    regs,
    avisos,
    revisar: true
  };
}

export async function buscarPtax(): Promise<{ cambio: number; data: string } | null> {
  const f = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
  const fim = new Date(), ini = new Date(Date.now() - 10 * 864e5);
  const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@dataInicial='${f(ini)}'&@dataFinalCotacao='${f(fim)}'&$format=json`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const v = (await r.json()).value;
    const u = v?.at(-1);
    return u ? { cambio: u.cotacaoVenda, data: u.dataHoraCotacao?.slice(0, 10) } : null;
  } catch {
    return null;
  }
}
