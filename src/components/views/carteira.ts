import { $ } from '../dom';
import { esc, brl, brlCurto, inteiro, pct, norm } from '../formatters';
import { somaLista, somaPrecisa } from '../../domain/precision';
import { S } from '../../domain/state';
import {
  somar,
  somarPor,
  ordenadoDesc,
  contasResumo,
  investimentos,
  valor,
  dimDe,
  CHAVE,
  unidadeDe,
  unidades
} from '../../domain/calculations';
import { kpi } from '../kpi';
import { barras, calor } from '../charts';
import { tabela, ordenar, setaOrdem } from '../dom';
import type { Posicao } from '../../types';

export const attrUnidade = (u: any) => `data-ir-unidade="${esc(u.key)}"`;
export const celUnidade = (u: any) =>
  `<div class="conta-cel"><span>${esc(u.nome)}${u.tipo === 'familia' ? '<span class="tag">família</span>' : ''}</span><small>${esc(u.sub)}</small></div>`;

export function renderCarteira() {
  const P = S.posicoes,
    total = somar(P),
    contas = contasResumo();
  const caixaTotal = somaLista(P.filter(p => p.caixa), valor);

  const kpiEl = $('#kpi-carteira');
  if (kpiEl) {
    kpiEl.innerHTML =
      kpi('Patrimônio total', brlCurto(total), '', brl(total)) +
      kpi(
        'Clientes',
        inteiro(S.clientes.size),
        `${inteiro(contas.size)} contas${
          S.familias.size ? ` · ${inteiro(S.familias.size)} família(s) com 2+ pessoas` : ''
        }`
      ) +
      kpi(
        'Patrimônio médio por cliente',
        brlCurto(total / (S.clientes.size || 1)),
        '',
        brl(total / (S.clientes.size || 1))
      ) +
      kpi('Caixa na base', brlCurto(caixaTotal), `${pct(caixaTotal / (total || 1))} do patrimônio`, brl(caixaTotal)) +
      kpi('Ativos diferentes', inteiro(new Set(investimentos().map(p => p.nomeAtivo)).size));
  }

  renderMapa(contas, total);

  // Alocação por dimensão (classe expande em subclasses)
  const expande = S.dim === 'classe';
  const dicaExp = $('#dica-expandir');
  if (dicaExp) dicaExp.hidden = !expande;
  const itens: any[] = [];
  for (const [k, v] of ordenadoDesc(somarPor(P, dimDe))) {
    const aberta = expande && S.abertas.has(k);
    itens.push({
      rot: k,
      v: v / (total || 1),
      texto: pct(v / (total || 1)),
      tip: `${k}\n${brl(v)}\n${pct(v / (total || 1))} da carteira`,
      acao: expande ? 'abrir:' + k : null,
      seta: expande ? (aberta ? '▾' : '▸') : undefined
    });
    if (aberta) {
      const doGrupo = P.filter(p => p.classe === k);
      for (const [s, vs] of ordenadoDesc(somarPor(doGrupo, p => p.subclasse))) {
        itens.push({
          rot: s,
          v: vs / (total || 1),
          texto: pct(vs / (total || 1)),
          sub: true,
          tip: `${k} › ${s}\n${brl(vs)}\n${pct(vs / (total || 1))} da carteira · ${pct(vs / (v || 1))} da classe`
        });
      }
    }
  }
  const barAloc = $('#bar-alocacao');
  if (barAloc) barAloc.innerHTML = barras(itens);

  renderRaioX(contas, total);

  // Maiores ativos
  const top = ordenadoDesc(somarPor(investimentos(), p => p.nomeAtivo || '')).slice(0, S.topN);
  const barTop = $('#bar-top');
  if (barTop) {
    barTop.innerHTML = barras(
      top.map(([k, v]) => ({
        rot: k,
        v: v / (total || 1),
        texto: pct(v / (total || 1), 2),
        tip: `${k}\n${brl(v)}\n${pct(v / (total || 1), 2)} da carteira`,
        acao: 'ativo:' + k
      }))
    );
  }

  // Tabela de todos os ativos
  const porAtivo = new Map<string, any>();
  for (const p of P) {
    const nomeAtivo = p.nomeAtivo || 'Sem nome';
    let a = porAtivo.get(nomeAtivo);
    if (!a) {
      porAtivo.set(
        nomeAtivo,
        (a = {
          ativo: nomeAtivo,
          classe: p.classe,
          subclasse: p.subclasse,
          estrategia: p.estrategia,
          emissor: p.emissor,
          contas: new Set(),
          valor: 0
        })
      );
    }
    a.contas.add(p.clienteId);
    a.valor += valor(p);
  }
  let linhas = [...porAtivo.values()].map(a => ({ ...a, nContas: a.contas.size, pct: a.valor / (total || 1) }));
  if (S.busca) {
    const b = norm(S.busca);
    linhas = linhas.filter(a => [a.ativo, a.classe, a.subclasse, a.estrategia, a.emissor].some(x => norm(x).includes(b)));
  }
  const tabAtivos = $('#tab-ativos');
  if (tabAtivos) {
    tabAtivos.innerHTML = tabela(
      'ativos',
      [
        { k: 'ativo', rot: 'Ativo', cls: 'quebra' },
        { k: 'classe', rot: 'Classe' },
        { k: 'subclasse', rot: 'Subclasse' },
        { k: 'nContas', rot: 'Clientes', n: true },
        { k: 'valor', rot: 'Valor', n: true, fmt: brlCurto },
        { k: 'pct', rot: '% carteira', n: true, fmt: v => pct(v, 2) }
      ],
      linhas,
      { attr: a => `data-ir-ativo="${esc(a.ativo)}"`, padrao: { k: 'valor', dir: -1 } }
    );
  }
}

export function renderMapa(_contas: Map<string, any>, total: number) {
  const M = S.mapa;
  const classes = ordenadoDesc(somarPor(S.posicoes, p => p.classe)).map(([k]) => k);
  const sel = $('#mapa-filtro') as HTMLSelectElement | null;
  if (sel) {
    sel.innerHTML = `<option value="">Todas as classes</option>` + classes.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    sel.value = M.filtro;
  }
  document.querySelectorAll('#mapa-cols button').forEach(b => b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.v === M.cols)));
  document.querySelectorAll('#mapa-metrica button').forEach(b => b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.v === M.metrica)));

  const P = M.filtro ? S.posicoes.filter(p => p.classe === M.filtro) : S.posicoes;
  const chave = CHAVE[M.cols] || (p => p.classe);
  let colunas = ordenadoDesc(somarPor(P, chave));
  const LIMITE = 30,
    cortadas = Math.max(0, colunas.length - LIMITE);
  colunas = colunas.slice(0, LIMITE);

  const nivel = (M as any).linhas || 'cliente';
  document.querySelectorAll('#mapa-linhas button').forEach(b => b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.v === (M as any).linhas)));
  const cel = new Map<string, Map<string, number>>();
  for (const p of P) {
    const u = unidadeDe(p.conta, nivel);
    let m = cel.get(u);
    if (!m) cel.set(u, (m = new Map()));
    const k = chave(p);
    m.set(k, somaPrecisa(m.get(k), valor(p)));
  }
  const emPct = M.metrica === 'pctConta';
  let linhas = [...unidades(nivel).values()].map(u => {
    const m = cel.get(u.key) || new Map();
    const r: any = { u, nome: u.nome, pl: u.pl, tot: 0 };
    for (const [k] of colunas) {
      const v = m.get(k) || 0;
      r['c:' + k] = emPct ? v / (u.pl || 1) : v;
    }
    const tot = somaLista([...m.values()]);
    r.tot = emPct ? tot / (u.pl || 1) : tot;
    return r;
  });
  if (M.busca) {
    const b = norm(M.busca);
    linhas = linhas.filter(l => l.u.contas.some((c: string) => norm(c).includes(b)) || norm(l.nome).includes(b) || norm(l.u.sub).includes(b));
  }
  const { o, ord } = ordenar('mapa', linhas, { k: 'pl', dir: -1 });

  let max = 0;
  for (const l of ord) for (const [k] of colunas) max = Math.max(max, l['c:' + k] || 0);
  const maxEl = $('#escala-max');
  if (maxEl) maxEl.textContent = emPct ? pct(max) : brlCurto(max);
  const minEl = $('#escala-min');
  if (minEl) minEl.textContent = emPct ? '0%' : 'R$ 0';
  const f = (v: number) => (v > 0 ? (emPct ? pct(v) : brlCurto(v)) : '–');

  const temTotal = Boolean(M.filtro);
  const cab = `<tr>
    <th data-tab="mapa" data-k="nome">${nivel === 'familia' ? 'Cliente / família' : 'Cliente'}${setaOrdem(o, 'nome')}</th>
    <th class="n" data-tab="mapa" data-k="pl">Patrimônio${setaOrdem(o, 'pl')}</th>
    ${temTotal ? `<th class="n" data-tab="mapa" data-k="tot">Total ${esc(M.filtro)}${setaOrdem(o, 'tot')}</th>` : ''}
    ${colunas
      .map(
        ([k]) =>
          `<th class="n col-h" data-tab="mapa" data-k="${esc('c:' + k)}" title="${esc(
            k
          )} · clique para ordenar">${esc(k)}${setaOrdem(o, 'c:' + k)}${
            M.cols === 'ativo' ? ` <button class="ir" data-acao="ativo:${esc(k)}" title="Abrir este ativo na alocação">↗</button>` : ''
          }</th>`
      )
      .join('')}
  </tr>`;

  const totP = somar(P);
  const media = `<tr class="media"><td>Média da carteira</td><td class="n">${brlCurto(total)}</td>
    ${temTotal ? `<td class="n">${emPct ? pct(totP / (total || 1)) : brlCurto(totP)}</td>` : ''}
    ${colunas.map(([, v]) => `<td class="n">${emPct ? pct(v / (total || 1)) : brlCurto(v)}</td>`).join('')}</tr>`;
  const corpo = ord
    .map(
      l => `<tr ${attrUnidade(l.u)}>
    <td>${celUnidade(l.u)}</td>
    <td class="n">${brlCurto(l.pl)}</td>
    ${temTotal ? `<td class="n"><b>${f(l.tot)}</b></td>` : ''}
    ${colunas
      .map(([k]) => {
        const v = l['c:' + k] || 0;
        return `<td class="heat" style="${calor(max ? v / max : 0)}" data-tip="${esc(
          `${l.nome} · ${l.u.sub}\n${k}\n${emPct ? pct(v, 2) + ' do patrimônio' : brl(v)}`
        )}">${f(v)}</td>`;
      })
      .join('')}
  </tr>`
    )
    .join('');
  const mapaEl = $('#mapa');
  if (mapaEl) {
    mapaEl.innerHTML = `<div class="tabela-wrap mapa-wrap"><table class="mapa"><thead>${cab}</thead><tbody>${media}${corpo}</tbody></table></div>`;
  }
  const notaEl = $('#mapa-nota');
  if (notaEl) {
    notaEl.textContent = cortadas ? `Mostrando as ${LIMITE} maiores colunas (${cortadas} menores ocultas). Use "Dentro da classe" para detalhar.` : '';
  }
}

export function renderRaioX(_contas: Map<string, any>, total: number) {
  const classes = ordenadoDesc(somarPor(S.posicoes, p => p.classe));
  if (!classes.some(([k]) => k === S.raioX)) S.raioX = classes[0]?.[0] || '';
  const selRaioX = $('#sel-raiox') as HTMLSelectElement | null;
  if (selRaioX) {
    selRaioX.innerHTML = classes.map(([k, v]) => `<option value="${esc(k)}">${esc(k)} — ${esc(pct(v / (total || 1)))}</option>`).join('');
    selRaioX.value = S.raioX;
  }

  const P = S.posicoes.filter(p => p.classe === S.raioX);
  const vClasse = somar(P);
  const porAtivo = ordenadoDesc(somarPor(P, p => p.nomeAtivo || ''));
  const contasPorAtivo = new Map<string, Set<string>>();
  for (const p of P) {
    const nomeAtivo = p.nomeAtivo || 'Sem nome';
    if (!contasPorAtivo.has(nomeAtivo)) contasPorAtivo.set(nomeAtivo, new Set());
    contasPorAtivo.get(nomeAtivo)!.add(p.clienteId!);
  }
  const top1 = porAtivo[0]?.[1] || 0,
    top5 = somaLista(porAtivo.slice(0, 5), ([, v]) => v);
  const kpiRaioX = $('#kpi-raiox');
  if (kpiRaioX) {
    kpiRaioX.innerHTML =
      kpi('Na classe', brlCurto(vClasse), `${pct(vClasse / (total || 1))} da carteira`, brl(vClasse)) +
      kpi('Ativos', inteiro(porAtivo.length), `em ${inteiro(new Set(P.map(p => p.clienteId)).size)} clientes`) +
      kpi('Maior ativo', pct(top1 / (vClasse || 1)), 'da classe') +
      kpi('5 maiores', pct(top5 / (vClasse || 1)), 'da classe');
  }
  const barRaioX = $('#bar-raiox');
  if (barRaioX) {
    barRaioX.innerHTML =
      barras(
        porAtivo.slice(0, 20).map(([k, v]) => ({
          rot: k,
          v: v / (vClasse || 1),
          texto: pct(v / (vClasse || 1)),
          acao: 'ativo:' + k,
          tip: `${k}\n${brl(v)}\n${pct(v / (vClasse || 1))} da classe · ${pct(v / (total || 1), 2)} da carteira\n${
            contasPorAtivo.get(k)?.size || 0
          } cliente(s)`
        }))
      ) + (porAtivo.length > 20 ? `<p class="nota">+ ${porAtivo.length - 20} ativos menores. Veja todos no mapa.</p>` : '');
  }
}
