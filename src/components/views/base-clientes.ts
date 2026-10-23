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

  box.innerHTML = `
    <!-- Topo de Ações e Título -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
      <div>
        <h2 style="font-size:18px;margin:0 0 4px;font-weight:700;">Base de Clientes & CRM — Plano de Negócio</h2>
        <p class="sec" style="margin:0;font-size:13px;">
          Análise fiduciária e segmentação de contas por tipo (PF/PJ) e faixas de patrimônio da Base BTG.
        </p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" class="btn" id="btn-editar-faixas">⚙️ Editar Faixas de PL</button>
        <button type="button" class="btn btn-pri" id="btn-exportar-plano">📊 Exportar Apresentação (Excel)</button>
        <button type="button" class="btn" id="btn-trocar-base">📁 Atualizar Planilha BTG</button>
        <input type="file" id="arq-trocar-base" accept=".xlsx,.xls" hidden>
      </div>
    </div>

    <!-- KPIs de Destaque -->
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

    <!-- Tabela Matriz por Faixa e Tipo -->
    <div class="cartao cartao-destaque" style="margin-bottom:16px;">
      <div class="cartao-topo">
        <div>
          <h2>Matriz de Segmentação por Faixa de Patrimônio e Tipo de Cliente</h2>
          <p>Distribuição de contas e volume financeiro. Clique em qualquer número para filtrar a lista detalhada abaixo.</p>
        </div>
        ${S.filtroBase.faixaSel || S.filtroBase.tipoSel ? `
          <div style="font-size:12px;background:var(--surface-2);padding:4px 10px;border-radius:6px;">
            Filtro ativo: <b>${esc(S.filtroBase.faixaSel || 'Todas as faixas')}</b> ${S.filtroBase.tipoSel ? `· <b>${esc(S.filtroBase.tipoSel)}</b>` : ''}
            <button type="button" class="btn-link" id="btn-reset-selecao" style="margin-left:8px;font-size:11px;">[Desmarcar]</button>
          </div>
        ` : ''}
      </div>

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
        <button type="button" class="btn" id="btn-exportar-selecao">📥 Baixar Lista Filtrada (Excel)</button>
      </div>

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
    </div>
  `;

  // Listeners de eventos
  vincularEventosBase(itensTodos);
}

function vincularEventosBase(itensTodos: ItemUnidade[]) {
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
