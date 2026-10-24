import * as XLSX from 'xlsx';
import { S } from '../../domain/state';
import { $ } from '../dom';
import { esc, brl, brlCurto, pct, inteiro, num, norm } from '../formatters';
import { salvarFaixasBase } from '../../domain/storage';
import { FAIXAS_PADRAO_BASE } from '../../domain/constants';
import type { BaseBtgConta, FaixaPLConfig } from '../../types';

interface ItemUnidade {
  chave: string;
  conta: string;
  contas: string[];
  nome: string;
  tipo: 'PF' | 'PJ' | 'Estrangeiro' | 'Outro';
  plTotal: number;
  assessor: string;
  status: string;
  tipoInvestidor: string;
  faixaBtg?: string;
  cidade?: string;
  estado?: string;
  idCliente?: string;
}

export function obterItensBase(): ItemUnidade[] {
  const modo = S.filtroBase.modo || 'conta';
  if (modo === 'conta') {
    return S.baseBtg.map(c => ({
      chave: c.conta,
      conta: c.conta,
      contas: [c.conta],
      nome: c.nome,
      tipo: c.tipo,
      plTotal: c.plTotal,
      assessor: c.assessor,
      status: c.status,
      tipoInvestidor: c.tipoInvestidor,
      faixaBtg: c.faixaBtg,
      cidade: c.cidade,
      estado: c.estado,
      idCliente: c.idCliente
    }));
  }

  // Agrupado por ID Cliente
  const mapa = new Map<string, ItemUnidade>();
  for (const c of S.baseBtg) {
    const k = c.idCliente || `conta:${c.conta}`;
    const item = mapa.get(k);
    if (!item) {
      mapa.set(k, {
        chave: k,
        conta: c.conta,
        contas: [c.conta],
        nome: c.nome,
        tipo: c.tipo,
        plTotal: c.plTotal,
        assessor: c.assessor,
        status: c.status,
        tipoInvestidor: c.tipoInvestidor,
        faixaBtg: c.faixaBtg,
        cidade: c.cidade,
        estado: c.estado,
        idCliente: c.idCliente
      });
    } else {
      item.contas.push(c.conta);
      item.plTotal += c.plTotal;
      // Se tiver mais de uma conta e uma for PJ, prioriza PJ ou mantém
      if (c.tipo === 'PJ' && item.tipo !== 'PJ') item.tipo = 'PJ';
      if (item.status !== 'Ativa' && c.status === 'Ativa') item.status = 'Ativa';
    }
  }
  return [...mapa.values()];
}

export function filtrarItensBase(itens: ItemUnidade[]): ItemUnidade[] {
  const f = S.filtroBase;
  const busca = norm(f.busca);

  return itens.filter(item => {
    if (f.assessor && item.assessor !== f.assessor) return false;
    if (f.status && norm(item.status) !== norm(f.status)) return false;
    if (f.tipoInvestidor && norm(item.tipoInvestidor) !== norm(f.tipoInvestidor)) return false;
    if (busca) {
      const match = norm(item.nome).includes(busca) ||
                    item.contas.some(ct => ct.includes(busca)) ||
                    norm(item.cidade || '').includes(busca);
      if (!match) return false;
    }
    return true;
  });
}

function faixaDePL(pl: number, faixas: FaixaPLConfig[]): FaixaPLConfig | undefined {
  return faixas.find(f => pl >= f.min && pl < f.max);
}

export const FAIXAS_PREDEFINIDAS_SIM: Record<string, { rotulo: string; min: number; max: number }> = {
  '100k-500k': { rotulo: '🎯 100k a 500 mil (Foco Principal)', min: 100000, max: 500000 },
  'ate-100k': { rotulo: 'Até 100 mil', min: 0.01, max: 100000 },
  '500k-1mi': { rotulo: '500 mil a 1 milhão', min: 500000, max: 1000000 },
  '1mi-5mi': { rotulo: '1 milhão a 5 milhões', min: 1000000, max: 5000000 },
  'acima-5mi': { rotulo: 'Acima de 5 milhões', min: 5000000, max: Infinity },
  'todas-saldo': { rotulo: 'Todas com Saldo (> 0)', min: 0.01, max: Infinity },
};

export interface ResultadoSimulacaoPlano {
  totalContas: number;
  pfContas: number;
  pjContas: number;
  totalPl: number;
  pfPl: number;
  pjPl: number;
  ticketMedio: number;
  taxaPfAa: number;
  taxaPjAa: number;
  taxaPfAm: number;
  taxaPjAm: number;
  prazoMeses: number;
  receitaPfMensalPlena: number;
  receitaPjMensalPlena: number;
  receitaMensalPlena: number;
  receitaAnualPlena: number;
  faturamentoAcumuladoPeriodo: number;
  metaMensalContasTotal: number;
  evolucaoMeses: Array<{
    mes: number;
    pctProgresso: number;
    contasNoMes: number;
    aumPf: number;
    aumPj: number;
    aumTotal: number;
    receitaPf: number;
    receitaPj: number;
    receitaTotal: number;
    runRateAnual: number;
  }>;
  porAssessor: Array<{
    assessor: string;
    pfContas: number;
    pjContas: number;
    totalContas: number;
    pfPl: number;
    pjPl: number;
    totalPl: number;
    metaMensalContas: number;
    receitaPfMensal: number;
    receitaPjMensal: number;
    receitaTotalMensal: number;
    receitaAnual: number;
    shareReceita: number;
  }>;
  contasElegiveis: ItemUnidade[];
}

export function calcularSimulacaoPlano(itensTodos: ItemUnidade[]): ResultadoSimulacaoPlano {
  const sim = S.simuladorPlano;
  const taxaPfAm = (sim.taxaPfAa / 100) / 12;
  const taxaPjAm = (sim.taxaPjAa / 100) / 12;
  const prazo = Math.max(1, Math.round(sim.prazoMeses || 6));

  const faixasBase = S.faixasBase || FAIXAS_PADRAO_BASE;
  const selFaixas = sim.faixasSelecionadas || [];
  const faixasAtivas = faixasBase.filter(f => selFaixas.includes(f.rotulo));

  const elegiveis = itensTodos.filter(c => {
    if (c.plTotal <= 0) return false;
    const pertenceFaixa = faixasAtivas.some(f => c.plTotal >= f.min && c.plTotal < f.max);
    if (!pertenceFaixa) return false;
    if (sim.excluirEstrangeiros && (c.tipo === 'Estrangeiro' || norm(c.tipoInvestidor || '').includes('estrangeiro'))) {
      return false;
    }
    if (sim.assessorSel && c.assessor !== sim.assessorSel) return false;
    return true;
  });

  const pfItens = elegiveis.filter(c => c.tipo === 'PF');
  const pjItens = elegiveis.filter(c => c.tipo === 'PJ');

  const pfContas = pfItens.length;
  const pjContas = pjItens.length;
  const totalContas = elegiveis.length;

  const pfPl = pfItens.reduce((s, c) => s + c.plTotal, 0);
  const pjPl = pjItens.reduce((s, c) => s + c.plTotal, 0);
  const totalPl = pfPl + pjPl;
  const ticketMedio = totalContas > 0 ? totalPl / totalContas : 0;

  const receitaPfMensalPlena = pfPl * taxaPfAm;
  const receitaPjMensalPlena = pjPl * taxaPjAm;
  const receitaMensalPlena = receitaPfMensalPlena + receitaPjMensalPlena;
  const receitaAnualPlena = receitaMensalPlena * 12;

  const metaMensalContasTotal = Math.ceil(totalContas / prazo);

  const evolucaoMeses = [];
  let faturamentoAcumuladoPeriodo = 0;
  for (let m = 1; m <= prazo; m++) {
    const pctProgresso = m / prazo;
    const contasNoMes = Math.round(totalContas * pctProgresso);
    const aumPf = pfPl * pctProgresso;
    const aumPj = pjPl * pctProgresso;
    const aumTotal = totalPl * pctProgresso;
    const receitaPf = aumPf * taxaPfAm;
    const receitaPj = aumPj * taxaPjAm;
    const receitaTotal = receitaPf + receitaPj;
    const runRateAnual = receitaTotal * 12;
    faturamentoAcumuladoPeriodo += receitaTotal;

    evolucaoMeses.push({
      mes: m,
      pctProgresso,
      contasNoMes,
      aumPf,
      aumPj,
      aumTotal,
      receitaPf,
      receitaPj,
      receitaTotal,
      runRateAnual
    });
  }

  const mapaAssessor = new Map<string, { pfContas: number; pjContas: number; pfPl: number; pjPl: number; totalContas: number; totalPl: number }>();
  for (const c of elegiveis) {
    const ass = c.assessor || 'Sem Assessor';
    let reg = mapaAssessor.get(ass);
    if (!reg) {
      reg = { pfContas: 0, pjContas: 0, pfPl: 0, pjPl: 0, totalContas: 0, totalPl: 0 };
      mapaAssessor.set(ass, reg);
    }
    reg.totalContas++;
    reg.totalPl += c.plTotal;
    if (c.tipo === 'PF') {
      reg.pfContas++;
      reg.pfPl += c.plTotal;
    } else if (c.tipo === 'PJ') {
      reg.pjContas++;
      reg.pjPl += c.plTotal;
    }
  }

  const porAssessor = [...mapaAssessor.entries()].map(([assessor, d]) => {
    const receitaPfMensal = d.pfPl * taxaPfAm;
    const receitaPjMensal = d.pjPl * taxaPjAm;
    const receitaTotalMensal = receitaPfMensal + receitaPjMensal;
    const receitaAnual = receitaTotalMensal * 12;
    const shareReceita = receitaMensalPlena > 0 ? receitaTotalMensal / receitaMensalPlena : 0;
    const metaMensalContas = Math.ceil(d.totalContas / prazo);

    return {
      assessor,
      pfContas: d.pfContas,
      pjContas: d.pjContas,
      totalContas: d.totalContas,
      pfPl: d.pfPl,
      pjPl: d.pjPl,
      totalPl: d.totalPl,
      metaMensalContas,
      receitaPfMensal,
      receitaPjMensal,
      receitaTotalMensal,
      receitaAnual,
      shareReceita
    };
  }).sort((a, b) => b.totalPl - a.totalPl);

  return {
    totalContas,
    pfContas,
    pjContas,
    totalPl,
    pfPl,
    pjPl,
    ticketMedio,
    taxaPfAa: sim.taxaPfAa,
    taxaPjAa: sim.taxaPjAa,
    taxaPfAm,
    taxaPjAm,
    prazoMeses: prazo,
    receitaPfMensalPlena,
    receitaPjMensalPlena,
    receitaMensalPlena,
    receitaAnualPlena,
    faturamentoAcumuladoPeriodo,
    metaMensalContasTotal,
    evolucaoMeses,
    porAssessor,
    contasElegiveis: elegiveis
  };
}

export function renderBaseClientes() {
  const box = $('#aba-base');
  if (!box) return;

  if (!S.baseBtg || !S.baseBtg.length) {
    box.innerHTML = `
      <div class="cartao" style="text-align:center;padding:48px 24px;">
        <h2>Nenhuma Base BTG carregada</h2>
        <p class="sec" style="max-width:540px;margin:12px auto 24px;">
          Para gerar a análise e o levantamento de clientes do plano de negócio, anexe a planilha da <b>Base BTG (Export)</b> contendo os tipos PF/PJ e o PL Total.
        </p>
        <button type="button" class="btn btn-pri" id="btn-subir-base-btg">📂 Carregar Base BTG (.xlsx)</button>
        <input type="file" id="arq-base-btg" accept=".xlsx,.xls" hidden>
      </div>
    `;
    $('#btn-subir-base-btg')?.addEventListener('click', () => {
      ($('#arq-base-btg') as HTMLInputElement)?.click();
    });
    $('#arq-base-btg')?.addEventListener('change', async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const { processarArquivo } = await import('../../parsers/pasta');
      await processarArquivo(file);
    });
    return;
  }

  const itensTodos = obterItensBase();
  const itens = filtrarItensBase(itensTodos);

  // Assessores distintos
  const assessores = [...new Set(S.baseBtg.map(c => c.assessor).filter(Boolean))].sort();
  const investidores = [...new Set(S.baseBtg.map(c => c.tipoInvestidor).filter(Boolean))].sort();

  // Métricas gerais
  const plTotalGeral = itens.reduce((s, x) => s + (x.plTotal > 0 ? x.plTotal : 0), 0);
  const totalContasComPL = itens.filter(x => x.plTotal > 0).length;
  const ticketMedio = totalContasComPL > 0 ? plTotalGeral / totalContasComPL : 0;
  const ativas = itens.filter(x => norm(x.status) === 'ativa').length;
  const pctAtivas = itens.length ? (ativas / itens.length) : 0;

  // Faixa destaque (100k a 500k)
  const itens100a500 = itens.filter(x => x.plTotal >= 100000 && x.plTotal < 500000);
  const pf100a500 = itens100a500.filter(x => x.tipo === 'PF').length;
  const pj100a500 = itens100a500.filter(x => x.tipo === 'PJ').length;
  const pl100a500 = itens100a500.reduce((s, x) => s + x.plTotal, 0);

  // Matriz de faixas
  const faixas = S.faixasBase || FAIXAS_PADRAO_BASE;
  const matriz = faixas.map(fx => {
    const doGrupo = itens.filter(x => x.plTotal >= fx.min && x.plTotal < fx.max);
    const pf = doGrupo.filter(x => x.tipo === 'PF');
    const pj = doGrupo.filter(x => x.tipo === 'PJ');
    const est = doGrupo.filter(x => x.tipo === 'Estrangeiro');
    const plPf = pf.reduce((s, x) => s + x.plTotal, 0);
    const plPj = pj.reduce((s, x) => s + x.plTotal, 0);
    const plEst = est.reduce((s, x) => s + x.plTotal, 0);
    const plGrupo = doGrupo.reduce((s, x) => s + x.plTotal, 0);

    return {
      faixa: fx,
      totalQtd: doGrupo.length,
      totalPl: plGrupo,
      pfQtd: pf.length,
      pfPl: plPf,
      pjQtd: pj.length,
      pjPl: plPj,
      estQtd: est.length,
      estPl: plEst,
      shareQtd: itens.length ? doGrupo.length / itens.length : 0,
      sharePl: plTotalGeral ? Math.max(0, plGrupo) / plTotalGeral : 0
    };
  });

  // Filtro de seleção na tabela
  let selecionadas = itens;
  if (S.filtroBase.faixaSel) {
    const fx = faixas.find(f => f.rotulo === S.filtroBase.faixaSel);
    if (fx) {
      selecionadas = selecionadas.filter(x => x.plTotal >= fx.min && x.plTotal < fx.max);
    }
  }
  if (S.filtroBase.tipoSel) {
    selecionadas = selecionadas.filter(x => x.tipo === S.filtroBase.tipoSel);
  }

  // Ordena selecionadas por PL desc
  selecionadas.sort((a, b) => b.plTotal - a.plTotal);

  // Cálculo da Projeção do Plano de Negócios (Carteira Administrada)
  const simRes = calcularSimulacaoPlano(itensTodos);

  box.innerHTML = `
    <!-- Topo de Ações e Título -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
      <div>
        <h2 style="font-size:18px;margin:0 0 4px;font-weight:700;">Base de Clientes & CRM — Plano de Negócio</h2>
        <p class="sec" style="margin:0;font-size:13px;">
          Análise fiduciária e segmentação de contas por tipo (PF/PJ) e faixas de patrimônio da Base BTG.
        </p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button type="button" class="btn btn-sm btn-toggle-bloco" data-bloco="kpis" title="Minimizar ou expandir os indicadores de resumo">
          ${S.baseBlocosRecolhidos.kpis ? '▸ Expandir Resumo (KPIs)' : '▾ Minimizar Resumo'}
        </button>
        <button type="button" class="btn btn-sm" id="btn-editar-faixas">⚙️ Editar Faixas de PL</button>
        <button type="button" class="btn btn-sm btn-pri" id="btn-exportar-plano">📊 Exportar Apresentação (Excel)</button>
        <button type="button" class="btn btn-sm" id="btn-trocar-base">📁 Atualizar Planilha BTG</button>
        <input type="file" id="arq-trocar-base" accept=".xlsx,.xls" hidden>
      </div>
    </div>

    <!-- KPIs de Destaque -->
    ${!S.baseBlocosRecolhidos.kpis ? `
      <div class="kpis" style="margin-bottom:16px;">
        <div class="kpi">
          <span class="kpi-rot">${S.filtroBase.modo === 'cliente' ? 'Clientes Únicos' : 'Total de Contas'}</span>
          <b class="kpi-val">${inteiro(itens.length)}</b>
          <span class="kpi-sub">${inteiro(itens.filter(x => x.tipo === 'PF').length)} PF · ${inteiro(itens.filter(x => x.tipo === 'PJ').length)} PJ</span>
        </div>
        <div class="kpi">
          <span class="kpi-rot">Patrimônio Líquido Total</span>
          <b class="kpi-val">${brlCurto(plTotalGeral)}</b>
          <span class="kpi-sub">${inteiro(totalContasComPL)} com saldo positivo</span>
        </div>
        <div class="kpi" style="border-left:3px solid var(--s1);background:rgba(42,120,214,0.06);">
          <span class="kpi-rot" style="color:var(--s1);font-weight:700;">🎯 Foco: 100k a 500 mil</span>
          <b class="kpi-val" style="color:var(--s1);">${inteiro(itens100a500.length)}</b>
          <span class="kpi-sub"><b>${pf100a500} PF</b> e <b>${pj100a500} PJ</b> (${brlCurto(pl100a500)})</span>
        </div>
        <div class="kpi">
          <span class="kpi-rot">Ticket Médio (PL &gt; 0)</span>
          <b class="kpi-val">${brlCurto(ticketMedio)}</b>
          <span class="kpi-sub">por ${S.filtroBase.modo === 'cliente' ? 'cliente' : 'conta'}</span>
        </div>
        <div class="kpi">
          <span class="kpi-rot">Contas Ativas</span>
          <b class="kpi-val">${pct(pctAtivas, 1)}</b>
          <span class="kpi-sub">${inteiro(ativas)} de ${inteiro(itens.length)} contas</span>
        </div>
      </div>
    ` : ''}

    <!-- Barra de Filtros e Parâmetros -->
    <div class="cartao" style="margin-bottom:16px;padding:12px 16px;">
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;">
        <div>
          <span class="rotulo-ctrl" style="font-size:12px;display:block;margin-bottom:4px;">Agrupamento</span>
          <span class="seg" id="seg-modo-base">
            <button data-v="conta" aria-pressed="${S.filtroBase.modo === 'conta'}">Por Conta</button>
            <button data-v="cliente" aria-pressed="${S.filtroBase.modo === 'cliente'}">Por Cliente (ID Único)</button>
          </span>
        </div>

        <label style="font-size:12px;">
          <span class="sec" style="display:block;margin-bottom:4px;">Assessor</span>
          <select id="sel-base-assessor" style="padding:5px 8px;border-radius:6px;border:1px solid var(--border);">
            <option value="">Todos os Assessores (${assessores.length})</option>
            ${assessores.map(a => `<option value="${esc(a)}" ${S.filtroBase.assessor === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}
          </select>
        </label>

        <label style="font-size:12px;">
          <span class="sec" style="display:block;margin-bottom:4px;">Status</span>
          <select id="sel-base-status" style="padding:5px 8px;border-radius:6px;border:1px solid var(--border);">
            <option value="">Todas (Ativas + Inativas)</option>
            <option value="Ativa" ${norm(S.filtroBase.status) === 'ativa' ? 'selected' : ''}>Só Ativas</option>
            <option value="Inativa" ${norm(S.filtroBase.status) === 'inativa' ? 'selected' : ''}>Só Inativas</option>
          </select>
        </label>

        <label style="font-size:12px;">
          <span class="sec" style="display:block;margin-bottom:4px;">Tipo Investidor</span>
          <select id="sel-base-inv" style="padding:5px 8px;border-radius:6px;border:1px solid var(--border);">
            <option value="">Todos os Tipos</option>
            ${investidores.map(t => `<option value="${esc(t)}" ${S.filtroBase.tipoInvestidor === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
          </select>
        </label>

        <label style="font-size:12px;flex:1;min-width:180px;">
          <span class="sec" style="display:block;margin-bottom:4px;">Busca rápida</span>
          <input type="search" id="busca-base" value="${esc(S.filtroBase.busca)}" placeholder="Nome, conta ou cidade…" style="width:100%;padding:5px 8px;border-radius:6px;border:1px solid var(--border);">
        </label>

        ${(S.filtroBase.assessor || S.filtroBase.status || S.filtroBase.tipoInvestidor || S.filtroBase.busca || S.filtroBase.faixaSel || S.filtroBase.tipoSel) ? `
          <button type="button" class="btn btn-link" id="btn-limpar-filtros-base" style="margin-top:16px;">Limpar filtros</button>
        ` : ''}
      </div>
    </div>

    <!-- SEÇÃO SIMULADOR DE PLANO DE NEGÓCIOS -->
    ${renderSecaoSimulador(simRes, assessores, itensTodos)}

    <!-- Tabela Matriz por Faixa e Tipo -->
    <div class="cartao cartao-destaque" style="margin-bottom:16px;">
      <div class="cartao-topo">
        <div>
          <h2>Matriz de Segmentação por Faixa de Patrimônio e Tipo de Cliente</h2>
          <p>Distribuição de contas e volume financeiro. Clique em qualquer número para filtrar a lista detalhada abaixo.</p>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${S.filtroBase.faixaSel || S.filtroBase.tipoSel ? `
            <div style="font-size:12px;background:var(--surface-2);padding:4px 10px;border-radius:6px;">
              Filtro ativo: <b>${esc(S.filtroBase.faixaSel || 'Todas as faixas')}</b> ${S.filtroBase.tipoSel ? `· <b>${esc(S.filtroBase.tipoSel)}</b>` : ''}
              <button type="button" class="btn-link" id="btn-reset-selecao" style="margin-left:8px;font-size:11px;">[Desmarcar]</button>
            </div>
          ` : ''}
          <button type="button" class="btn btn-sm btn-toggle-bloco" data-bloco="matriz" title="Minimizar ou expandir a Matriz de Segmentação">
            ${S.baseBlocosRecolhidos.matriz ? '▸ Expandir Matriz' : '▾ Minimizar'}
          </button>
        </div>
      </div>

      ${!S.baseBlocosRecolhidos.matriz ? `
        <div style="overflow-x:auto;">
          <table class="tabela-base" style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="border-bottom:2px solid var(--grid);background:var(--surface-2);">
                <th style="text-align:left;padding:10px 12px;">Faixa de Patrimônio</th>
                <th style="text-align:center;padding:10px 12px;background:rgba(42,120,214,0.06);" colspan="2">Pessoa Física (PF)</th>
                <th style="text-align:center;padding:10px 12px;background:rgba(142,68,173,0.06);" colspan="2">Pessoa Jurídica (PJ)</th>
                <th style="text-align:center;padding:10px 12px;" colspan="2">Estrangeiro</th>
                <th style="text-align:right;padding:10px 12px;background:var(--surface-2);" colspan="2">Total Geral</th>
                <th style="text-align:right;padding:10px 12px;">Share PL</th>
              </tr>
              <tr style="border-bottom:1px solid var(--grid);font-size:11.5px;color:var(--muted);">
                <th style="text-align:left;padding:6px 12px;">Faixa</th>
                <th style="text-align:right;padding:6px 8px;background:rgba(42,120,214,0.06);">Contas</th>
                <th style="text-align:right;padding:6px 8px;background:rgba(42,120,214,0.06);">Volume</th>
                <th style="text-align:right;padding:6px 8px;background:rgba(142,68,173,0.06);">Contas</th>
                <th style="text-align:right;padding:6px 8px;background:rgba(142,68,173,0.06);">Volume</th>
                <th style="text-align:right;padding:6px 8px;">Contas</th>
                <th style="text-align:right;padding:6px 8px;">Volume</th>
                <th style="text-align:right;padding:6px 8px;background:var(--surface-2);">Qtd</th>
                <th style="text-align:right;padding:6px 8px;background:var(--surface-2);">PL</th>
                <th style="text-align:right;padding:6px 12px;">%</th>
              </tr>
            </thead>
            <tbody>
              ${matriz.map(m => {
                const ehFoco = m.faixa.rotulo === '100 a 500 mil';
                const estaSel = S.filtroBase.faixaSel === m.faixa.rotulo;
                const bgLinha = estaSel ? 'background:rgba(42,120,214,0.12);' : ehFoco ? 'background:rgba(42,120,214,0.03);' : '';
                const borderDestaque = ehFoco ? 'box-shadow:inset 3px 0 0 var(--s1);font-weight:600;' : '';

                return `
                  <tr style="border-bottom:1px solid var(--grid);cursor:pointer;${bgLinha}${borderDestaque}" data-faixa="${esc(m.faixa.rotulo)}">
                    <td style="padding:9px 12px;font-weight:600;">
                      ${ehFoco ? '🎯 ' : ''}${esc(m.faixa.rotulo)}
                    </td>
                    <!-- PF -->
                    <td style="text-align:right;padding:9px 8px;background:rgba(42,120,214,0.04);font-weight:600;" data-click-tipo="PF" data-click-faixa="${esc(m.faixa.rotulo)}" title="Ver contas PF de ${esc(m.faixa.rotulo)}">
                      ${inteiro(m.pfQtd)}
                    </td>
                    <td style="text-align:right;padding:9px 8px;background:rgba(42,120,214,0.04);color:var(--ink-2);" class="num">
                      ${brlCurto(m.pfPl)}
                    </td>
                    <!-- PJ -->
                    <td style="text-align:right;padding:9px 8px;background:rgba(142,68,173,0.04);font-weight:700;color:#6c3483;" data-click-tipo="PJ" data-click-faixa="${esc(m.faixa.rotulo)}" title="Ver contas PJ de ${esc(m.faixa.rotulo)}">
                      ${inteiro(m.pjQtd)}
                    </td>
                    <td style="text-align:right;padding:9px 8px;background:rgba(142,68,173,0.04);color:var(--ink-2);" class="num">
                      ${brlCurto(m.pjPl)}
                    </td>
                    <!-- Estrangeiro -->
                    <td style="text-align:right;padding:9px 8px;" class="num" data-click-tipo="Estrangeiro" data-click-faixa="${esc(m.faixa.rotulo)}">
                      ${inteiro(m.estQtd)}
                    </td>
                    <td style="text-align:right;padding:9px 8px;color:var(--muted);" class="num">
                      ${brlCurto(m.estPl)}
                    </td>
                    <!-- Total -->
                    <td style="text-align:right;padding:9px 8px;font-weight:700;background:var(--surface-2);" class="num" data-click-faixa="${esc(m.faixa.rotulo)}">
                      ${inteiro(m.totalQtd)}
                    </td>
                    <td style="text-align:right;padding:9px 8px;font-weight:700;background:var(--surface-2);" class="num">
                      ${brlCurto(m.totalPl)}
                    </td>
                    <!-- Share PL -->
                    <td style="text-align:right;padding:9px 12px;font-weight:600;" class="num">
                      ${pct(m.sharePl, 1)}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="border-top:2px solid var(--marca);font-weight:700;background:var(--surface-2);">
                <td style="padding:10px 12px;">TOTAL GERAL</td>
                <td style="text-align:right;padding:10px 8px;" class="num">${inteiro(matriz.reduce((s, m) => s + m.pfQtd, 0))}</td>
                <td style="text-align:right;padding:10px 8px;" class="num">${brlCurto(matriz.reduce((s, m) => s + m.pfPl, 0))}</td>
                <td style="text-align:right;padding:10px 8px;color:#6c3483;" class="num">${inteiro(matriz.reduce((s, m) => s + m.pjQtd, 0))}</td>
                <td style="text-align:right;padding:10px 8px;" class="num">${brlCurto(matriz.reduce((s, m) => s + m.pjPl, 0))}</td>
                <td style="text-align:right;padding:10px 8px;" class="num">${inteiro(matriz.reduce((s, m) => s + m.estQtd, 0))}</td>
                <td style="text-align:right;padding:10px 8px;" class="num">${brlCurto(matriz.reduce((s, m) => s + m.estPl, 0))}</td>
                <td style="text-align:right;padding:10px 8px;" class="num">${inteiro(matriz.reduce((s, m) => s + m.totalQtd, 0))}</td>
                <td style="text-align:right;padding:10px 8px;" class="num">${brlCurto(plTotalGeral)}</td>
                <td style="text-align:right;padding:10px 12px;" class="num">100,0%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ` : ''}
    </div>

    <!-- Tabela Detalhada de Contas da Seleção -->
    <div class="cartao">
      <div class="cartao-topo">
        <div>
          <h2>
            ${S.filtroBase.faixaSel || S.filtroBase.tipoSel
              ? `Contas Filtradas: ${esc(S.filtroBase.faixaSel || 'Todas as Faixas')} ${S.filtroBase.tipoSel ? `· Tipo ${esc(S.filtroBase.tipoSel)}` : ''}`
              : 'Detalhamento das Contas'}
            <span class="muted" style="font-weight:400;font-size:13px;">(${inteiro(selecionadas.length)} encontradas — Total: ${brlCurto(selecionadas.reduce((s, x) => s + (x.plTotal > 0 ? x.plTotal : 0), 0))})</span>
          </h2>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <button type="button" class="btn btn-sm" id="btn-exportar-selecao">📥 Baixar Lista Filtrada (Excel)</button>
          <button type="button" class="btn btn-sm btn-toggle-bloco" data-bloco="contas" title="Minimizar ou expandir a lista de contas">
            ${S.baseBlocosRecolhidos.contas ? '▸ Expandir Contas' : '▾ Minimizar'}
          </button>
        </div>
      </div>

      ${!S.baseBlocosRecolhidos.contas ? `
        <div style="max-height:480px;overflow:auto;border:1px solid var(--grid);border-radius:8px;">
          <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
            <thead style="position:sticky;top:0;background:var(--surface-2);z-index:2;border-bottom:1px solid var(--grid);">
              <tr>
                <th style="text-align:left;padding:8px 10px;">Conta</th>
                <th style="text-align:left;padding:8px 10px;">Nome do Titular</th>
                <th style="text-align:center;padding:8px 8px;">Tipo</th>
                <th style="text-align:left;padding:8px 10px;">Assessor</th>
                <th style="text-align:center;padding:8px 8px;">Status</th>
                <th style="text-align:left;padding:8px 8px;">Tipo Investidor</th>
                <th style="text-align:left;padding:8px 8px;">Cidade / UF</th>
                <th style="text-align:right;padding:8px 10px;">Patrimônio Líquido (PL)</th>
              </tr>
            </thead>
            <tbody>
              ${selecionadas.slice(0, 500).map(c => `
                <tr style="border-bottom:1px solid var(--grid);">
                  <td style="padding:6px 10px;font-family:monospace;font-weight:600;">${esc(c.conta)}</td>
                  <td style="padding:6px 10px;font-weight:600;">${esc(c.nome)}</td>
                  <td style="padding:6px 8px;text-align:center;">
                    <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:700;${
                      c.tipo === 'PJ' ? 'background:rgba(142,68,173,0.15);color:#6c3483;' :
                      c.tipo === 'PF' ? 'background:rgba(42,120,214,0.15);color:#1c5cab;' :
                      'background:rgba(39,174,96,0.15);color:#196f3d;'
                    }">
                      ${esc(c.tipo)}
                    </span>
                  </td>
                  <td style="padding:6px 10px;color:var(--ink-2);">${esc(c.assessor || '–')}</td>
                  <td style="padding:6px 8px;text-align:center;">
                    <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;${
                      norm(c.status) === 'ativa' ? 'background:rgba(46,204,113,0.15);color:#1e8449;' : 'background:rgba(127,140,141,0.15);color:#5d6d7e;'
                    }">
                      ${esc(c.status || '–')}
                    </span>
                  </td>
                  <td style="padding:6px 8px;color:var(--muted);">${esc(c.tipoInvestidor || '–')}</td>
                  <td style="padding:6px 8px;color:var(--muted);">${esc(c.cidade ? `${c.cidade}/${c.estado || ''}` : '–')}</td>
                  <td style="padding:6px 10px;text-align:right;font-weight:700;" class="num">${brl(c.plTotal)}</td>
                </tr>
              `).join('')}
              ${selecionadas.length > 500 ? `
                <tr>
                  <td colspan="8" style="text-align:center;padding:10px;color:var(--muted);background:var(--surface-2);">
                    Mostrando as primeiras 500 de ${inteiro(selecionadas.length)} contas. Baixe o Excel para a listagem completa.
                  </td>
                </tr>
              ` : ''}
            </tbody>
          </table>
        </div>
      ` : ''}
    </div>
  `;

  // Listeners de eventos
  vincularEventosBase(itensTodos, simRes);
}

function vincularEventosBase(itensTodos: ItemUnidade[], simRes: ResultadoSimulacaoPlano) {
  // Segmented Modo
  $('#seg-modo-base')?.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    S.filtroBase.modo = (b.dataset.v as any) || 'conta';
    renderBaseClientes();
  });

  // Filtro Assessor
  $('#sel-base-assessor')?.addEventListener('change', e => {
    S.filtroBase.assessor = (e.target as HTMLSelectElement).value;
    renderBaseClientes();
  });

  // Filtro Status
  $('#sel-base-status')?.addEventListener('change', e => {
    S.filtroBase.status = (e.target as HTMLSelectElement).value;
    renderBaseClientes();
  });

  // Filtro Investidor
  $('#sel-base-inv')?.addEventListener('change', e => {
    S.filtroBase.tipoInvestidor = (e.target as HTMLSelectElement).value;
    renderBaseClientes();
  });

  // Busca rápida
  $('#busca-base')?.addEventListener('input', e => {
    S.filtroBase.busca = (e.target as HTMLInputElement).value;
    renderBaseClientes();
  });

  // Limpar filtros
  $('#btn-limpar-filtros-base')?.addEventListener('click', () => {
    S.filtroBase.assessor = '';
    S.filtroBase.status = '';
    S.filtroBase.tipoInvestidor = '';
    S.filtroBase.busca = '';
    S.filtroBase.faixaSel = null;
    S.filtroBase.tipoSel = null;
    renderBaseClientes();
  });

  $('#btn-reset-selecao')?.addEventListener('click', () => {
    S.filtroBase.faixaSel = null;
    S.filtroBase.tipoSel = null;
    renderBaseClientes();
  });

  // Clique na tabela de faixas para filtrar
  document.querySelectorAll('[data-click-faixa]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const target = el as HTMLElement;
      const fx = target.dataset.clickFaixa;
      const tp = target.dataset.clickTipo;
      if (S.filtroBase.faixaSel === fx && S.filtroBase.tipoSel === tp) {
        S.filtroBase.faixaSel = null;
        S.filtroBase.tipoSel = null;
      } else {
        S.filtroBase.faixaSel = fx || null;
        S.filtroBase.tipoSel = tp || null;
      }
      renderBaseClientes();
    });
  });

  // Trocar / Atualizar planilha
  $('#btn-trocar-base')?.addEventListener('click', () => {
    ($('#arq-trocar-base') as HTMLInputElement)?.click();
  });
  $('#arq-trocar-base')?.addEventListener('change', async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { processarArquivo } = await import('../../parsers/pasta');
    await processarArquivo(file);
    renderBaseClientes();
  });

  // Exportar Apresentação / Resumo em Excel
  $('#btn-exportar-plano')?.addEventListener('click', () => exportarApresentacaoExcel());
  $('#btn-exportar-selecao')?.addEventListener('click', () => exportarSelecaoExcel());

  // Editar faixas
  $('#btn-editar-faixas')?.addEventListener('click', () => abrirModalFaixas());

  // Minimizar / Expandir blocos da Base de Clientes
  document.querySelectorAll('.btn-toggle-bloco').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const b = (btn as HTMLElement).dataset.bloco;
      if (!b) return;
      S.baseBlocosRecolhidos[b] = !S.baseBlocosRecolhidos[b];
      renderBaseClientes();
    });
  });

  // Eventos do Simulador de Plano de Negócios
  vincularEventosSimulador(itensTodos, simRes);
}

function renderSecaoSimulador(res: ResultadoSimulacaoPlano, assessores: string[], itensTodos: ItemUnidade[]): string {
  const sim = S.simuladorPlano;
  const faixas = S.faixasBase || FAIXAS_PADRAO_BASE;
  const qtdFaixasSel = sim.faixasSelecionadas.length;

  if (S.baseBlocosRecolhidos.simulador) {
    return `
      <!-- SEÇÃO SIMULADOR DE PLANO DE NEGÓCIOS (RECOLHIDO) -->
      <div class="cartao" id="secao-simulador" style="border: 1.5px solid var(--s1); background: linear-gradient(90deg, rgba(42,120,214,0.06) 0%, var(--surface) 100%); margin-bottom: 20px; border-radius: 12px; padding: 12px 18px; box-shadow: 0 2px 10px rgba(4,20,45,0.04); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:24px;">🚀</span>
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <h2 style="font-size:15px;margin:0;font-weight:750;color:var(--ink);">Simulador de Plano de Negócios — Carteira Administrada</h2>
              <span style="background:rgba(42,120,214,0.12);color:var(--s1);padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;">Recolhido</span>
            </div>
            <p class="sec" style="margin:2px 0 0;font-size:12px;">
              Faixas: <b>${sim.faixasSelecionadas.join(' + ') || 'Nenhuma'}</b> · Alvo: <b>${inteiro(res.totalContas)} contas</b> (${brlCurto(res.totalPl)}) · Receita Mês ${res.prazoMeses}: <b style="color:#0ca30c;">${brl(res.receitaMensalPlena)}/mês</b> · Run-Rate: <b style="color:#0ca30c;">${brl(res.receitaAnualPlena)}/ano</b>
            </p>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button type="button" class="btn btn-sm btn-pri btn-toggle-bloco" data-bloco="simulador" style="font-weight:700;box-shadow:0 2px 8px rgba(42,120,214,0.25);">
            ▸ Expandir Simulador
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="cartao" id="secao-simulador" style="border: 2px solid var(--s1); background: linear-gradient(180deg, rgba(42,120,214,0.04) 0%, var(--surface) 100%); margin-bottom: 20px; border-radius: 12px; padding: 18px 20px; box-shadow: 0 4px 18px rgba(4,20,45,0.06);">
      
      <!-- Topo do Simulador -->
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px;border-bottom:1px solid var(--grid);padding-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:24px;">🚀</span>
          <div>
            <h2 style="font-size:16px;margin:0 0 2px;font-weight:750;color:var(--ink);">Simulador de Plano de Negócios — Carteira Administrada</h2>
            <p class="sec" style="margin:0;font-size:12.5px;">
              Projeção fiduciária com soma de faixas de PL: <b>${sim.taxaPfAa}% a.a. (PF)</b> e <b>${sim.taxaPjAa}% a.a. (PJ)</b> em <b>${res.prazoMeses} meses</b>.
            </p>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button type="button" class="btn btn-sm btn-pri" id="btn-exportar-simulacao" style="background:var(--s1);border-color:var(--s1);box-shadow:0 2px 8px rgba(42,120,214,0.25);">
            📥 Baixar Projeção (Excel)
          </button>
          <button type="button" class="btn btn-sm btn-toggle-bloco" data-bloco="simulador" title="Recolher o simulador para dar destaque à matriz">
            ▾ Minimizar
          </button>
        </div>
      </div>

      <!-- Barra de Parâmetros Gerais (Prazo, Taxas e Filtros) -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:14px;background:var(--surface);padding:14px 16px;border-radius:10px;border:1px solid var(--grid);margin-bottom:14px;">
        
        <!-- Prazo em Meses -->
        <div>
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;color:var(--ink-2);">
            ⏱️ Prazo de Conversão
          </label>
          <div style="display:flex;gap:4px;" id="sim-prazos-botoes">
            <button type="button" class="btn btn-sm btn-sim-prazo" data-p="3" style="${sim.prazoMeses === 3 ? 'background:var(--s1);color:#fff;font-weight:700;' : ''}">3m</button>
            <button type="button" class="btn btn-sm btn-sim-prazo" data-p="6" style="${sim.prazoMeses === 6 ? 'background:var(--s1);color:#fff;font-weight:700;' : ''}">6m</button>
            <button type="button" class="btn btn-sm btn-sim-prazo" data-p="12" style="${sim.prazoMeses === 12 ? 'background:var(--s1);color:#fff;font-weight:700;' : ''}">12m</button>
            <input type="number" id="sim-inp-prazo" value="${sim.prazoMeses}" min="1" max="36" style="width:52px;padding:3px 6px;border-radius:4px;border:1px solid var(--border);text-align:center;font-size:12px;" title="Número de meses">
          </div>
        </div>

        <!-- Taxa PF (% a.a.) -->
        <div>
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;color:var(--ink-2);">
            👤 Fee PF (% a.a.)
            <span class="muted" style="font-weight:400;">(${(res.taxaPfAm * 100).toFixed(4)}% a.m.)</span>
          </label>
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="number" id="sim-taxa-pf" value="${sim.taxaPfAa}" step="0.05" min="0" max="15" style="width:75px;padding:4px 6px;border-radius:6px;border:1px solid var(--border);font-weight:700;font-size:13px;">
            <span style="font-size:12px;color:var(--ink-2);">% a.a.</span>
          </div>
        </div>

        <!-- Taxa PJ (% a.a.) -->
        <div>
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;color:var(--ink-2);">
            🏢 Fee PJ (% a.a.)
            <span class="muted" style="font-weight:400;">(${(res.taxaPjAm * 100).toFixed(4)}% a.m.)</span>
          </label>
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="number" id="sim-taxa-pj" value="${sim.taxaPjAa}" step="0.05" min="0" max="15" style="width:75px;padding:4px 6px;border-radius:6px;border:1px solid var(--border);font-weight:700;font-size:13px;">
            <span style="font-size:12px;color:var(--ink-2);">% a.a.</span>
          </div>
        </div>

        <!-- Opções Adicionais (Estrangeiros e Assessor) -->
        <div style="display:flex;flex-direction:column;justify-content:center;gap:6px;">
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
            <input type="checkbox" id="sim-chk-estrangeiros" ${sim.excluirEstrangeiros ? 'checked' : ''}>
            <span><b>Excluir Estrangeiros</b> (só PF + PJ)</span>
          </label>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:11px;color:var(--muted);">Assessor:</span>
            <select id="sim-sel-assessor" style="flex:1;padding:3px 6px;border-radius:4px;border:1px solid var(--border);font-size:11.5px;">
              <option value="">Todos os Assessores (${assessores.length})</option>
              ${assessores.map(a => `<option value="${esc(a)}" ${sim.assessorSel === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- SELEÇÃO MÚLTIPLA DE FAIXAS DE PL (SOMA DINÂMICA) -->
      <div style="background:var(--surface);padding:14px 16px;border-radius:10px;border:1px solid var(--grid);margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
          <div>
            <span style="font-size:12.5px;font-weight:700;color:var(--ink);">🎯 Faixas de Patrimônio Líquido Alvo (Múltipla Seleção & Soma)</span>
            <span class="sec" style="font-size:12px;margin-left:6px;">
              Marque as faixas desejadas para somar o AuM e as receitas projetadas:
            </span>
          </div>
          <!-- Presets rápidos -->
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
            <span style="font-size:11px;color:var(--muted);margin-right:2px;">Atalhos:</span>
            <button type="button" class="btn btn-sm btn-preset-faixa" data-preset="foco" style="font-size:11px;padding:3px 8px;">🎯 100k a 500k</button>
            <button type="button" class="btn btn-sm btn-preset-faixa" data-preset="expandido" style="font-size:11px;padding:3px 8px;">🚀 100k a 1 Milhão</button>
            <button type="button" class="btn btn-sm btn-preset-faixa" data-preset="hnw" style="font-size:11px;padding:3px 8px;">⭐ Acima de 500k</button>
            <button type="button" class="btn btn-sm btn-preset-faixa" data-preset="todas" style="font-size:11px;padding:3px 8px;">✅ Todas com Saldo</button>
            <button type="button" class="btn btn-sm btn-link btn-preset-faixa" data-preset="limpar" style="font-size:11px;padding:3px 8px;color:var(--muted);">[Limpar]</button>
          </div>
        </div>

        <!-- Grade de Checkboxes de Faixas -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:8px;" id="sim-faixas-checkboxes">
          ${faixas.map(fx => {
            const estaSel = sim.faixasSelecionadas.includes(fx.rotulo);
            const doGrupo = itensTodos.filter(c => c.plTotal >= fx.min && c.plTotal < fx.max && (!sim.excluirEstrangeiros || (c.tipo !== 'Estrangeiro' && !norm(c.tipoInvestidor || '').includes('estrangeiro'))));
            const plGrupo = doGrupo.reduce((s, c) => s + (c.plTotal > 0 ? c.plTotal : 0), 0);
            return `
              <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;border:1.5px solid ${estaSel ? 'var(--s1)' : 'var(--grid)'};background:${estaSel ? 'rgba(42,120,214,0.08)' : 'var(--surface-2)'};cursor:pointer;user-select:none;transition:all .15s ease;">
                <input type="checkbox" class="chk-sim-faixa" data-faixa="${esc(fx.rotulo)}" ${estaSel ? 'checked' : ''} style="accent-color:var(--s1);width:16px;height:16px;cursor:pointer;">
                <div style="flex:1;min-width:0;">
                  <div style="font-size:12.5px;font-weight:${estaSel ? '700' : '600'};color:${estaSel ? 'var(--s1)' : 'var(--ink)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${esc(fx.rotulo)}
                  </div>
                  <div style="font-size:11px;color:var(--muted);">
                    <b>${inteiro(doGrupo.length)} contas</b> · ${brlCurto(plGrupo)}
                  </div>
                </div>
              </label>
            `;
          }).join('')}
        </div>

        <div style="margin-top:10px;font-size:11.5px;color:var(--ink-2);display:flex;align-items:center;gap:6px;">
          <span>ℹ️</span>
          <span>
            <b>${qtdFaixasSel}</b> ${qtdFaixasSel === 1 ? 'faixa selecionada' : 'faixas selecionadas'}:
            ${qtdFaixasSel > 0 ? `<b>${sim.faixasSelecionadas.join(' + ')}</b> (${inteiro(res.totalContas)} contas somadas · AuM Total: <b>${brlCurto(res.totalPl)}</b>)` : '<span style="color:var(--crit);font-weight:600;">Nenhuma faixa selecionada. Marque ao menos uma faixa acima.</span>'}
          </span>
        </div>
      </div>

      <!-- KPIs da Simulação -->
      <div class="kpis" style="margin-bottom:16px;">
        <div class="kpi" style="border-left:3px solid var(--s1);background:var(--surface);">
          <span class="kpi-rot" style="color:var(--s1);font-weight:700;">AuM Sob Gestão Alvo</span>
          <b class="kpi-val" style="color:var(--s1);">${brlCurto(res.totalPl)}</b>
          <span class="kpi-sub"><b>${inteiro(res.totalContas)} contas</b> (${inteiro(res.pfContas)} PF · ${inteiro(res.pjContas)} PJ)</span>
        </div>

        <div class="kpi" style="border-left:3px solid #0ca30c;background:var(--surface);">
          <span class="kpi-rot" style="color:#0ca30c;font-weight:700;">Receita Recorrente no Mês ${res.prazoMeses}</span>
          <b class="kpi-val" style="color:#0ca30c;">${brl(res.receitaMensalPlena)}</b>
          <span class="kpi-sub">PF: <b>${brl(res.receitaPfMensalPlena)}</b> · PJ: <b>${brl(res.receitaPjMensalPlena)}</b></span>
        </div>

        <div class="kpi" style="background:var(--surface);">
          <span class="kpi-rot">Run-Rate Anualizado (100%)</span>
          <b class="kpi-val">${brl(res.receitaAnualPlena)}</b>
          <span class="kpi-sub">Faturamento anual da base plena</span>
        </div>

        <div class="kpi" style="background:var(--surface);">
          <span class="kpi-rot">Faturamento Acumulado (${res.prazoMeses}m)</span>
          <b class="kpi-val">${brl(res.faturamentoAcumuladoPeriodo)}</b>
          <span class="kpi-sub">Receita total na transição</span>
        </div>

        <div class="kpi" style="background:var(--surface);">
          <span class="kpi-rot">Meta Mensal da Equipe</span>
          <b class="kpi-val">~${inteiro(res.metaMensalContasTotal)} contas/mês</b>
          <span class="kpi-sub">${brlCurto(res.totalPl / res.prazoMeses)} de AuM convertido/mês</span>
        </div>
      </div>

      <!-- Sub-navegação do Simulador -->
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
        <span class="seg" id="seg-sub-sim">
          <button type="button" class="btn-sub-sim" data-sub="evolucao" aria-pressed="${sim.subAba === 'evolucao'}">📈 Curva de Evolução Mês a Mês</button>
          <button type="button" class="btn-sub-sim" data-sub="assessores" aria-pressed="${sim.subAba === 'assessores'}">👥 Metas e Receita por Assessor (${res.porAssessor.length})</button>
          <button type="button" class="btn-sub-sim" data-sub="contas" aria-pressed="${sim.subAba === 'contas'}">📋 Contas Alvo da Faixa (${inteiro(res.totalContas)})</button>
        </span>
      </div>

      <!-- Conteúdo da Sub-Aba Selecionada -->
      ${sim.subAba === 'evolucao' ? `
        <!-- Tabela Mês a Mês -->
        <div style="overflow-x:auto;border:1px solid var(--grid);border-radius:8px;background:var(--surface);">
          <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
            <thead>
              <tr style="background:var(--surface-2);border-bottom:2px solid var(--grid);">
                <th style="text-align:center;padding:8px 10px;width:70px;">Mês</th>
                <th style="text-align:left;padding:8px 10px;width:130px;">Progresso</th>
                <th style="text-align:right;padding:8px 10px;">Contas Geridas</th>
                <th style="text-align:right;padding:8px 10px;background:rgba(42,120,214,0.04);">AuM PF (R$)</th>
                <th style="text-align:right;padding:8px 10px;background:rgba(142,68,173,0.04);">AuM PJ (R$)</th>
                <th style="text-align:right;padding:8px 10px;font-weight:700;">AuM Total Gerido</th>
                <th style="text-align:right;padding:8px 10px;background:rgba(42,120,214,0.04);">Receita PF / Mês</th>
                <th style="text-align:right;padding:8px 10px;background:rgba(142,68,173,0.04);">Receita PJ / Mês</th>
                <th style="text-align:right;padding:8px 10px;font-weight:700;color:#0ca30c;background:rgba(12,163,12,0.04);">Receita Total / Mês</th>
                <th style="text-align:right;padding:8px 10px;font-weight:700;">Run-Rate Anual</th>
              </tr>
            </thead>
            <tbody>
              ${res.evolucaoMeses.map(ev => `
                <tr style="border-bottom:1px solid var(--grid);${ev.mes === res.prazoMeses ? 'background:rgba(12,163,12,0.06);font-weight:600;' : ''}">
                  <td style="text-align:center;padding:7px 10px;font-weight:700;">Mês ${ev.mes}</td>
                  <td style="padding:7px 10px;">
                    <div style="display:flex;align-items:center;gap:6px;">
                      <div style="flex:1;background:var(--grid);height:6px;border-radius:3px;overflow:hidden;">
                        <div style="width:${(ev.pctProgresso * 100).toFixed(0)}%;background:var(--s1);height:100%;"></div>
                      </div>
                      <span style="font-size:11px;min-width:32px;text-align:right;">${pct(ev.pctProgresso, 0)}</span>
                    </div>
                  </td>
                  <td style="text-align:right;padding:7px 10px;" class="num">${inteiro(ev.contasNoMes)}</td>
                  <td style="text-align:right;padding:7px 10px;background:rgba(42,120,214,0.02);" class="num">${brlCurto(ev.aumPf)}</td>
                  <td style="text-align:right;padding:7px 10px;background:rgba(142,68,173,0.02);" class="num">${brlCurto(ev.aumPj)}</td>
                  <td style="text-align:right;padding:7px 10px;font-weight:700;" class="num">${brlCurto(ev.aumTotal)}</td>
                  <td style="text-align:right;padding:7px 10px;background:rgba(42,120,214,0.02);" class="num">${brl(ev.receitaPf)}</td>
                  <td style="text-align:right;padding:7px 10px;background:rgba(142,68,173,0.02);" class="num">${brl(ev.receitaPj)}</td>
                  <td style="text-align:right;padding:7px 10px;font-weight:700;color:#0ca30c;background:rgba(12,163,12,0.03);" class="num">${brl(ev.receitaTotal)}</td>
                  <td style="text-align:right;padding:7px 10px;font-weight:700;" class="num">${brl(ev.runRateAnual)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="border-top:2px solid var(--marca);background:var(--surface-2);font-weight:700;">
                <td colspan="8" style="padding:8px 10px;text-align:right;">Faturamento Acumulado Durante os ${res.prazoMeses} Meses de Transição:</td>
                <td style="text-align:right;padding:8px 10px;color:#0ca30c;font-size:13px;" class="num">${brl(res.faturamentoAcumuladoPeriodo)}</td>
                <td style="text-align:right;padding:8px 10px;" class="num">${brl(res.receitaAnualPlena)} /ano</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ` : sim.subAba === 'assessores' ? `
        <!-- Tabela por Assessor -->
        <div style="overflow-x:auto;border:1px solid var(--grid);border-radius:8px;background:var(--surface);">
          <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
            <thead>
              <tr style="background:var(--surface-2);border-bottom:2px solid var(--grid);">
                <th style="text-align:left;padding:8px 10px;">Assessor</th>
                <th style="text-align:center;padding:8px 10px;background:rgba(42,120,214,0.04);">Contas PF</th>
                <th style="text-align:center;padding:8px 10px;background:rgba(142,68,173,0.04);">Contas PJ</th>
                <th style="text-align:center;padding:8px 10px;font-weight:700;">Total Contas</th>
                <th style="text-align:center;padding:8px 10px;color:var(--s1);font-weight:700;">Meta (Contas/Mês)</th>
                <th style="text-align:right;padding:8px 10px;background:rgba(42,120,214,0.04);">AuM PF (R$)</th>
                <th style="text-align:right;padding:8px 10px;background:rgba(142,68,173,0.04);">AuM PJ (R$)</th>
                <th style="text-align:right;padding:8px 10px;font-weight:700;">AuM Total Alvo</th>
                <th style="text-align:right;padding:8px 10px;color:#0ca30c;font-weight:700;">Receita Mensal (Mês ${res.prazoMeses})</th>
                <th style="text-align:right;padding:8px 10px;font-weight:700;">Receita Anual Projetada</th>
                <th style="text-align:right;padding:8px 10px;">Share Receita</th>
              </tr>
            </thead>
            <tbody>
              ${res.porAssessor.map(a => `
                <tr style="border-bottom:1px solid var(--grid);">
                  <td style="padding:7px 10px;font-weight:600;">${esc(a.assessor)}</td>
                  <td style="text-align:center;padding:7px 10px;background:rgba(42,120,214,0.02);">${inteiro(a.pfContas)}</td>
                  <td style="text-align:center;padding:7px 10px;background:rgba(142,68,173,0.02);color:#6c3483;font-weight:600;">${inteiro(a.pjContas)}</td>
                  <td style="text-align:center;padding:7px 10px;font-weight:700;">${inteiro(a.totalContas)}</td>
                  <td style="text-align:center;padding:7px 10px;color:var(--s1);font-weight:700;background:rgba(42,120,214,0.04);">
                    ~${a.metaMensalContas}/mês
                  </td>
                  <td style="text-align:right;padding:7px 10px;background:rgba(42,120,214,0.02);" class="num">${brlCurto(a.pfPl)}</td>
                  <td style="text-align:right;padding:7px 10px;background:rgba(142,68,173,0.02);" class="num">${brlCurto(a.pjPl)}</td>
                  <td style="text-align:right;padding:7px 10px;font-weight:700;" class="num">${brl(a.totalPl)}</td>
                  <td style="text-align:right;padding:7px 10px;font-weight:700;color:#0ca30c;background:rgba(12,163,12,0.03);" class="num">${brl(a.receitaTotalMensal)}</td>
                  <td style="text-align:right;padding:7px 10px;font-weight:700;" class="num">${brl(a.receitaAnual)}</td>
                  <td style="text-align:right;padding:7px 10px;" class="num">${pct(a.shareReceita, 1)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="border-top:2px solid var(--marca);background:var(--surface-2);font-weight:700;">
                <td style="padding:8px 10px;">TOTAL GERAL</td>
                <td style="text-align:center;padding:8px 10px;">${inteiro(res.pfContas)}</td>
                <td style="text-align:center;padding:8px 10px;color:#6c3483;">${inteiro(res.pjContas)}</td>
                <td style="text-align:center;padding:8px 10px;">${inteiro(res.totalContas)}</td>
                <td style="text-align:center;padding:8px 10px;color:var(--s1);">~${res.metaMensalContasTotal}/mês</td>
                <td style="text-align:right;padding:8px 10px;" class="num">${brlCurto(res.pfPl)}</td>
                <td style="text-align:right;padding:8px 10px;" class="num">${brlCurto(res.pjPl)}</td>
                <td style="text-align:right;padding:8px 10px;" class="num">${brl(res.totalPl)}</td>
                <td style="text-align:right;padding:8px 10px;color:#0ca30c;" class="num">${brl(res.receitaMensalPlena)}</td>
                <td style="text-align:right;padding:8px 10px;" class="num">${brl(res.receitaAnualPlena)}</td>
                <td style="text-align:right;padding:8px 10px;" class="num">100,0%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ` : `
        <!-- Lista das Contas Elegíveis -->
        <div style="max-height:360px;overflow:auto;border:1px solid var(--grid);border-radius:8px;background:var(--surface);">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead style="position:sticky;top:0;background:var(--surface-2);border-bottom:1px solid var(--grid);z-index:2;">
              <tr>
                <th style="text-align:left;padding:6px 10px;">Conta</th>
                <th style="text-align:left;padding:6px 10px;">Titular</th>
                <th style="text-align:center;padding:6px 8px;">Tipo</th>
                <th style="text-align:left;padding:6px 10px;">Assessor</th>
                <th style="text-align:center;padding:6px 8px;">Status</th>
                <th style="text-align:left;padding:6px 8px;">Cidade/UF</th>
                <th style="text-align:right;padding:6px 10px;">PL Total</th>
                <th style="text-align:right;padding:6px 10px;color:#0ca30c;">Receita Mensal Estimada</th>
              </tr>
            </thead>
            <tbody>
              ${res.contasElegiveis.map(c => {
                const taxa = c.tipo === 'PJ' ? res.taxaPjAm : res.taxaPfAm;
                const recEst = c.plTotal * taxa;
                return `
                  <tr style="border-bottom:1px solid var(--grid);">
                    <td style="padding:5px 10px;font-family:monospace;font-weight:600;">${esc(c.conta)}</td>
                    <td style="padding:5px 10px;font-weight:600;">${esc(c.nome)}</td>
                    <td style="padding:5px 8px;text-align:center;">
                      <span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10.5px;font-weight:700;${
                        c.tipo === 'PJ' ? 'background:rgba(142,68,173,0.15);color:#6c3483;' : 'background:rgba(42,120,214,0.15);color:#1c5cab;'
                      }">${esc(c.tipo)}</span>
                    </td>
                    <td style="padding:5px 10px;color:var(--ink-2);">${esc(c.assessor || '–')}</td>
                    <td style="padding:5px 8px;text-align:center;">
                      <span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10.5px;font-weight:600;${
                        norm(c.status) === 'ativa' ? 'background:rgba(46,204,113,0.15);color:#1e8449;' : 'background:rgba(127,140,141,0.15);color:#5d6d7e;'
                      }">${esc(c.status || '–')}</span>
                    </td>
                    <td style="padding:5px 8px;color:var(--muted);">${esc(c.cidade ? `${c.cidade}/${c.estado || ''}` : '–')}</td>
                    <td style="padding:5px 10px;text-align:right;font-weight:700;" class="num">${brl(c.plTotal)}</td>
                    <td style="padding:5px 10px;text-align:right;font-weight:700;color:#0ca30c;" class="num">${brl(recEst)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

function vincularEventosSimulador(itensTodos: ItemUnidade[], res: ResultadoSimulacaoPlano) {
  // Prazos botões rápidos
  document.querySelectorAll('.btn-sim-prazo').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      const p = Number((b as HTMLElement).dataset.p) || 6;
      S.simuladorPlano.prazoMeses = p;
      renderBaseClientes();
    });
  });

  // Prazo input livre
  $('#sim-inp-prazo')?.addEventListener('change', e => {
    const v = Number((e.target as HTMLInputElement).value) || 6;
    S.simuladorPlano.prazoMeses = Math.max(1, Math.min(36, v));
    renderBaseClientes();
  });

  // Taxa PF
  $('#sim-taxa-pf')?.addEventListener('change', e => {
    const v = Number((e.target as HTMLInputElement).value);
    if (!isNaN(v) && v >= 0) {
      S.simuladorPlano.taxaPfAa = v;
      renderBaseClientes();
    }
  });

  // Taxa PJ
  $('#sim-taxa-pj')?.addEventListener('change', e => {
    const v = Number((e.target as HTMLInputElement).value);
    if (!isNaN(v) && v >= 0) {
      S.simuladorPlano.taxaPjAa = v;
      renderBaseClientes();
    }
  });

  // Checkboxes de faixas múltiplas
  document.querySelectorAll('.chk-sim-faixa').forEach(chk => {
    chk.addEventListener('change', () => {
      const fx = (chk as HTMLInputElement).dataset.faixa;
      if (!fx) return;
      const set = new Set(S.simuladorPlano.faixasSelecionadas || []);
      if ((chk as HTMLInputElement).checked) {
        set.add(fx);
      } else {
        set.delete(fx);
      }
      S.simuladorPlano.faixasSelecionadas = [...set];
      renderBaseClientes();
    });
  });

  // Presets rápidos de faixas
  document.querySelectorAll('.btn-preset-faixa').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const preset = (btn as HTMLElement).dataset.preset;
      const faixas = S.faixasBase || FAIXAS_PADRAO_BASE;
      if (preset === 'foco') {
        S.simuladorPlano.faixasSelecionadas = ['100 a 500 mil'];
      } else if (preset === 'expandido') {
        S.simuladorPlano.faixasSelecionadas = ['100 a 500 mil', '500 mil a 1 mi'];
      } else if (preset === 'hnw') {
        S.simuladorPlano.faixasSelecionadas = ['500 mil a 1 mi', '1 a 5 mi', 'Acima de 5 mi'];
      } else if (preset === 'todas') {
        S.simuladorPlano.faixasSelecionadas = faixas.filter(f => f.min >= 0.01).map(f => f.rotulo);
      } else if (preset === 'limpar') {
        S.simuladorPlano.faixasSelecionadas = [];
      }
      renderBaseClientes();
    });
  });

  // Estrangeiros checkbox
  $('#sim-chk-estrangeiros')?.addEventListener('change', e => {
    S.simuladorPlano.excluirEstrangeiros = (e.target as HTMLInputElement).checked;
    renderBaseClientes();
  });

  // Assessor select
  $('#sim-sel-assessor')?.addEventListener('change', e => {
    S.simuladorPlano.assessorSel = (e.target as HTMLSelectElement).value;
    renderBaseClientes();
  });

  // Sub-abas
  document.querySelectorAll('.btn-sub-sim').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      const sub = (b as HTMLElement).dataset.sub as any;
      if (sub) {
        S.simuladorPlano.subAba = sub;
        renderBaseClientes();
      }
    });
  });

  // Exportar Excel do Simulador
  $('#btn-exportar-simulacao')?.addEventListener('click', () => {
    exportarSimulacaoExcel(res);
  });
}

export function exportarSimulacaoExcel(res: ResultadoSimulacaoPlano) {
  const wb = XLSX.utils.book_new();

  // 1. Resumo do Plano
  const resumo = [
    { Indicador: 'Faixas de PL Selecionadas (Soma)', Valor: S.simuladorPlano.faixasSelecionadas.length ? S.simuladorPlano.faixasSelecionadas.join(' + ') : 'Nenhuma faixa' },
    { Indicador: 'Qtd de Faixas Somadas', Valor: S.simuladorPlano.faixasSelecionadas.length },
    { Indicador: 'Prazo de Conversão', Valor: `${res.prazoMeses} meses` },
    { Indicador: 'Taxa Fee PF (% a.a.)', Valor: `${res.taxaPfAa}% a.a. (= ${(res.taxaPfAm * 100).toFixed(4)}% a.m.)` },
    { Indicador: 'Taxa Fee PJ (% a.a.)', Valor: `${res.taxaPjAa}% a.a. (= ${(res.taxaPjAm * 100).toFixed(4)}% a.m.)` },
    { Indicador: 'Excluir Estrangeiros', Valor: S.simuladorPlano.excluirEstrangeiros ? 'Sim (apenas PF e PJ nacionais)' : 'Não' },
    { Indicador: 'Filtro por Assessor', Valor: S.simuladorPlano.assessorSel || 'Todos os Assessores' },
    { Indicador: '----------------------------------------', Valor: '----------------------------------------' },
    { Indicador: 'Total de Contas Alvo', Valor: res.totalContas },
    { Indicador: 'Contas PF', Valor: res.pfContas },
    { Indicador: 'Contas PJ', Valor: res.pjContas },
    { Indicador: 'AuM Total sob Gestão Alvo (R$)', Valor: Math.round(res.totalPl * 100) / 100 },
    { Indicador: 'AuM PF (R$)', Valor: Math.round(res.pfPl * 100) / 100 },
    { Indicador: 'AuM PJ (R$)', Valor: Math.round(res.pjPl * 100) / 100 },
    { Indicador: 'Ticket Médio por Conta (R$)', Valor: Math.round(res.ticketMedio * 100) / 100 },
    { Indicador: '----------------------------------------', Valor: '----------------------------------------' },
    { Indicador: `Receita Mensal Recorrente Plena (Mês ${res.prazoMeses}) (R$)`, Valor: Math.round(res.receitaMensalPlena * 100) / 100 },
    { Indicador: 'Receita Mensal PF (R$)', Valor: Math.round(res.receitaPfMensalPlena * 100) / 100 },
    { Indicador: 'Receita Mensal PJ (R$)', Valor: Math.round(res.receitaPjMensalPlena * 100) / 100 },
    { Indicador: 'Run-Rate Anual Recorrente (R$)', Valor: Math.round(res.receitaAnualPlena * 100) / 100 },
    { Indicador: `Faturamento Acumulado no Período de ${res.prazoMeses} Meses (R$)`, Valor: Math.round(res.faturamentoAcumuladoPeriodo * 100) / 100 },
    { Indicador: 'Meta de Conversão da Equipe (Contas/Mês)', Valor: `~${res.metaMensalContasTotal} contas/mês` },
  ];
  const wsResumo = XLSX.utils.json_to_sheet(resumo);
  wsResumo['!cols'] = [{ wch: 45 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo do Plano');

  // 2. Evolução Mês a Mês
  const rowsEvolucao = res.evolucaoMeses.map(ev => ({
    Mês: `Mês ${ev.mes}`,
    '% Concluído': Math.round(ev.pctProgresso * 1000) / 10 + '%',
    'Contas sob Gestão': ev.contasNoMes,
    'AuM PF (R$)': Math.round(ev.aumPf * 100) / 100,
    'AuM PJ (R$)': Math.round(ev.aumPj * 100) / 100,
    'AuM Total Gerido (R$)': Math.round(ev.aumTotal * 100) / 100,
    'Receita Mensal PF (R$)': Math.round(ev.receitaPf * 100) / 100,
    'Receita Mensal PJ (R$)': Math.round(ev.receitaPj * 100) / 100,
    'Receita Mensal Total (R$)': Math.round(ev.receitaTotal * 100) / 100,
    'Run-Rate Anual (R$)': Math.round(ev.runRateAnual * 100) / 100,
  }));
  const wsEvolucao = XLSX.utils.json_to_sheet(rowsEvolucao);
  wsEvolucao['!cols'] = [12, 14, 18, 18, 18, 20, 20, 20, 22, 22].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsEvolucao, 'Evolução Mês a Mês');

  // 3. Metas por Assessor
  const rowsAssessor = res.porAssessor.map(a => ({
    Assessor: a.assessor,
    'Contas PF': a.pfContas,
    'Contas PJ': a.pjContas,
    'Total Contas': a.totalContas,
    'Meta (Contas/Mês)': `~${a.metaMensalContas}/mês`,
    'AuM PF (R$)': Math.round(a.pfPl * 100) / 100,
    'AuM PJ (R$)': Math.round(a.pjPl * 100) / 100,
    'AuM Total (R$)': Math.round(a.totalPl * 100) / 100,
    [`Receita Mensal Mês ${res.prazoMeses} (R$)`]: Math.round(a.receitaTotalMensal * 100) / 100,
    'Receita Anual Projetada (R$)': Math.round(a.receitaAnual * 100) / 100,
    'Share Receita Escritório (%)': Math.round(a.shareReceita * 1000) / 10 + '%',
  }));
  const wsAssessor = XLSX.utils.json_to_sheet(rowsAssessor);
  wsAssessor['!cols'] = [28, 12, 12, 14, 18, 18, 18, 20, 22, 22, 18].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsAssessor, 'Metas por Assessor');

  // 4. Contas Elegíveis
  const rowsContas = res.contasElegiveis.map(c => {
    const taxa = c.tipo === 'PJ' ? res.taxaPjAm : res.taxaPfAm;
    return {
      Conta: c.conta,
      Nome: c.nome,
      Tipo: c.tipo,
      'PL Total (R$)': Math.round(c.plTotal * 100) / 100,
      Assessor: c.assessor,
      Status: c.status,
      'Receita Mensal Estimada (R$)': Math.round(c.plTotal * taxa * 100) / 100,
      'Receita Anual Estimada (R$)': Math.round(c.plTotal * taxa * 12 * 100) / 100,
      Cidade: c.cidade || '',
      Estado: c.estado || '',
    };
  });
  const wsContas = XLSX.utils.json_to_sheet(rowsContas);
  wsContas['!cols'] = [14, 26, 10, 18, 22, 12, 22, 22, 16, 10].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsContas, 'Contas Alvo');

  XLSX.writeFile(wb, `Plano_Negocios_Carteira_Administrada_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportarApresentacaoExcel() {
  const itens = filtrarItensBase(obterItensBase());
  const faixas = S.faixasBase || FAIXAS_PADRAO_BASE;

  const resumo = faixas.map(fx => {
    const doGrupo = itens.filter(x => x.plTotal >= fx.min && x.plTotal < fx.max);
    const pf = doGrupo.filter(x => x.tipo === 'PF');
    const pj = doGrupo.filter(x => x.tipo === 'PJ');
    const est = doGrupo.filter(x => x.tipo === 'Estrangeiro');
    return {
      'Faixa de Patrimônio': fx.rotulo,
      'PF (Contas)': pf.length,
      'PF (Volume R$)': Math.round(pf.reduce((s, x) => s + x.plTotal, 0) * 100) / 100,
      'PJ (Contas)': pj.length,
      'PJ (Volume R$)': Math.round(pj.reduce((s, x) => s + x.plTotal, 0) * 100) / 100,
      'Estrangeiro (Contas)': est.length,
      'Estrangeiro (Volume R$)': Math.round(est.reduce((s, x) => s + x.plTotal, 0) * 100) / 100,
      'Total (Contas)': doGrupo.length,
      'Total (Volume R$)': Math.round(doGrupo.reduce((s, x) => s + x.plTotal, 0) * 100) / 100,
    };
  });

  const totPf = resumo.reduce((s, r) => s + r['PF (Contas)'], 0);
  const totPlPf = resumo.reduce((s, r) => s + r['PF (Volume R$)'], 0);
  const totPj = resumo.reduce((s, r) => s + r['PJ (Contas)'], 0);
  const totPlPj = resumo.reduce((s, r) => s + r['PJ (Volume R$)'], 0);
  const totEst = resumo.reduce((s, r) => s + r['Estrangeiro (Contas)'], 0);
  const totPlEst = resumo.reduce((s, r) => s + r['Estrangeiro (Volume R$)'], 0);
  const totQtd = resumo.reduce((s, r) => s + r['Total (Contas)'], 0);
  const totPl = resumo.reduce((s, r) => s + r['Total (Volume R$)'], 0);

  resumo.push({
    'Faixa de Patrimônio': 'TOTAL GERAL',
    'PF (Contas)': totPf,
    'PF (Volume R$)': Math.round(totPlPf * 100) / 100,
    'PJ (Contas)': totPj,
    'PJ (Volume R$)': Math.round(totPlPj * 100) / 100,
    'Estrangeiro (Contas)': totEst,
    'Estrangeiro (Volume R$)': Math.round(totPlEst * 100) / 100,
    'Total (Contas)': totQtd,
    'Total (Volume R$)': Math.round(totPl * 100) / 100,
  });

  const foco100a500 = itens.filter(x => x.plTotal >= 100000 && x.plTotal < 500000);

  const wb = XLSX.utils.book_new();

  // Aba 1: Resumo Executivo
  const wsResumo = XLSX.utils.json_to_sheet(resumo);
  wsResumo['!cols'] = [22, 14, 18, 14, 18, 18, 20, 16, 20].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Executivo (Plano)');

  // Aba 2: Foco 100k a 500k
  const wsFoco = XLSX.utils.json_to_sheet(foco100a500.map(c => ({
    Conta: c.conta,
    Nome: c.nome,
    Tipo: c.tipo,
    'PL Total': c.plTotal,
    Assessor: c.assessor,
    Status: c.status,
    'Tipo Investidor': c.tipoInvestidor,
    Cidade: c.cidade || '',
    Estado: c.estado || ''
  })));
  wsFoco['!cols'] = [14, 26, 12, 16, 20, 12, 16, 16, 10].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsFoco, 'Foco 100k-500k');

  // Aba 3: Todas as Contas
  const wsTodas = XLSX.utils.json_to_sheet(itens.map(c => ({
    Conta: c.conta,
    Nome: c.nome,
    Tipo: c.tipo,
    'PL Total': c.plTotal,
    Faixa: faixaDePL(c.plTotal, faixas)?.rotulo || 'Outros',
    Assessor: c.assessor,
    Status: c.status,
    'Tipo Investidor': c.tipoInvestidor,
    Cidade: c.cidade || '',
    Estado: c.estado || ''
  })));
  wsTodas['!cols'] = [14, 26, 12, 16, 18, 20, 12, 16, 16, 10].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsTodas, 'Base Completa');

  XLSX.writeFile(wb, `Plano_de_Negocio_Base_Clientes_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportarSelecaoExcel() {
  const itens = filtrarItensBase(obterItensBase());
  const faixas = S.faixasBase || FAIXAS_PADRAO_BASE;
  let sel = itens;
  if (S.filtroBase.faixaSel) {
    const fx = faixas.find(f => f.rotulo === S.filtroBase.faixaSel);
    if (fx) sel = sel.filter(x => x.plTotal >= fx.min && x.plTotal < fx.max);
  }
  if (S.filtroBase.tipoSel) {
    sel = sel.filter(x => x.tipo === S.filtroBase.tipoSel);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sel.map(c => ({
    Conta: c.conta,
    Nome: c.nome,
    Tipo: c.tipo,
    'PL Total': c.plTotal,
    Faixa: faixaDePL(c.plTotal, faixas)?.rotulo || '',
    Assessor: c.assessor,
    Status: c.status,
    'Tipo Investidor': c.tipoInvestidor,
    Cidade: c.cidade || '',
    Estado: c.estado || ''
  })));
  ws['!cols'] = [14, 26, 12, 16, 18, 20, 12, 16, 16, 10].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(wb, ws, 'Contas Filtradas');
  XLSX.writeFile(wb, `Contas_Filtradas_${(S.filtroBase.faixaSel || 'Todas').replace(/\s+/g, '_')}.xlsx`);
}

export function abrirModalFaixas() {
  const dlg = $('#dlg-extrato') as HTMLDialogElement | null;
  if (!dlg) return;

  const faixas = [...(S.faixasBase || FAIXAS_PADRAO_BASE)];

  const montarLinhas = () => {
    return faixas.map((f, i) => `
      <tr>
        <td><input type="text" class="fx-rotulo" data-i="${i}" value="${esc(f.rotulo)}" style="width:140px;padding:4px 6px;"></td>
        <td><input type="number" class="fx-min" data-i="${i}" value="${f.min === -Infinity ? '' : f.min}" placeholder="-∞" style="width:120px;padding:4px 6px;"></td>
        <td><input type="number" class="fx-max" data-i="${i}" value="${f.max === Infinity ? '' : f.max}" placeholder="+∞" style="width:120px;padding:4px 6px;"></td>
        <td><button type="button" class="btn btn-link fx-del" data-i="${i}" style="color:var(--crit);">Excluir</button></td>
      </tr>
    `).join('');
  };

  dlg.innerHTML = `
    <form method="dialog" class="dlg dlg-largo">
      <h2>Configurar Faixas de Patrimônio Líquido</h2>
      <p class="sec" style="font-size:13px;">
        Ajuste os limites mínimos e máximos (em R$) de cada faixa para adaptar a segmentação às métricas do seu plano de negócio.
      </p>

      <div style="max-height:42vh;overflow:auto;margin:12px 0;border:1px solid var(--grid);border-radius:8px;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead style="background:var(--surface-2);border-bottom:1px solid var(--grid);">
            <tr>
              <th style="text-align:left;padding:8px;">Nome da Faixa</th>
              <th style="text-align:left;padding:8px;">Mínimo (R$)</th>
              <th style="text-align:left;padding:8px;">Máximo (R$)</th>
              <th style="width:60px;"></th>
            </tr>
          </thead>
          <tbody id="tb-faixas-edit">
            ${montarLinhas()}
          </tbody>
        </table>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;">
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn" id="btn-add-faixa">+ Adicionar Faixa</button>
          <button type="button" class="btn btn-link" id="btn-reset-faixas">Restaurar Padrão</button>
        </div>
        <div class="dlg-botoes" style="margin:0;">
          <button value="cancelar" class="btn" formnovalidate>Cancelar</button>
          <button value="salvar" class="btn btn-pri" id="btn-salvar-faixas">Salvar e Recalcular</button>
        </div>
      </div>
    </form>
  `;

  const atualizarTbody = () => {
    const tb = $('#tb-faixas-edit');
    if (tb) tb.innerHTML = montarLinhas();
    vincularEventosLinhas();
  };

  const vincularEventosLinhas = () => {
    dlg.querySelectorAll('.fx-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = +(btn as HTMLElement).dataset.i!;
        faixas.splice(i, 1);
        atualizarTbody();
      });
    });
    dlg.querySelectorAll('.fx-rotulo').forEach(inp => {
      inp.addEventListener('input', () => {
        const i = +(inp as HTMLElement).dataset.i!;
        faixas[i].rotulo = (inp as HTMLInputElement).value;
      });
    });
    dlg.querySelectorAll('.fx-min').forEach(inp => {
      inp.addEventListener('input', () => {
        const i = +(inp as HTMLElement).dataset.i!;
        const v = (inp as HTMLInputElement).value.trim();
        faixas[i].min = v === '' ? -Infinity : Number(v);
      });
    });
    dlg.querySelectorAll('.fx-max').forEach(inp => {
      inp.addEventListener('input', () => {
        const i = +(inp as HTMLElement).dataset.i!;
        const v = (inp as HTMLInputElement).value.trim();
        faixas[i].max = v === '' ? Infinity : Number(v);
      });
    });
  };

  $('#btn-add-faixa')?.addEventListener('click', () => {
    faixas.push({ rotulo: 'Nova Faixa', min: 0, max: 100000 });
    atualizarTbody();
  });

  $('#btn-reset-faixas')?.addEventListener('click', () => {
    faixas.length = 0;
    faixas.push(...JSON.parse(JSON.stringify(FAIXAS_PADRAO_BASE)));
    atualizarTbody();
  });

  $('#btn-salvar-faixas')?.addEventListener('click', async (e) => {
    e.preventDefault();
    S.faixasBase = faixas;
    await salvarFaixasBase();
    dlg.close();
    renderBaseClientes();
  });

  vincularEventosLinhas();
  dlg.showModal();
}
