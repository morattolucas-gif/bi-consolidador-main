import { S } from './state';
import { somar, valor, unidades } from './calculations';
import { somaPrecisa, subPrecisa, multPrecisa, divPrecisa, somaLista } from './precision';
import { POLITICA_PADRAO, CLASSES_EST, RISCO_CREDITO } from './constants';
import { dgEnriquecer } from '../components/views/diagnostico';
import type { Posicao, PoliticaInvestimento, PoliticaFaixa } from '../types';

export interface DesvioAlocacao {
  dimensao: 'classe' | 'credito';
  chave: string;
  nome: string;
  pctAtual: number;
  pctMin: number;
  pctMax: number;
  pctAlvo: number;
  valorAtual: number;
  deltaMinR$: number;
  deltaAlvoR$: number;
  tipo: 'excesso' | 'deficit';
  status: 'alerta' | 'critico';
  mensagem: string;
}

export interface UnidadeDiagnosticoRisco {
  key: string;
  nome: string;
  tipo: string;
  pl: number;
  contas: string[];
  status: 'desenquadrado' | 'alerta' | 'enquadrado';
  desviosClasses: DesvioAlocacao[];
  desviosCredito: DesvioAlocacao[];
  gapRebalanceamentoR$: number;
  vencimentosProximos: {
    ativo: string;
    vencimento: Date;
    diasRestantes: number;
    valor: number;
  }[];
  liquidezCurtoPrazo: number;
  pctLiquidezCurtoPrazo: number;
}

export interface SugestaoSwap {
  clienteNome?: string;
  origem: {
    tipo: 'classe_excesso' | 'vencimento' | 'caixa';
    descricao: string;
    valorDisponivel: number;
  };
  destino: {
    classe: string;
    nomeClasse: string;
    deficitR$: number;
    alvoR$: number;
  };
  valorSugeridoR$: number;
  impactoEsperado: string;
  urgencia?: 'alta' | 'media' | 'baixa';
}

export interface ResumoDiagnosticoPortfolio {
  totalPL: number;
  pctEnquadrado: number;
  qtdClientesTotal: number;
  qtdClientesDesenquadrados: number;
  qtdClientesAlerta: number;
  qtdClientesEnquadrados: number;
  volumeGapRebalanceamentoR$: number;
  liquidezCurtoPrazoTotal: number;
  pctLiquidezCurtoPrazo: number;
  vencimentos90DiasTotal: number;
  topEmissorNome: string;
  topEmissorR$: number;
  topEmissorPct: number;
  topEmissorAlerta: boolean;
  unidades: UnidadeDiagnosticoRisco[];
  sugestoesSwaps: SugestaoSwap[];
}

export type DiagnosticoGlobal = ResumoDiagnosticoPortfolio;
export type DiagnosticoUnidade = UnidadeDiagnosticoRisco;

export function obterPoliticaContaOuPadrao(conta: string): PoliticaInvestimento {
  if (S.politicasPorConta?.has(conta)) {
    return S.politicasPorConta.get(conta)!;
  }
  return POLITICA_PADRAO;
}

export function calcularDiagnosticoBase(
  posicoes: Posicao[] = S.posicoes,
  nivel: 'cliente' | 'familia' = 'cliente',
  dataBase: Date = new Date()
): ResumoDiagnosticoPortfolio {
  const totalPL = somar(posicoes);
  const uLista = [...unidades(nivel).values()];
  const unidadesDiag: UnidadeDiagnosticoRisco[] = [];

  let volumeGapTotal = 0;
  let liqCurtoPrazoTotal = 0;

  // Agrupamento por emissor para calcular concentração consolidada da base
  const somaPorEmissor = new Map<string, number>();

  for (const u of uLista) {
    const contasSet = new Set(u.contas);
    const posUnidade = posicoes.filter(p => contasSet.has(p.conta));
    const plUnidade = somaLista(posUnidade, valor);
    if (plUnidade <= 0.001) continue;

    // Enriquecimento analítico das posições (classes, contrapartes, liquidez real D+, vencimentos)
    const enriquecidas = posUnidade.map(p => dgEnriquecer(p, dataBase));

    // Determina a política aplicável (da primeira conta configurada ou padrão)
    let pol: PoliticaInvestimento = POLITICA_PADRAO;
    for (const c of u.contas) {
      if (S.politicasPorConta?.has(c)) {
        pol = S.politicasPorConta.get(c)!;
        break;
      }
    }
    const polClasses = pol.classes || POLITICA_PADRAO.classes;
    const polCred = pol.credito || POLITICA_PADRAO.credito;

    // 1. Desvios por Classe Estratégica
    const classesAgrupadas = new Map<string, number>();
    for (const x of enriquecidas) {
      classesAgrupadas.set(x.classe, somaPrecisa(classesAgrupadas.get(x.classe) || 0, x.v));
    }

    const desviosClasses: DesvioAlocacao[] = [];
    let gapUnidade = 0;

    for (const [clKey, faixa] of Object.entries(polClasses)) {
      const vAtual = classesAgrupadas.get(clKey) || 0;
      const pctAtual = divPrecisa(vAtual, plUnidade);
      const vMin = multPrecisa(faixa.min, plUnidade);
      const vMax = multPrecisa(faixa.max, plUnidade);
      const vAlvo = multPrecisa(faixa.alvo, plUnidade);

      if (pctAtual > faixa.max + 0.001) {
        const deltaMax = subPrecisa(vAtual, vMax);
        gapUnidade = somaPrecisa(gapUnidade, deltaMax);
        desviosClasses.push({
          dimensao: 'classe',
          chave: clKey,
          nome: CLASSES_EST[clKey] || clKey,
          pctAtual,
          pctMin: faixa.min,
          pctMax: faixa.max,
          pctAlvo: faixa.alvo,
          valorAtual: vAtual,
          deltaMinR$: deltaMax,
          deltaAlvoR$: subPrecisa(vAtual, vAlvo),
          tipo: 'excesso',
          status: pctAtual > faixa.max * 1.25 ? 'critico' : 'alerta',
          mensagem: `Excesso de ${((pctAtual - faixa.max) * 100).toFixed(1)}% acima do teto de ${(faixa.max * 100).toFixed(1)}%`
        });
      } else if (pctAtual < faixa.min - 0.001) {
        const deltaMin = subPrecisa(vMin, vAtual);
        gapUnidade = somaPrecisa(gapUnidade, deltaMin);
        desviosClasses.push({
          dimensao: 'classe',
          chave: clKey,
          nome: CLASSES_EST[clKey] || clKey,
          pctAtual,
          pctMin: faixa.min,
          pctMax: faixa.max,
          pctAlvo: faixa.alvo,
          valorAtual: vAtual,
          deltaMinR$: deltaMin,
          deltaAlvoR$: subPrecisa(vAlvo, vAtual),
          tipo: 'deficit',
          status: pctAtual < faixa.min * 0.75 ? 'critico' : 'alerta',
          mensagem: `Déficit de ${((faixa.min - pctAtual) * 100).toFixed(1)}% abaixo do piso de ${(faixa.min * 100).toFixed(1)}%`
        });
      }
    }

    // 2. Desvios por Risco de Crédito
    const credAgrupado = new Map<string, number>();
    for (const x of enriquecidas) {
      credAgrupado.set(x.cp, somaPrecisa(credAgrupado.get(x.cp) || 0, x.v));
    }

    const desviosCredito: DesvioAlocacao[] = [];
    for (const [crKey, faixa] of Object.entries(polCred)) {
      const vAtual = credAgrupado.get(crKey) || 0;
      const pctAtual = divPrecisa(vAtual, plUnidade);
      const vMax = multPrecisa(faixa.max, plUnidade);

      // Em risco de crédito, a preocupação prioritária do Gestor de Risco é o estouro de teto (Hard breach)
      if (pctAtual > faixa.max + 0.001) {
        const deltaMax = subPrecisa(vAtual, vMax);
        desviosCredito.push({
          dimensao: 'credito',
          chave: crKey,
          nome: RISCO_CREDITO[crKey] || crKey,
          pctAtual,
          pctMin: faixa.min,
          pctMax: faixa.max,
          pctAlvo: faixa.alvo,
          valorAtual: vAtual,
          deltaMinR$: deltaMax,
          deltaAlvoR$: subPrecisa(vAtual, multPrecisa(faixa.alvo, plUnidade)),
          tipo: 'excesso',
          status: pctAtual > faixa.max * 1.2 ? 'critico' : 'alerta',
          mensagem: `Limite de ${(faixa.max * 100).toFixed(1)}% excedido (atual: ${(pctAtual * 100).toFixed(1)}%)`
        });
      }
    }

    // 3. Liquidez de Curto Prazo (< D+5)
    let liqCurtoUnidade = 0;
    for (const x of enriquecidas) {
      if (x.janela === 'dia' || x.janela === 'bolsa' || x.janela === 'd2' || x.janela === 'd0' || x.janela === 'd1' || x.classe === 'Caixa') {
        liqCurtoUnidade = somaPrecisa(liqCurtoUnidade, x.v);
      } else {
        const m = x.janela?.match(/^d(\d+)$/i);
        if (m && parseInt(m[1], 10) <= 5) {
          liqCurtoUnidade = somaPrecisa(liqCurtoUnidade, x.v);
        }
      }
    }
    liqCurtoPrazoTotal = somaPrecisa(liqCurtoPrazoTotal, liqCurtoUnidade);

    // 4. Vencimentos próximos (próximos 90 dias)
    const hojeMs = dataBase.getTime();
    const noventaDiasMs = hojeMs + 90 * 24 * 3600 * 1000;
    const vencProximos = enriquecidas
      .filter(x => x.p.vencimento instanceof Date && x.p.vencimento.getTime() >= hojeMs - 24 * 3600 * 1000 && x.p.vencimento.getTime() <= noventaDiasMs)
      .map(x => ({
        ativo: x.nome,
        vencimento: x.p.vencimento as Date,
        diasRestantes: Math.max(0, Math.round(((x.p.vencimento as Date).getTime() - hojeMs) / (24 * 3600 * 1000))),
        valor: x.v
      }))
      .sort((a, b) => a.diasRestantes - b.diasRestantes);

    // Acumula concentração por emissor
    for (const x of enriquecidas) {
      const em = x.ge || x.p.emissor || 'Outros';
      somaPorEmissor.set(em, somaPrecisa(somaPorEmissor.get(em) || 0, x.v));
    }

    // Status geral da Unidade
    let statusUnidade: 'desenquadrado' | 'alerta' | 'enquadrado' = 'enquadrado';
    const temCritico = desviosClasses.some(d => d.status === 'critico') || desviosCredito.some(d => d.status === 'critico');
    const temAlerta = desviosClasses.length > 0 || desviosCredito.length > 0;

    if (temCritico) {
      statusUnidade = 'desenquadrado';
    } else if (temAlerta) {
      statusUnidade = 'alerta';
    }

    volumeGapTotal = somaPrecisa(volumeGapTotal, gapUnidade);

    unidadesDiag.push({
      key: u.key,
      nome: u.nome,
      tipo: u.tipo,
      pl: plUnidade,
      contas: u.contas,
      status: statusUnidade,
      desviosClasses,
      desviosCredito,
      gapRebalanceamentoR$: gapUnidade,
      vencimentosProximos: vencProximos,
      liquidezCurtoPrazo: liqCurtoUnidade,
      pctLiquidezCurtoPrazo: divPrecisa(liqCurtoUnidade, plUnidade)
    });
  }

  // Ordena por criticidade: Desenquadrados primeiro, depois Alerta, depois Enquadrados (e por maior PL)
  const pesoStatus = { desenquadrado: 0, alerta: 1, enquadrado: 2 };
  unidadesDiag.sort((a, b) => {
    const sDiff = pesoStatus[a.status] - pesoStatus[b.status];
    if (sDiff !== 0) return sDiff;
    return b.pl - a.pl;
  });

  const qtdDesenquadrados = unidadesDiag.filter(u => u.status === 'desenquadrado').length;
  const qtdAlerta = unidadesDiag.filter(u => u.status === 'alerta').length;
  const qtdEnquadrados = unidadesDiag.filter(u => u.status === 'enquadrado').length;
  const totalClientes = unidadesDiag.length;

  const plEnquadrado = somaLista(unidadesDiag.filter(u => u.status === 'enquadrado'), u => u.pl);
  const pctEnquadrado = totalPL > 0 ? divPrecisa(plEnquadrado, totalPL) : 1;

  // Maior Emissor
  let topEmissorNome = 'Nenhum';
  let topEmissorR$ = 0;
  for (const [em, v] of somaPorEmissor.entries()) {
    if (v > topEmissorR$) {
      topEmissorR$ = v;
      topEmissorNome = em;
    }
  }
  const topEmissorPct = totalPL > 0 ? divPrecisa(topEmissorR$, totalPL) : 0;
  const topEmissorAlerta = topEmissorPct > 0.20 && !topEmissorNome.toLowerCase().includes('tesouro');

  // 5. Geração de Sugestões de Swaps (Casamento de Excesso -> Déficit)
  const sugestoesSwaps: SugestaoSwap[] = [];
  for (const u of unidadesDiag) {
    const excessos = u.desviosClasses.filter(d => d.tipo === 'excesso').sort((a, b) => b.deltaMinR$ - a.deltaMinR$);
    const deficits = u.desviosClasses.filter(d => d.tipo === 'deficit').sort((a, b) => b.deltaMinR$ - a.deltaMinR$);

    // Fontes extras: Vencimentos próximos
    for (const v of u.vencimentosProximos) {
      if (deficits.length > 0) {
        const dest = deficits[0];
        const valorSwap = Math.min(v.valor, dest.deltaAlvoR$);
        if (valorSwap > 1000) {
          sugestoesSwaps.push({
            clienteNome: u.nome,
            origem: {
              tipo: 'vencimento',
              descricao: `Vencimento ${v.ativo} (${v.diasRestantes} dias)`,
              valorDisponivel: v.valor
            },
            destino: {
              classe: dest.chave,
              nomeClasse: dest.nome,
              deficitR$: dest.deltaMinR$,
              alvoR$: dest.deltaAlvoR$
            },
            valorSugeridoR$: valorSwap,
            impactoEsperado: `Reinveste liquidação de vencimento sanando déficit em ${dest.nome}`,
            urgencia: v.diasRestantes <= 15 ? 'alta' : 'media'
          });
          dest.deltaAlvoR$ = subPrecisa(dest.deltaAlvoR$, valorSwap);
        }
      }
    }

    // Fontes de classes com excesso
    for (const exc of excessos) {
      if (deficits.length > 0) {
        const dest = deficits.find(d => d.deltaAlvoR$ > 1000) || deficits[0];
        const valorSwap = Math.min(exc.deltaMinR$, dest.deltaAlvoR$);
        if (valorSwap > 1000) {
          sugestoesSwaps.push({
            clienteNome: u.nome,
            origem: {
              tipo: 'classe_excesso',
              descricao: `Resgate em ${exc.nome} (acima do teto)`,
              valorDisponivel: exc.deltaMinR$
            },
            destino: {
              classe: dest.chave,
              nomeClasse: dest.nome,
              deficitR$: dest.deltaMinR$,
              alvoR$: dest.deltaAlvoR$
            },
            valorSugeridoR$: valorSwap,
            impactoEsperado: `Reduz ${exc.nome} ao teto e aloca em ${dest.nome}`,
            urgencia: exc.status === 'critico' ? 'alta' : 'media'
          });
        }
      }
    }
  }

  const vencimentos90DiasTotal = somaLista(unidadesDiag.flatMap(u => u.vencimentosProximos), v => v.valor);

  return {
    totalPL,
    pctEnquadrado,
    qtdClientesTotal: totalClientes,
    qtdClientesDesenquadrados: qtdDesenquadrados,
    qtdClientesAlerta: qtdAlerta,
    qtdClientesEnquadrados: qtdEnquadrados,
    volumeGapRebalanceamentoR$: volumeGapTotal,
    liquidezCurtoPrazoTotal: liqCurtoPrazoTotal,
    pctLiquidezCurtoPrazo: totalPL > 0 ? divPrecisa(liqCurtoPrazoTotal, totalPL) : 0,
    vencimentos90DiasTotal,
    topEmissorNome,
    topEmissorR$,
    topEmissorPct,
    topEmissorAlerta,
    unidades: unidadesDiag,
    sugestoesSwaps: sugestoesSwaps.slice(0, 10)
  };
}
