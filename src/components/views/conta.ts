import { $ } from '../dom';
import { esc, norm, brl, brlCurto, inteiro, pct, num, chaveConta, nomeRepetido, rotuloContas } from '../formatters';
import { somaLista, somaPrecisa } from '../../domain/precision';
import { S } from '../../domain/state';
import {
  unidades,
  contasResumo,
  somar,
  somaSe,
  somarPor,
  ordenadoDesc,
  investimentos,
  dimDe,
  DIMS,
  clienteDaConta,
  descContas
} from '../../domain/calculations';
import {
  selecao,
  contasSel,
  contaMov,
  posSel,
  posicoesSimuladas,
  catalogoAtivos,
  infoForm,
  calcularMov
} from '../../domain/simulator';
import { kpi } from '../kpi';
import { calor } from '../charts';
import { tabela } from '../dom';
import { renderDiag } from './diagnostico';
import type { Posicao } from '../../types';

export function opcoesSelecao() {
  const clientes = [...unidades('cliente').values()].sort((a, b) => b.pl - a.pl);
  const familias = [...unidades('familia').values()].filter(u => u.tipo === 'familia').sort((a, b) => b.pl - a.pl);
  let f = familias,
    c = clientes,
    info = '';
  if (S.buscaConta.trim()) {
    const b = norm(S.buscaConta);
    const bate = (u: any) => norm(u.nome).includes(b) || norm(u.sub).includes(b) || u.contas.some((ct: string) => ct.endsWith(b));
    c = clientes.filter(bate);
    f = familias.filter(bate);
    if (c.length || f.length) info = `${c.length} cliente(s)${f.length ? ` e ${f.length} família(s)` : ''} encontrado(s)`;
    else {
      info = 'Nada encontrado';
      f = familias;
      c = clientes;
    }
  }
  return { familias: f, clientes: c, info };
}

export function renderExtratosCliente(cts: string[]) {
  const box = $('#extratos-cliente');
  if (!box) return;
  const chaves = new Set(cts.map(chaveConta));
  const fs = [...S.fontes.values()].filter(
    f => f.id !== 'EXEMPLO' && f.registros.some(r => chaves.has(chaveConta(r.conta)))
  );
  box.hidden = !fs.length;
  if (!fs.length) return;
  const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '–');
  const linhas = fs
    .map(f => {
      const regs = f.registros.filter(r => chaves.has(chaveConta(r.conta)));
      const contasF = [...new Set(regs.map(r => r.conta))];
      const val = somaLista(regs, (r: any) => Number((r as any)[S.campoValor]) || 0);
      const ehMacro = f.id === 'BTG';
      return `<tr><td><b>${esc(ehMacro ? 'BTG · planilha diária' : f.inst)}</b></td><td>${esc(
        contasF.join(', ')
      )}</td><td class="sec">${esc(f.arquivo || '–')}</td>
      <td>${esc(f.dataRef || '–')}</td><td>${quando(f.enviadoEm)}</td><td class="n">${brl(val)}</td>
      <td class="n" style="white-space:nowrap">${
        ehMacro
          ? ''
          : `<button class="btn-link" data-acao="addextrato" title="Anexe o extrato novo: ele substitui este (mesma instituição e conta)">Substituir</button> · <button class="btn-link" data-acao="rmfonte:${esc(
              f.id
            )}">Remover</button>`
      }</td></tr>`;
    })
    .join('');

  box.innerHTML = `<div class="cartao-topo" style="margin-bottom:8px"><div><h2>Extratos ativos deste cliente</h2><p>De onde vem cada parte da carteira. Para trocar um extrato (ex.: Safra de agosto pelo de setembro), clique em Substituir e anexe o novo.</p></div></div>
    <div class="tabela-wrap" style="max-height:none"><table><thead><tr><th>Instituição</th><th>Conta</th><th>Arquivo</th><th>Posição de</th><th>Carregado em</th><th class="n">Valor</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div>`;
}

export function renderMembrosFamilia(s: any, _resumo: Map<string, any>) {
  const cartao = $('#cartao-grupo');
  if (cartao) cartao.hidden = s.tipo !== 'familia';
  if (s.tipo !== 'familia') return;

  const P = S.posicoes.filter(p => s.contas.includes(p.conta));
  const plF = somar(P);
  const dims = ordenadoDesc(somarPor(P, dimDe)).map(([k]) => k);
  const linhas = s.familia.clientes.map((id: string) => {
    const c = S.clientes.get(id)!,
      Pc = P.filter(p => c.contas.includes(p.conta));
    const pl = somar(Pc);
    const r: any = {
      key: id,
      nome: c.nome,
      contas: descContas(c),
      pl,
      pFam: pl / (plF || 1),
      caixa: somaSe(Pc, p => p.caixa)
    };
    const m = somarPor(Pc, dimDe);
    for (const d of dims) r['d:' + d] = (m.get(d) || 0) / (pl || 1);
    return r;
  });

  const tot: any = {
    nome: 'Família (total)',
    contas: `${s.contas.length} contas`,
    pl: plF,
    pFam: 1,
    caixa: somaSe(P, p => p.caixa)
  };
  const mt = somarPor(P, dimDe);
  for (const d of dims) tot['d:' + d] = (mt.get(d) || 0) / (plF || 1);

  const cols = [
    { k: 'nome', rot: 'Cliente' },
    { k: 'contas', rot: 'Contas' },
    { k: 'pl', rot: 'Patrimônio', n: true, fmt: brlCurto },
    { k: 'pFam', rot: '% da família', n: true, fmt: (v: number) => pct(v) },
    { k: 'caixa', rot: 'Caixa', n: true, fmt: brlCurto }
  ].concat(
    dims.map(d => ({
      k: 'd:' + d,
      rot: d,
      n: true,
      fmt: (v: number) => (v > 0 ? pct(v) : '–'),
      estilo: (v: number) => calor(v),
      cls: 'heat'
    }))
  );

  const tabGrupo = $('#tab-grupo');
  if (tabGrupo) {
    tabGrupo.innerHTML = tabela('familia', cols, linhas, {
      attr: l => `data-ir-unidade="${esc(l.key)}"`,
      padrao: { k: 'pl', dir: -1 }
    }).replace(
      '</tbody>',
      `<tr class="grupo">${cols
        .map(c => {
          const v = tot[c.k];
          return `<td class="${c.n ? 'n' : ''}">${v === undefined ? '' : esc(c.fmt ? c.fmt(v) : v)}</td>`;
        })
        .join('')}</tr></tbody>`
    );
  }
}

export function renderSimForm(Pa: Posicao[]) {
  const cat = catalogoAtivos();
  const plA = somar(Pa);
  const naConta = ordenadoDesc(somarPor(Pa.filter(p => !p.caixa && !p.transito), p => p.nomeAtivo || ''));
  const temNaConta = new Set(naConta.map(([k]) => k));
  const outros = [...cat.values()].filter(a => !temNaConta.has(a.ativo));
  const classesOutros = ordenadoDesc(somarPor(investimentos(), p => p.classe)).map(([k]) => k);
  const valorBase = somarPor(investimentos(), p => p.nomeAtivo || '');
  const resgate = S.fm.acao === 'resgatar';

  let html = naConta.length
    ? `<optgroup label="Na carteira do cliente">` +
      naConta
        .map(
          ([k, v]) =>
            `<option value="${esc(k)}">${esc(k)} — ${brlCurto(v)} (${pct(v / (plA || 1))})</option>`
        )
        .join('') +
      '</optgroup>'
    : '';

  if (!resgate) {
    for (const cl of classesOutros) {
      const doGrupo = outros
        .filter(a => a.classe === cl)
        .sort((a, b) => (valorBase.get(b.ativo) || 0) - (valorBase.get(a.ativo) || 0));
      if (doGrupo.length) {
        html +=
          `<optgroup label="Outros ativos da base · ${esc(cl)}">` +
          doGrupo.map(a => `<option value="${esc(a.ativo)}">${esc(a.ativo)}</option>`).join('') +
          '</optgroup>';
      }
    }
    html += `<optgroup label="Fora da base"><option value="__novo__">+ Ativo novo (digitar)…</option></optgroup>`;
  }

  const sel = $('#sim-ativo') as HTMLSelectElement | null;
  if (sel) {
    sel.innerHTML = html;
    const valido = (a: string) => (a === '__novo__' ? !resgate : resgate ? temNaConta.has(a) : cat.has(a));
    if (!S.fm.ativo || !valido(S.fm.ativo)) S.fm.ativo = naConta[0]?.[0] || [...cat.keys()][0] || '__novo__';
    sel.value = S.fm.ativo;
  }

  const novo = S.fm.ativo === '__novo__';
  const novoEl = $('#sim-novo');
  if (novoEl) novoEl.hidden = !novo;
  if (novo) {
    const classes = [...new Set(investimentos().map(p => p.classe))];
    if (!S.fm.novo.classe) S.fm.novo.classe = classes[0] || '';
    const selClasse = $('#sim-novo-classe') as HTMLSelectElement | null;
    if (selClasse) {
      selClasse.innerHTML = classes.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
      selClasse.value = S.fm.novo.classe;
    }
    const listaSub = $('#lista-subclasses');
    if (listaSub) {
      listaSub.innerHTML = [
        ...new Set(investimentos().filter(p => p.classe === S.fm.novo.classe).map(p => p.subclasse))
      ]
        .map(s => `<option value="${esc(s)}">`)
        .join('');
    }
    const estrs = [...new Set(S.posicoes.map(p => p.estrategia))].filter(
      e => !['Caixa', 'Valor em Trânsito'].includes(e)
    );
    if (!S.fm.novo.estrategia) S.fm.novo.estrategia = estrs[0] || '';
    const selEstr = $('#sim-novo-estr') as HTMLSelectElement | null;
    if (selEstr) {
      selEstr.innerHTML = estrs.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('');
      selEstr.value = S.fm.novo.estrategia;
    }
  }

  document.querySelectorAll('#sim-acao button').forEach(b =>
    b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.v === S.fm.acao))
  );
  const acaoDesc = $('#sim-acao-d');
  if (acaoDesc) {
    acaoDesc.textContent =
      ({
        aplicar: 'Colocar dinheiro num ativo.',
        resgatar: 'Tirar dinheiro de um ativo que o cliente já tem.',
        alvo: 'Diga o % que você quer e o painel calcula quanto aplicar ou resgatar.'
      } as any)[S.fm.acao] || '';
  }

  const info = infoForm();
  const alvo = S.fm.acao === 'alvo';
  const nivelEl = $('#campo-sim-nivel');
  if (nivelEl) nivelEl.hidden = !alvo;
  if (info && info.subclasse === info.classe && S.fm.nivel === 'subclasse') S.fm.nivel = 'classe';
  const rotNivel: Record<string, string> = {
    ativo: `de ${info?.ativo || 'ativo'}`,
    subclasse: `de ${info?.subclasse || 'subclasse'}`,
    classe: `de ${info?.classe || 'classe'}`
  };
  document.querySelectorAll('#sim-nivel button').forEach(b => {
    const el = b as HTMLElement;
    el.textContent = rotNivel[el.dataset.v || ''] || '';
    el.setAttribute('aria-pressed', String(el.dataset.v === S.fm.nivel));
    el.hidden = el.dataset.v === 'subclasse' && Boolean(info && info.subclasse === info.classe);
  });

  const rotValor = $('#sim-valor-rot');
  if (rotValor) rotValor.textContent = alvo ? 'Qual % você quer na carteira?' : resgate ? 'Quanto resgatar?' : 'Quanto aplicar?';
  const unEl = $('#sim-un');
  if (unEl) unEl.textContent = alvo ? '%' : 'R$';
  const valInp = $('#sim-valor') as HTMLInputElement | null;
  if (valInp) {
    valInp.placeholder = alvo ? 'ex.: 8' : 'ex.: 50000';
    if (valInp.value !== String(S.fm.valor ?? '')) valInp.value = String(S.fm.valor ?? '');
  }

  const P = posSel(),
    pl = somar(P);
  let hoje = '';
  if (info) {
    const f = alvo
      ? ({
          ativo: (p: Posicao) => p.nomeAtivo === info.ativo,
          subclasse: (p: Posicao) => p.classe === info.classe && p.subclasse === info.subclasse,
          classe: (p: Posicao) => p.classe === info.classe
        } as any)[S.fm.nivel]
      : (p: Posicao) => p.nomeAtivo === info.ativo;
    const v = somaSe(P, f),
      quem = alvo ? rotNivel[S.fm.nivel].replace(/^de /, '') : info.ativo;
    hoje = v
      ? `Hoje: ${esc(quem)} = ${brl(v)} (${pct(v / (pl || 1), 2)} da carteira).`
      : `Hoje o cliente não tem ${esc(quem)}.`;
    if (resgate && v) hoje += ` <button type="button" class="btn-link" id="sim-tudo">Resgatar tudo</button>`;
  }
  const hojeEl = $('#sim-hoje');
  if (hojeEl) hojeEl.innerHTML = hoje;

  const bt = $('#sim-tudo');
  if (bt) {
    bt.onclick = () => {
      const v = somaSe(P, p => p.nomeAtivo === info?.ativo);
      S.fm.valor = String(Math.round(v * 100) / 100);
      if (valInp) valInp.value = S.fm.valor;
      renderSimPreview();
    };
  }

  const resumo = contasResumo(),
    ct = contaMov(),
    cx = resumo.get(ct)?.caixa || 0;
  const origT = $('#sim-origem-t');
  if (origT) origT.textContent = resgate ? 'Para onde vai o dinheiro?' : alvo ? 'Como o dinheiro entra ou sai?' : 'De onde sai o dinheiro?';
  const rotOrig: Record<string, string> = resgate
    ? { caixa: 'Fica no caixa da conta', aporte: 'Sai da conta (saque)' }
    : { caixa: 'Do caixa da conta', aporte: 'Aporte novo' };
  document.querySelectorAll('#sim-origem button').forEach(b => {
    const el = b as HTMLElement;
    el.textContent = rotOrig[el.dataset.v || ''] || '';
    el.setAttribute('aria-pressed', String(el.dataset.v === S.fm.origem));
  });

  const origD = $('#sim-origem-d');
  if (origD) {
    origD.textContent =
      S.fm.origem === 'caixa'
        ? `Caixa disponível${contasSel().length > 1 ? ' nesta conta' : ''}: ${brl(cx)}. O patrimônio total não muda.`
        : resgate
        ? 'O valor deixa a carteira: o patrimônio diminui.'
        : 'Dinheiro novo entrando: o patrimônio aumenta.';
  }

  const cts = contasSel();
  const ctaCampo = $('#campo-sim-conta');
  if (ctaCampo) ctaCampo.hidden = cts.length < 2;
  const ctaSel = $('#sim-conta') as HTMLSelectElement | null;
  if (ctaSel && cts.length > 1) {
    ctaSel.innerHTML = cts
      .map(
        c =>
          `<option value="${esc(c)}">${esc(c)} · ${esc(clienteDaConta(c)?.nome || '')} — caixa ${esc(
            brlCurto(resumo.get(c)?.caixa || 0)
          )}</option>`
      )
      .join('');
    ctaSel.value = ct;
  }
}

export function renderSimPreview() {
  const box = $('#sim-preview');
  if (!box) return;
  const mov = calcularMov();
  const btn = $('#sim-add') as HTMLButtonElement | null;
  if (!mov) {
    box.innerHTML = `<p class="sim-vazio">Siga os passos ao lado: escolha o que fazer, o ativo e ${
      S.fm.acao === 'alvo' ? 'o % que você quer' : 'o valor'
    }. O efeito na carteira aparece aqui antes de você adicionar.</p>`;
    if (btn) btn.disabled = true;
    return;
  }
  const ct = contaMov();
  const P0 = posSel(),
    P1 = posSel({ conta: ct, mov });
  const pl0 = somar(P0),
    pl1 = somar(P1);
  if (Math.abs(mov.v) < 0.01) {
    box.innerHTML = `<p class="sim-frase"><b>${esc(mov.ativo)}</b> já está nesse %. Nenhum movimento é necessário.</p>`;
    if (btn) btn.disabled = true;
    return;
  }

  const efeitos: [string, (p: Posicao) => boolean][] = [[mov.ativo, p => p.nomeAtivo === mov.ativo]];
  if (mov.subclasse !== mov.classe) {
    efeitos.push([mov.subclasse, p => p.classe === mov.classe && p.subclasse === mov.subclasse]);
  }
  efeitos.push([mov.classe, p => p.classe === mov.classe]);
  if (S.dim === 'estrategia') efeitos.push([mov.estrategia, p => p.estrategia === mov.estrategia]);
  efeitos.push(['Caixa', p => p.caixa]);

  const Pc1 = posicoesSimuladas(ct, [mov]);
  const cx1 = somaSe(Pc1, p => p.caixa),
    pos1 = somaSe(Pc1, p => p.nomeAtivo === mov.ativo);

  const destino =
    mov.origem === 'caixa'
      ? mov.v > 0
        ? 'usando o caixa da conta'
        : 'e o dinheiro fica no caixa'
      : mov.v > 0
      ? 'com um aporte novo'
      : 'e o dinheiro sai da conta';

  let html = `<p class="sim-frase">${mov.v > 0 ? 'Aplicar' : 'Resgatar'} <b>${brl(Math.abs(mov.v))}</b> ${
    mov.v > 0 ? 'em' : 'de'
  } <b>${esc(mov.ativo)}</b> ${destino}${contasSel().length > 1 ? ` (conta ${esc(ct)})` : ''}.</p>`;

  const linhas = efeitos.map(([rot, f]) => [rot, somaSe(P0, f) / (pl0 || 1), somaSe(P1, f) / (pl1 || 1)] as [string, number, number]);
  const max = Math.max(...linhas.flatMap(l => [l[1], l[2]]), 0.0001);
  html += `<div class="sim-ef">${linhas
    .map(
      ([rot, a, d]) => `<span class="nm" title="${esc(rot)}">${esc(rot)}</span>
    <span class="trilho"><i class="antes" style="width:${((Math.max(0, a) / max) * 100).toFixed(
      1
    )}%"></i><i class="depois" style="width:${((Math.max(0, d) / max) * 100).toFixed(1)}%"></i></span>
    <span class="vals">${pct(a, 2)} → <b>${pct(d, 2)}</b></span>`
    )
    .join('')}</div>`;

  html += `<div class="sim-leg"><span><i style="background:#7FA6D3"></i>Hoje</span><span><i style="background:#0A1F44"></i>Depois do movimento</span>${
    Math.abs(pl1 - pl0) > 0.5 ? `<span>Patrimônio: ${brlCurto(pl0)} → <b>${brlCurto(pl1)}</b></span>` : ''
  }</div>`;

  if (mov.origem === 'caixa' && cx1 < -0.5) {
    html += `<div class="alerta-txt">O caixa não é suficiente: faltam ${brl(-cx1)}. Escolha "Aporte novo" ou simule antes um resgate.</div>`;
  }
  if (pos1 < -0.5) {
    html += `<div class="alerta-txt">O resgate é maior que a posição atual em ${esc(mov.ativo)}.</div>`;
  }
  box.innerHTML = html;
  if (btn) btn.disabled = false;
}

export function renderMovs(movs: any[]) {
  const limparBtn = $('#sim-limpar');
  if (limparBtn) limparBtn.hidden = !movs.length;
  const box = $('#sim-movs');
  if (!box) return;
  if (!movs.length) {
    box.innerHTML = '';
    return;
  }
  const aplic = somaLista(movs.filter(m => m.v > 0), m => m.v),
    resg = somaLista(movs.filter(m => m.v < 0), m => -m.v);
  const g = contasSel().length > 1;
  box.innerHTML =
    `<div class="bloco-sim"><div class="box-k">Movimentos da simulação</div><div class="tabela-wrap" style="max-height:none"><table><thead><tr>
      <th>Ativo</th>${g ? '<th>Conta</th>' : ''}<th>Classe › Subclasse</th><th class="n">Movimento</th><th>Dinheiro</th><th></th></tr></thead><tbody>` +
    movs
      .map(
        m => `<tr><td>${esc(m.ativo)}${m.novo ? '<span class="tag">novo</span>' : ''}</td>${
          g ? `<td class="sec">${esc(m.conta)}</td>` : ''
        }<td class="sec">${esc(m.classe)} › ${esc(m.subclasse)}</td>
      <td class="n"><b>${m.v > 0 ? 'Aplicar' : 'Resgatar'} ${brl(Math.abs(m.v))}</b></td><td class="sec">${
          m.origem === 'caixa'
            ? m.v > 0
              ? 'do caixa'
              : 'fica no caixa'
            : m.v > 0
            ? 'aporte novo'
            : 'sai da conta'
        }</td>
      <td class="n"><button class="btn-x" data-acao="rmmov:${esc(m.conta)}|${
          m.i
        }" title="Remover movimento" aria-label="Remover movimento">×</button></td></tr>`
      )
      .join('') +
    `</tbody></table></div><p class="nota">Total aplicado: <b>${brl(aplic)}</b>${
      resg ? ` · resgatado: <b>${brl(resg)}</b>` : ''
    }.</p></div>`;
}

export function renderSimCarteira(Pa: Posicao[], Ps: Posicao[], temSim: boolean) {
  const box = $('#sim-carteira');
  if (!box) return;
  if (!temSim) {
    box.innerHTML = '';
    return;
  }
  const plA = somar(Pa),
    plS = somar(Ps);
  const A = somarPor(Pa, dimDe),
    Sm = somarPor(Ps, dimDe);
  const expande = S.dim === 'classe';
  const ordem = (a: Map<string, number>, s: Map<string, number>) => (x: string, y: string) =>
    (s.get(y) || 0) - (s.get(x) || 0) || (a.get(y) || 0) - (a.get(x) || 0);
  const linhas: any[] = [];
  for (const k of [...new Set([...A.keys(), ...Sm.keys()])].sort(ordem(A, Sm))) {
    linhas.push({ k, a: (A.get(k) || 0) / (plA || 1), s: (Sm.get(k) || 0) / (plS || 1), nivel: 0 });
    if (expande && S.abertas.has(k)) {
      const f = (p: Posicao) => p.classe === k;
      const a2 = somarPor(Pa.filter(f), p => p.subclasse),
        s2 = somarPor(Ps.filter(f), p => p.subclasse);
      for (const s of [...new Set([...a2.keys(), ...s2.keys()])].sort(ordem(a2, s2))) {
        linhas.push({ k: s, pai: k, a: (a2.get(s) || 0) / (plA || 1), s: (s2.get(s) || 0) / (plS || 1), nivel: 1 });
      }
    }
  }
  const max = Math.max(...linhas.map(l => Math.max(l.a, l.s)), 0.0001) * 1.05;
  const w = (v: number) => ((Math.max(0, v) / max) * 100).toFixed(2) + '%';
  const delta = (d: number) =>
    Math.abs(d) < 0.0005 ? '<span class="muted">sem mudança</span>' : `${d > 0 ? '▲ +' : '▼ '}${num(d * 100, 2)} p.p.`;
  const corpo = linhas
    .map(l => {
      const topo = !l.nivel && expande;
      return `<tr class="${l.nivel ? 'sub-comp' : ''}"${topo ? ` data-acao="abrir:${esc(l.k)}"` : ''}>
      <td>${topo ? `<span class="seta">${S.abertas.has(l.k) ? '▾' : '▸'}</span>` : ''}${esc(l.k)}</td>
      <td class="barcol"><div class="comp-trilho sim">${
        l.a > 0 ? `<div class="barra atual" style="width:${w(l.a)}"></div>` : ''
      }${l.s > 0 ? `<div class="barra depois" style="width:${w(l.s)}"></div>` : ''}</div></td>
      <td class="n">${l.a > 0 ? pct(l.a, 2) : '–'}</td><td class="n"><b>${l.s > 0 ? pct(l.s, 2) : '–'}</b></td><td class="n delta">${delta(
        l.s - l.a
      )}</td>
    </tr>`;
    })
    .join('');

  box.innerHTML = `<div class="bloco-sim"><div class="box-k">Como fica a carteira, por ${esc(
    DIMS[S.dim].toLowerCase()
  )}</div>
    <div class="sim-leg" style="margin-bottom:8px"><span><i style="background:#7FA6D3"></i>Hoje</span><span><i style="background:#1F4E87"></i>Com a simulação</span>${
      expande ? '<span>Clique numa classe para abrir as subclasses.</span>' : ''
    }</div>
    <div class="tabela-wrap comp-wrap"><table class="comp"><thead><tr><th>${esc(
      DIMS[S.dim]
    )}</th><th class="barcol"></th><th class="n">Hoje</th><th class="n">Com a simulação</th><th class="n">Mudança</th></tr></thead><tbody>${corpo}</tbody></table></div></div>`;
}

export function renderConta() {
  const { familias, clientes, info } = opcoesSelecao();
  const infoEl = $('#busca-conta-info');
  if (infoEl) infoEl.textContent = info;
  if (![...familias, ...clientes].some(u => u.key === S.sel)) {
    S.sel = (clientes[0] || familias[0])?.key || '';
  }
  const sel = $('#sel-conta') as HTMLSelectElement | null;
  if (sel) {
    sel.innerHTML =
      (familias.length
        ? `<optgroup label="Famílias (consolidado)">` +
          familias
            .map(
              u =>
                `<option value="${esc(u.key)}">${esc(u.nome)} · ${esc(
                  u.sub.replace('família · ', '')
                )} — ${esc(brlCurto(u.pl))}</option>`
            )
            .join('') +
          '</optgroup>'
        : '') +
      `<optgroup label="Clientes">` +
      clientes
        .map(
          u =>
            `<option value="${esc(u.key)}">${esc(u.nome)}${
              nomeRepetido(u.nome, clientes) ? ` · ${esc(rotuloContas(u.contas))}` : u.contas.length > 1 ? ` (${u.contas.length} contas)` : ''
            } — ${esc(brlCurto(u.pl))}</option>`
        )
        .join('') +
      '</optgroup>';
    sel.value = S.sel;
  }

  const s = selecao();
  if (!s) return;
  const resumo = contasResumo();
  const cts = contasSel();
  const pl = somaLista(cts, ct => resumo.get(ct)?.pl || 0);
  const caixa = somaLista(cts, ct => resumo.get(ct)?.caixa || 0);
  const Pa = S.posicoes.filter(p => cts.includes(p.conta));
  const Ps = posSel();
  const movs = cts.flatMap(ct => (S.movs.get(ct) || []).map((m, i) => ({ ...m, conta: ct, i })));
  const temSim = movs.length > 0;
  const total = somar(S.posicoes);
  const plS = somar(Ps),
    caixaS = somaSe(Ps, p => p.caixa);
  const maior = ordenadoDesc(somarPor(Pa, p => p.classe))[0];

  const fam = s.tipo === 'cliente' && (s as any).cliente?.familiaId ? S.familias.get((s as any).cliente.familiaId) : null;
  const quem =
    s.tipo === 'familia'
      ? kpi('Família', s.nome, `${(s as any).familia.clientes.length} clientes · ${s.contas.length} contas`)
      : kpi('Cliente', s.nome, descContas((s as any).cliente));

  const kpiConta = $('#kpi-conta');
  if (kpiConta) {
    kpiConta.innerHTML =
      quem +
      kpi(
        'Patrimônio',
        brlCurto(pl),
        temSim && Math.abs(plS - pl) > 0.5 ? `simulado: ${brlCurto(plS)}` : `${pct(pl / (total || 1))} da base`,
        brl(pl)
      ) +
      kpi(
        'Caixa (conta corrente)',
        brlCurto(caixa),
        temSim ? `simulado: ${brlCurto(caixaS)} (${pct(caixaS / (plS || 1))})` : `${pct(caixa / (pl || 1))} do patrimônio`,
        brl(caixa)
      ) +
      kpi('Maior classe', maior ? maior[0] : '–', maior ? `${pct(maior[1] / (pl || 1))} do patrimônio` : '') +
      kpi('Posições', inteiro(Pa.length), `${inteiro(new Set(Pa.map(p => p.classe)).size)} classes`);
  }

  const faixa = $('#faixa-grupo');
  const famTxt = (n: string) => (/^fam[ií]lia/i.test(n) ? esc(n) : 'família ' + esc(n));
  if (faixa) {
    if (s.tipo === 'familia') {
      faixa.innerHTML = `Você está vendo a <b>${famTxt(s.nome)}</b> somada (${
        (s as any).familia.clientes.length
      } clientes). A visão separada de cada cliente está logo abaixo.`;
    } else if (fam) {
      faixa.innerHTML = `${esc(s.nome)} faz parte da <b>${famTxt(
        fam.nome
      )}</b>. <button class="btn-link" data-acao="unidade:${esc(fam.id)}">Ver a família somada →</button>`;
    } else if (s.contas.length > 1) {
      faixa.innerHTML = `Visão consolidada das <b>${s.contas.length} contas</b> de ${esc(s.nome)}: ${esc(
        s.contas.join(', ')
      )}.`;
    }
    faixa.hidden = !(s.tipo === 'familia' || fam || s.contas.length > 1);
  }

  renderExtratosCliente(cts);
  renderMembrosFamilia(s, resumo);
  const cartaoGrupo = $('#cartao-grupo');
  if (cartaoGrupo) cartaoGrupo.hidden = true;
  renderDiag(s, Pa);
  renderSimForm(Pa);
  renderSimPreview();
  renderMovs(movs);
  renderSimCarteira(Pa, Ps, temSim);
}
