import * as XLSX from 'xlsx';
import { $ } from '../dom';
import { esc, brl, brlCurto, inteiro, pct, num, norm } from '../formatters';
import { somaLista, somaPrecisa, subPrecisa, multPrecisa, divPrecisa } from '../../domain/precision';
import { S } from '../../domain/state';
import {
  somar,
  somarPor,
  ordenadoDesc,
  investimentos,
  valor,
  unidades
} from '../../domain/calculations';
import { kpi, kpiDG } from '../kpi';
import { miniBarra, calor } from '../charts';
import { tabela, tabelaDG } from '../dom';
import { celUnidade, attrUnidade } from './carteira';
import { registrar } from '../../domain/storage';

export function infoAtivo() {
  const doAtivo = S.posicoes.filter(p => norm(p.nomeAtivo) === norm(S.ativo));
  return doAtivo.length
    ? { existe: true, classe: doAtivo[0].classe, subclasse: doAtivo[0].subclasse, estrategia: doAtivo[0].estrategia, doAtivo }
    : { existe: false, classe: '', subclasse: '', estrategia: '', doAtivo };
}

export function simular() {
  const contas = unidades('cliente');
  const info = infoAtivo();
  const posAtual = new Map<string, number>(),
    sub = new Map<string, number>(),
    cla = new Map<string, number>();
  const soma = (m: Map<string, number>, p: any) => m.set(p.clienteId, somaPrecisa(m.get(p.clienteId), valor(p)));
  for (const p of info.doAtivo) soma(posAtual, p);
  if (info.existe) {
    for (const p of S.posicoes) {
      if (p.classe === info.classe) soma(cla, p);
      if (p.classe === info.classe && p.subclasse === info.subclasse) soma(sub, p);
    }
  }
  let linhas = [...contas.values()].map(c => {
    const atual = posAtual.get(c.key) || 0;
    const valorAlvo = multPrecisa(c.pl, S.alvo);
    const dif = subPrecisa(valorAlvo, atual);
    const aAlocar = dif >= S.minimo && dif > 0 ? dif : 0;
    let sit: [string, string];
    if (dif <= 0) sit = ['neutro', 'Já no alvo ou acima'];
    else if (dif < S.minimo) sit = ['neutro', 'Abaixo do mínimo'];
    else if (aAlocar > c.caixa) sit = ['alerta', 'Caixa insuficiente'];
    else sit = ['ok', 'Pode alocar'];
    return {
      key: c.key,
      u: c,
      contasTxt: c.contas.join(', '),
      nome: c.nome,
      pl: c.pl,
      caixa: c.caixa,
      pCaixa: divPrecisa(c.caixa, c.pl || 1),
      atual,
      pAtual: divPrecisa(atual, c.pl || 1),
      pSub: divPrecisa(sub.get(c.key) || 0, c.pl || 1),
      pClasse: divPrecisa(cla.get(c.key) || 0, c.pl || 1),
      valorAlvo,
      aAlocar,
      pDepois: divPrecisa(somaPrecisa(atual, aAlocar), c.pl || 1),
      sitTipo: sit[0],
      situacao: sit[1]
    };
  });
  if (S.publico === 'tem') linhas = linhas.filter(l => l.atual > 0);
  if (S.publico === 'naotem') linhas = linhas.filter(l => l.atual === 0);
  return { linhas, info, posAtual, contas };
}

export function posicaoAtivos(nomes: string[]) {
  const us = unidades('cliente'),
    totalBase = somar(S.posicoes);
  const ativos = nomes.map(nome => {
    const ps = S.posicoes.filter(p => p.nomeAtivo === nome);
    const porCli = new Map<string, number>();
    for (const p of ps) porCli.set(p.clienteId!, somaPrecisa(porCli.get(p.clienteId!), valor(p)));
    const v = somaLista([...porCli.values()]);
    const pesos = [...porCli.entries()].map(([k, x]) => divPrecisa(x, us.get(k)?.pl || 1));
    const clientes = [...porCli.entries()].map(([k, x]) => ({ nome: us.get(k)?.nome || k, p: divPrecisa(x, us.get(k)?.pl || 1) }));
    return {
      nome,
      classe: ps[0]?.classe || '–',
      subclasse: ps[0]?.subclasse || '–',
      porCli,
      clientes,
      v,
      media: divPrecisa(v, totalBase || 1),
      nCli: porCli.size,
      pesoMedio: pesos.length ? divPrecisa(somaLista(pesos), pesos.length) : 0,
      maior: pesos.length ? Math.max(...pesos) : 0,
      maiorNome: clientes.length ? clientes.reduce((a, c) => (c.p > a.p ? c : a)).nome : ''
    };
  });
  const vSel = somaLista(ativos, x => x.v),
    mediaSel = divPrecisa(vSel, totalBase || 1);
  const linhas = [...us.values()]
    .map(u => {
      const l: any = { key: u.key, u, nome: u.nome, contasTxt: u.contas.join(', '), pl: u.pl, total: 0 };
      ativos.forEach((a, i) => {
        const v = a.porCli.get(u.key) || 0;
        l['v' + i] = v;
        l['p' + i] = divPrecisa(v, u.pl || 1);
        l.total = somaPrecisa(l.total, v);
      });
      l.pTotal = divPrecisa(l.total, u.pl || 1);
      l.dif = subPrecisa(l.pTotal, mediaSel);
      return l;
    })
    .filter(l => l.total > 0.005);
  return { ativos, linhas, vSel, mediaSel, totalBase, nClientes: us.size };
}

export function visAtivos(R: any): string {
  const ativos = [...R.ativos].sort((a, b) => b.v - a.v);
  const cores = ['#0A1F44', '#1F4E87', '#2E6FB7', '#4A86C5', '#3C4A5E', '#5C6B80', '#7FA6D3', '#8995A8'];
  const cor = (i: number) => cores[i % cores.length];
  const maxP = Math.max(...ativos.map(a => a.maior), 0.0001);
  const anel = (n: number, tot: number) => {
    const r = 22,
      c = 2 * Math.PI * r,
      f = tot ? n / tot : 0;
    return `<svg width="58" height="58" viewBox="0 0 58 58"><circle cx="29" cy="29" r="${r}" fill="none" stroke="#E3E9F0" stroke-width="7"/>
      <circle cx="29" cy="29" r="${r}" fill="none" stroke="#1F4E87" stroke-width="7" stroke-dasharray="${(c * f).toFixed(
      2
    )} ${c.toFixed(2)}" transform="rotate(-90 29 29)"/>
      <text x="29" y="33" text-anchor="middle" font-size="13" font-weight="800" fill="#0A1F44" font-family="Manrope, sans-serif">${n}/${tot}</text></svg>`;
  };
  const barra = (rot: string, sub: string, v: number, c: string) => `<div class="va-b"><span class="r">${esc(rot)}${
    sub ? `<small title="${esc(sub)}">${esc(sub)}</small>` : ''
  }</span>
    <span class="tr"><i style="width:${((Math.max(0, v) / maxP) * 100).toFixed(1)}%;background:${c}"></i></span><span class="v">${esc(
    pct(v, 2)
  )}</span></div>`;
  const pilha =
    ativos.length > 1
      ? `<div class="va-part"><div class="va-k">Composição do total selecionado (${esc(brl(R.vSel))})</div>
    <div class="va-pilha">${ativos
      .map(
        (a, i) =>
          `<i style="width:${((a.v / (R.vSel || 1)) * 100).toFixed(2)}%;background:${cor(i)}" data-tip="${esc(
            `${a.nome}\n${brl(a.v)} • ${pct(a.v / (R.vSel || 1), 1)} do selecionado`
          )}">${a.v / (R.vSel || 1) >= 0.08 ? esc(pct(a.v / (R.vSel || 1), 0)) : ''}</i>`
      )
      .join('')}</div>
    <div class="va-pilha-leg">${ativos
      .map((a, i) => `<span style="--c:${cor(i)}">${esc(a.nome)} <b>${esc(pct(a.v / (R.vSel || 1), 1))}</b></span>`)
      .join('')}</div></div>`
      : '';

  return `<div class="vis-ativos">${pilha}<div class="va-cards">${ativos
    .map(
      (a, i) => `<div class="va-card" style="--c:${cor(i)}">
      <div class="va-topo"><div><b>${esc(a.nome)}</b><small>${esc(a.classe)} › ${esc(a.subclasse)}</small>
        <div class="va-valor">${esc(brl(a.v))}<span>${esc(pct(a.media, 2))} da base</span></div></div>
        <div class="va-anel">${anel(a.nCli, R.nClientes)}clientes<br>com posição</div></div>
      <div class="va-barras">
        ${barra('Média da carteira', '', a.media, '#B7791F')}
        ${barra('Peso médio', 'de quem tem', a.pesoMedio, '#2E6FB7')}
        ${barra('Maior peso', a.maiorNome, a.maior, '#0A1F44')}
      </div></div>`
    )
    .join('')}</div>
    <div class="va-nota">Média da carteira = peso do ativo no patrimônio total da base. Peso médio = média do peso na carteira de quem tem o ativo. As barras usam a mesma escala em todos os cartões.</div></div>`;
}

export function renderPosicao(nomes: string[]) {
  const R = posicaoAtivos(nomes),
    varios = nomes.length > 1;
  const titEl = $('#pos-titulo');
  if (titEl) {
    titEl.textContent = varios
      ? `Posição por cliente nos ${nomes.length} ativos selecionados`
      : `Posição por cliente em ${nomes[0] || '–'}`;
  }
  const resumoAtivos = $('#tab-resumo-ativos');
  if (resumoAtivos) resumoAtivos.innerHTML = visAtivos(R);

  const maxP = Math.max(...R.linhas.flatMap(l => R.ativos.map((_, i) => l['p' + i])), 0.0001);
  const cel = (v: number, p: number) =>
    v > 0.005 ? `<div class="pos-cel"><b>${esc(brl(v))}</b><small>${esc(pct(p, 2))} da carteira</small></div>` : '<span class="muted">–</span>';
  const difTxt = (d: number) =>
    `<span class="delta-pos ${d >= 0 ? 'mais' : 'menos'}">${d >= 0 ? '▲ +' : '▼ '}${num(d * 100, 2)} p.p.</span>`;

  const cols: any[] = [
    { k: 'nome', rot: 'Cliente', html: (_v: any, l: any) => celUnidade(l.u) },
    { k: 'pl', rot: 'Patrimônio', n: true, fmt: brlCurto }
  ];
  R.ativos.forEach((a, i) =>
    cols.push({
      k: 'v' + i,
      rot: a.nome,
      n: true,
      html: (_v: any, l: any) => cel(l['v' + i], l['p' + i]),
      estilo: (_v: any, l: any) => calor(l['p' + i] / maxP),
      cls: 'heat'
    })
  );
  if (varios) {
    cols.push({
      k: 'total',
      rot: 'Total selecionado',
      n: true,
      cls: 'col-tot',
      html: (_v: any, l: any) => cel(l.total, l.pTotal)
    });
  }
  cols.push({ k: 'dif', rot: 'vs. média da carteira', n: true, html: (v: number) => difTxt(v) });

  const ref = `<tr class="tot-cli"><td>Total dos clientes</td><td class="n">${esc(
    brlCurto(somaLista(R.linhas, l => l.pl))
  )}</td>${R.ativos.map(a => `<td class="n">${esc(brl(a.v))}</td>`).join('')}${
    varios ? `<td class="n">${esc(brl(R.vSel))}</td>` : ''
  }<td></td></tr>
    <tr class="media-cart"><td>Média da carteira <small>(peso no patrimônio total da base)</small></td><td class="n">${esc(
      brlCurto(R.totalBase)
    )}</td>${R.ativos.map(a => `<td class="n">${esc(pct(a.media, 2))}</td>`).join('')}${
    varios ? `<td class="n">${esc(pct(R.mediaSel, 2))}</td>` : ''
  }<td></td></tr>`;

  const tabPosicao = $('#tab-posicao');
  if (tabPosicao) {
    tabPosicao.innerHTML = R.linhas.length
      ? tabela('posicao', cols, R.linhas, { attr: l => attrUnidade(l.u), padrao: { k: varios ? 'total' : 'v0', dir: -1 } }).replace(
          '</tbody>',
          ref + '</tbody>'
        )
      : '<p class="muted">Nenhum cliente tem posição nos ativos selecionados.</p>';
  }
  return R;
}

export function exportarPosicao() {
  const nomes = S.ativoModo === 'varios' ? S.ativosSel : [S.ativo];
  if (!nomes.length) return;
  const R = posicaoAtivos(nomes);
  const fmt = (ws: any, cab: string[]) => {
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let r = 1; r <= range.e.r; r++)
      cab.forEach((nome, c) => {
        const cel = ws[XLSX.utils.encode_cell({ r, c })];
        if (!cel || typeof cel.v !== 'number') return;
        cel.z = /\(%\)|^%|Média|Peso|Maior|p\.p\./.test(nome) ? '0.00%' : /Clientes/.test(nome) ? '0' : '"R$" #,##0.00';
      });
    ws['!cols'] = cab.map(n => ({ wch: Math.max(14, n.length + 2) }));
  };
  const resumo = R.ativos.map(a => ({
    Ativo: a.nome,
    Classe: a.classe,
    Subclasse: a.subclasse,
    'Total na base (R$)': a.v,
    'Média da carteira (%)': a.media,
    Clientes: a.nCli,
    'Peso médio de quem tem (%)': a.pesoMedio,
    'Maior peso (%)': a.maior
  }));
  const porCliente = [...R.linhas]
    .sort((a, b) => b.total - a.total)
    .map(l => {
      const r: any = { Cliente: l.nome, Contas: l.contasTxt, 'Patrimônio (R$)': l.pl };
      R.ativos.forEach((a, i) => {
        r[`${a.nome} (R$)`] = l['v' + i];
        r[`${a.nome} (%)`] = l['p' + i];
      });
      if (R.ativos.length > 1) {
        r['Total selecionado (R$)'] = l.total;
        r['Total selecionado (%)'] = l.pTotal;
      }
      r['Média da carteira (%)'] = R.mediaSel;
      r['Diferença para a média (p.p.)'] = l.dif;
      return r;
    });
  const wb = XLSX.utils.book_new();
  for (const [nome, dados] of [
    ['Resumo', resumo],
    ['Por cliente', porCliente]
  ] as [string, any[]][]) {
    const ws = XLSX.utils.json_to_sheet(dados);
    fmt(ws, Object.keys(dados[0] || {}));
    XLSX.utils.book_append_sheet(wb, ws, nome);
  }
  XLSX.writeFile(
    wb,
    `Posicao_${nomes.length > 1 ? nomes.length + '_ativos' : nomes[0].replace(/[^\w\-]+/g, '_').slice(0, 30)}_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`
  );
  registrar('Posição em ativos baixada (Excel)', nomes.join(', '));
}

export function pdfPosicao() {
  const nomes = S.ativoModo === 'varios' ? S.ativosSel : [S.ativo];
  if (!nomes.length) return;
  const R = posicaoAtivos(nomes),
    varios = nomes.length > 1;
  const css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
  const ini = css.indexOf('/* ---------- Diagnóstico de alocação'),
    fim = css.indexOf('/* ---------- Fontes carregadas');
  const cssDiag = ini >= 0 && fim > ini ? css.slice(ini, fim) : '';
  const logo = (document.querySelector('.logo') as HTMLImageElement)?.src || '';
  const hoje = new Date().toLocaleDateString('pt-BR');
  const linhas = [...R.linhas].sort((a, b) => b.total - a.total);
  const difTxt = (d: number) => `${d >= 0 ? '+' : ''}${num(d * 100, 2)} p.p.`;
  const kpis =
    kpiDG(
      varios ? 'Total selecionado na base' : 'Total na base',
      brl(R.vSel),
      `${pct(R.mediaSel, 2)} do patrimônio da base`,
      'main'
    ) +
    kpiDG('Clientes com posição', `${linhas.length} de ${R.nClientes}`, varios ? 'em pelo menos um dos ativos' : '') +
    kpiDG('Média da carteira', pct(R.mediaSel, 2), 'peso no patrimônio total') +
    kpi(
      'Peso médio de quem tem',
      linhas.length ? pct(divPrecisa(somaLista(linhas, l => l.pTotal), linhas.length), 2) : '–',
      linhas.length ? `maior: ${pct(Math.max(...linhas.map(l => l.pTotal)), 2)}` : ''
    );
  const tabResumo = `<div class="box-k bloco-dg">Ativos frente à carteira</div>${visAtivos(R)}`;
  const cols = [
    { rot: 'Cliente', w: '20%', l: true, f: (l: any) => `<span class="nm">${esc(l.nome)}</span>` },
    { rot: 'Patrimônio (R$)', w: 'auto', f: (l: any) => brl(l.pl) }
  ];
  R.ativos.forEach((a, i) =>
    cols.push({
      rot: `${a.nome} (R$ · %)`,
      w: 'auto',
      f: (l: any) => (l['v' + i] > 0.005 ? `${brl(l['v' + i])}<br><small>${pct(l['p' + i], 2)}</small>` : '—')
    })
  );
  if (varios) {
    cols.push({ rot: 'Total (R$ · %)', w: 'auto', f: (l: any) => `<b>${brl(l.total)}</b><br><small>${pct(l.pTotal, 2)}</small>` });
  }
  cols.push({ rot: 'vs. média', w: '9%', f: (l: any) => difTxt(l.dif) });
  const tot = [
    'TOTAL DOS CLIENTES',
    brl(somaLista(linhas, l => l.pl)),
    ...R.ativos.map(a => brl(a.v)),
    ...(varios ? [brl(R.vSel)] : []),
    ''
  ];
  const media = [
    'MÉDIA DA CARTEIRA',
    brl(R.totalBase),
    ...R.ativos.map(a => pct(a.media, 2)),
    ...(varios ? [pct(R.mediaSel, 2)] : []),
    ''
  ];
  const tabCli = tabelaDG(cols, linhas, tot).replace(
    '</tbody>',
    `<tr class="total media">${media.map((v, i) => `<td class="${i ? 'num' : 'l'}">${v}</td>`).join('')}</tr></tbody>`
  );
  const rod = (n: number) =>
    `<div class="rod"><span>Confidencial • Uso interno • Média da carteira = peso do ativo no patrimônio total da base</span><span>Propósito Capital • ${n}/2</span></div>`;

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Posicao_${esc(
    varios ? nomes.length + '_ativos' : nomes[0]
  )}_${hoje.replace(/\//g, '-')}</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${cssDiag}
@page { size: A4 landscape; margin: 9mm 11mm; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; color: #0E1726; font-family: "Manrope", "Segoe UI", Arial, sans-serif; font-variant-numeric: tabular-nums lining-nums; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.barra { position: sticky; top: 0; background: #0A1F44; color: #fff; padding: 10px 16px; display: flex; gap: 12px; align-items: center; font-size: 13px; z-index: 5; }
.barra button { background: #fff; color: #0A1F44; border: 0; border-radius: 6px; padding: 7px 14px; font-weight: 700; cursor: pointer; }
.folha { width: 275mm; margin: 0 auto; }
.cab { display: flex; align-items: center; justify-content: space-between; background: #0A1F44; color: #fff; padding: 4mm 6mm; margin: 4mm 0 5mm; }
.cab img { height: 11mm; } .cab .t { text-align: right; } .cab .t b { display: block; font-size: 16px; } .cab .t span { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; opacity: .8; }
.ativos-sel { font-size: 12px; color: #2F3D52; margin-bottom: 4mm; }
#diag { zoom: .9; } #diag tr { break-inside: avoid; } #diag thead { display: table-header-group; }
#diag table.dt small { color: inherit; opacity: .8; }
.pg2 { break-before: page; padding-top: 4mm; }
.pg { break-inside: avoid; }
#diag table.dt tr.total td { background: #0A1F44 !important; color: #fff; font-weight: 800; font-size: 13px; }
#diag table.dt tr.total.media td { background: #DCE7F4 !important; color: #0A1F44; }
.vis-ativos { break-inside: avoid; } .va-linha { break-inside: avoid; }
.rod { font-size: 9px; color: #56657A; border-top: 1px solid #CBD6E3; padding-top: 2mm; margin-top: 5mm; display: flex; justify-content: space-between; }
@media print { .barra { display: none; } }
</style></head><body>
<div class="barra"><span>Na janela de impressão: destino <b>Salvar como PDF</b>, layout <b>Paisagem</b>; em <b>Mais configurações</b>, desmarque <b>Cabeçalhos e rodapés</b> e marque <b>Gráficos de plano de fundo</b>.</span><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
<div class="folha">
  <div class="cab"><img src="${logo}" alt="Propósito Capital"><div class="t"><span>Posição em ativos</span><b>${esc(
    varios ? `${nomes.length} ativos selecionados` : nomes[0]
  )}</b><span>Base de ${hoje}</span></div></div>
  ${varios ? `<div class="ativos-sel"><b>Ativos:</b> ${esc(nomes.join(' • '))}</div>` : ''}
  <div id="diag"><section class="pg"><div class="kpis-dg">${kpis}</div>${tabResumo}${rod(1)}</section>
    <section class="pg pg2"><div class="box-k">Posição por cliente <span class="bk-x">valor, % da carteira do cliente e diferença para a média da carteira</span></div>${tabCli}${rod(
    2
  )}</section></div>
</div>
<script>
function encaixar() {
  const mm = 96 / 25.4, util = (210 - 18) * mm - 70;
  document.querySelectorAll('.pg').forEach((s, i) => {
    s.style.zoom = '';
    const extra = i === 0 ? document.querySelector('.cab').offsetHeight + 60 : 0;
    const h = s.getBoundingClientRect().height + extra;
    if (h > util && util / h >= 0.55) s.style.zoom = (util / h).toFixed(3);
    s.style.breakInside = h > util && util / h < 0.55 ? 'auto' : '';
  });
}
encaixar();
window.addEventListener('beforeprint', encaixar);
document.fonts && document.fonts.ready.then(encaixar);
<\/script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) {
    alert('O navegador bloqueou a janela do relatório. Permita pop-ups para este arquivo e tente de novo.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  registrar('Posição em ativos baixada (PDF)', nomes.join(', '));
}

export function exportarSimulacao() {
  const { linhas, info } = simular();
  const dados = linhas
    .sort((a, b) => b.aAlocar - a.aAlocar)
    .map(l => {
      const r: any = {
        Cliente: l.nome,
        Contas: l.contasTxt,
        Patrimônio: l.pl,
        Caixa: l.caixa,
        'Posição atual': l.atual,
        '% atual': l.pAtual
      };
      if (info.existe) {
        r[`% ${info.subclasse}`] = l.pSub;
        r[`% ${info.classe}`] = l.pClasse;
      }
      return Object.assign(r, {
        'Valor alvo': l.valorAlvo,
        'A alocar': l.aAlocar,
        '% depois': l.pDepois,
        Situação: l.situacao
      });
    });
  const ws = XLSX.utils.json_to_sheet(dados);
  const cab = Object.keys(dados[0] || {});
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let r = 1; r <= range.e.r; r++) {
    cab.forEach((nome, c) => {
      const cel = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cel || typeof cel.v !== 'number') return;
      cel.z = nome.startsWith('%') ? '0.00%' : '"R$" #,##0.00';
    });
  }
  ws['!cols'] = cab.map(n => ({ wch: Math.max(12, n.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Alocação');
  const nome = S.ativo.replace(/[^\w\-]+/g, '_').slice(0, 30);
  XLSX.writeFile(wb, `alocacao_${nome}_${num(S.alvo * 100, 1).replace(',', '-')}%pct.xlsx`);
}

export function renderAtivo() {
  const inv = investimentos();
  const total = somar(S.posicoes);
  const porAtivo = new Map<string, any>();
  for (const p of inv) {
    const nomeAtivo = p.nomeAtivo || 'Sem nome';
    let a = porAtivo.get(nomeAtivo);
    if (!a) porAtivo.set(nomeAtivo, (a = { nome: nomeAtivo, classe: p.classe, v: 0, contas: new Set() }));
    a.v = somaPrecisa(a.v, valor(p));
    a.contas.add(p.clienteId);
  }
  const ativos = [...porAtivo.values()];
  if (!S.ativo) S.ativo = ativos.sort((a, b) => b.v - a.v)[0]?.nome || '';
  const classes = ordenadoDesc(somarPor(inv, p => p.classe)).map(([k]) => k);
  const existeNaLista = porAtivo.has(S.ativo);

  const selAtivo = $('#sel-ativo') as HTMLSelectElement | null;
  if (selAtivo) {
    selAtivo.innerHTML =
      (existeNaLista ? '' : `<option value="${esc(S.ativo)}">${esc(S.ativo)} (ativo novo)</option>`) +
      classes
        .map(
          cl =>
            `<optgroup label="${esc(cl)}">` +
            ativos
              .filter(a => a.classe === cl)
              .sort((a, b) => b.v - a.v)
              .map(
                a => `<option value="${esc(a.nome)}">${esc(a.nome)} — ${esc(brlCurto(a.v))} · ${a.contas.size} cliente(s)</option>`
              )
              .join('') +
            '</optgroup>'
        )
        .join('');
    selAtivo.value = S.ativo;
  }

  const varios = S.ativoModo === 'varios';
  document.querySelectorAll('#seg-modo-ativo button').forEach(b =>
    b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.v === S.ativoModo))
  );

  const campoUm = $('#campo-um-ativo'),
    campoNovo = $('#campo-novo-ativo'),
    campoVar = $('#campo-varios'),
    cartaoSim = $('#cartao-sim-ativo');
  if (campoUm) campoUm.hidden = varios;
  if (campoNovo) campoNovo.hidden = varios;
  if (campoVar) campoVar.hidden = !varios;
  if (cartaoSim) cartaoSim.hidden = varios;

  if (varios) {
    S.ativosSel = S.ativosSel.filter(n => porAtivo.has(n));
    if (!S.ativosSel.length && porAtivo.has(S.ativo)) S.ativosSel = [S.ativo];
    const chipsSel = $('#chips-sel');
    if (chipsSel) {
      chipsSel.innerHTML = S.ativosSel
        .map(
          n =>
            `<span class="chip-sel">${esc(n)}<button type="button" data-tirar-ativo="${esc(
              n
            )}" title="Tirar ${esc(n)}" aria-label="Tirar ${esc(n)}">×</button></span>`
        )
        .join('');
    }
    const listaAtivos = $('#lista-ativos');
    if (listaAtivos) {
      listaAtivos.innerHTML = ativos
        .filter(a => !S.ativosSel.includes(a.nome))
        .sort((a, b) => b.v - a.v)
        .map(a => `<option value="${esc(a.nome)}">${esc(a.classe)} · ${esc(brlCurto(a.v))}</option>`)
        .join('');
    }
    const chipsAtivo = $('#chips-ativo');
    if (chipsAtivo) chipsAtivo.innerHTML = S.ativosSel.length ? '' : '<span class="chip">Digite no campo acima para escolher os ativos.</span>';
    const R = S.ativosSel.length ? renderPosicao(S.ativosSel) : null;
    const cartaoPos = $('#cartao-posicao');
    if (cartaoPos) cartaoPos.hidden = !R;
    const kpiAtivo = $('#kpi-ativo');
    if (kpiAtivo) {
      kpiAtivo.innerHTML = R
        ? kpi(
            'Total selecionado na base',
            brlCurto(R.vSel),
            `${pct(R.mediaSel, 2)} do patrimônio da base (média da carteira)`,
            brl(R.vSel)
          ) +
          kpi('Clientes com posição', `${R.linhas.length} de ${R.nClientes}`, 'em pelo menos um dos ativos') +
          kpi('Ativos selecionados', inteiro(S.ativosSel.length)) +
          kpi(
            'Peso médio de quem tem',
            R.linhas.length ? pct(divPrecisa(somaLista(R.linhas, l => l.pTotal), R.linhas.length), 2) : '–',
            R.linhas.length ? `maior: ${pct(Math.max(...R.linhas.map(l => l.pTotal)), 2)}` : ''
          )
        : '';
    }
    return;
  }

  const { linhas, info, posAtual, contas } = simular();
  const chipsAtivo = $('#chips-ativo');
  if (chipsAtivo) {
    chipsAtivo.innerHTML = info.existe
      ? `<span class="chip">Classe <b>${esc(info.classe)}</b></span><span class="chip">Subclasse <b>${esc(
          info.subclasse
        )}</b></span><span class="chip">Estratégia <b>${esc(info.estrategia)}</b></span>`
      : `<span class="chip"><b>Ativo novo</b>: nenhum cliente tem posição. A alocação é calculada a partir do zero.</span>`;
  }

  const vTot = somaLista([...posAtual.values()]);
  const pesos = [...posAtual.entries()].map(([c, v]) => divPrecisa(v, contas.get(c)?.pl || 1));
  const kpiAtivo = $('#kpi-ativo');
  if (kpiAtivo) {
    kpiAtivo.innerHTML =
      kpi('Total na base', brlCurto(vTot), `${pct(divPrecisa(vTot, total || 1), 2)} do patrimônio da base`, brl(vTot)) +
      kpi('Clientes com posição', `${posAtual.size} de ${contas.size}`) +
      kpi('Peso médio (quem tem)', pesos.length ? pct(divPrecisa(somaLista(pesos), pesos.length), 2) : '–') +
      kpi('Maior peso', pesos.length ? pct(Math.max(...pesos), 2) : '–');
  }

  const aAlocar = somaLista(linhas, l => l.aAlocar);
  const semCaixa = linhas.filter(l => l.sitTipo === 'alerta');
  const kpiSim = $('#kpi-sim');
  if (kpiSim) {
    kpiSim.innerHTML =
      kpi('Total a alocar', brlCurto(aAlocar), '', brl(aAlocar)) +
      kpi('Clientes que recebem', inteiro(linhas.filter(l => l.aAlocar > 0).length), `de ${linhas.length} no filtro`) +
      kpi(
        'Com caixa insuficiente',
        inteiro(semCaixa.length),
        semCaixa.length ? `faltam ${brlCurto(somaLista(semCaixa, l => subPrecisa(l.aAlocar, l.caixa)))} de caixa` : ''
      );
  }

  const maxAtivo = Math.max(S.alvo, ...linhas.map(l => Math.max(l.pAtual, l.pDepois))) * 1.1 || 1;
  const maxSub = Math.max(...linhas.map(l => l.pSub), 0.0001),
    maxCla = Math.max(...linhas.map(l => l.pClasse), 0.0001);
  const cols: any[] = [
    { k: 'nome', rot: 'Cliente', html: (_v: any, l: any) => celUnidade(l.u) },
    { k: 'pl', rot: 'Patrimônio', n: true, fmt: brlCurto },
    { k: 'pAtual', rot: `% em ${S.ativo}`, n: true, html: (v: number) => miniBarra(v, maxAtivo, S.alvo) }
  ];
  if (info.existe) {
    if (info.subclasse !== info.classe) {
      cols.push({
        k: 'pSub',
        rot: `% em ${info.subclasse}`,
        n: true,
        fmt: (v: number) => (v > 0 ? pct(v) : '–'),
        estilo: (v: number) => calor(v / maxSub),
        cls: 'heat'
      });
    }
    cols.push({
      k: 'pClasse',
      rot: `% em ${info.classe}`,
      n: true,
      fmt: (v: number) => (v > 0 ? pct(v) : '–'),
      estilo: (v: number) => calor(v / maxCla),
      cls: 'heat'
    });
  }
  cols.push(
    {
      k: 'caixa',
      rot: 'Caixa',
      n: true,
      html: (v: number, l: any) => `${esc(brlCurto(v))} <small class="muted">${esc(pct(l.pCaixa))}</small>`
    },
    {
      k: 'aAlocar',
      rot: 'A alocar',
      n: true,
      html: (v: number) => (v > 0 ? `<b>${esc(brl(v))}</b>` : '<span class="muted">–</span>')
    },
    { k: 'pDepois', rot: '% depois', n: true, fmt: (v: number) => pct(v, 2) },
    { k: 'situacao', rot: 'Situação', html: (v: string, l: any) => `<span class="pill ${l.sitTipo}">${esc(v)}</span>` }
  );
  const tabSim = $('#tab-sim');
  if (tabSim) {
    tabSim.innerHTML = tabela('sim', cols, linhas, { attr: l => attrUnidade(l.u), padrao: { k: 'pAtual', dir: -1 } });
  }

  const cartaoPos = $('#cartao-posicao');
  if (cartaoPos) cartaoPos.hidden = !info.existe;
  if (info.existe) renderPosicao([S.ativo]);
}
