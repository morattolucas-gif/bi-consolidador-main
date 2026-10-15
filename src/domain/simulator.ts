import { S } from './state';
import { Posicao, MovimentoSimulado } from '../types';
import { somar, somaSe, investimentos, unidades, contasResumo } from './calculations';
import { multPrecisa, subPrecisa, divPrecisa, somaPrecisa, somaLista, arredondarFinanceiro } from './precision';
import { norm } from '../components/formatters';

export function contasSel(): string[] {
  const f = S.familias.get(S.sel);
  if (f) return f.contas;
  const c = S.clientes.get(S.sel);
  if (c) return c.contas;
  return [];
}

export function selecao() {
  const f = S.familias.get(S.sel);
  if (f) return { tipo: 'familia', key: f.id, nome: f.nome, contas: f.contas, familia: f };
  const c = S.clientes.get(S.sel);
  if (c) return { tipo: 'cliente', key: c.id, nome: c.nome, contas: c.contas, cliente: c };
  return null;
}

export function contaMov(): string {
  const cts = contasSel();
  if (cts.length <= 1) return cts[0] || '';
  return cts.includes(S.fm.conta) ? S.fm.conta : cts[0];
}

export function catalogoAtivos(): Map<string, any> {
  const m = new Map<string, any>();
  for (const p of investimentos()) {
    if (p.nomeAtivo && !m.has(p.nomeAtivo)) {
      m.set(p.nomeAtivo, { ativo: p.nomeAtivo, classe: p.classe, subclasse: p.subclasse, estrategia: p.estrategia });
    }
  }
  return m;
}

export function posicoesSimuladas(conta: string, extras: MovimentoSimulado[] = []): Posicao[] {
  const base = S.posicoes.filter(p => p.conta === conta);
  const nome = base[0]?.nome || '';
  const cx = base.find(p => p.caixa) || S.posicoes.find(p => p.caixa) || {
    classe: 'Conta Corrente',
    subclasse: 'CC',
    estrategia: 'Caixa',
    nomeAtivo: 'Conta Corrente'
  };
  const linhas: Posicao[] = [];
  for (const m of (S.movs.get(conta) || []).concat(extras)) {
    linhas.push({
      conta,
      nome,
      classe: m.classe,
      subclasse: m.subclasse,
      estrategia: m.estrategia,
      nomeAtivo: m.ativo,
      bruto: m.v,
      liquido: m.v,
      sim: true,
      mov: m
    });
    if (m.origem === 'caixa') {
      linhas.push({
        conta,
        nome,
        classe: cx.classe,
        subclasse: cx.subclasse,
        estrategia: cx.estrategia,
        nomeAtivo: cx.nomeAtivo,
        bruto: -m.v,
        liquido: -m.v,
        sim: true,
        caixa: true,
        mov: m
      });
    }
  }
  return base.concat(linhas);
}

export function posSel(extra?: { conta: string; mov: MovimentoSimulado }): Posicao[] {
  const cts = contasSel();
  return cts.flatMap(ct => (extra && extra.conta === ct ? posicoesSimuladas(ct, [extra.mov]) : posicoesSimuladas(ct)));
}

export function infoForm() {
  if (S.fm.ativo === '__novo__') {
    const n = S.fm.novo;
    if (!n.nome.trim()) return null;
    return { ativo: n.nome.trim(), classe: n.classe || 'Outros', subclasse: n.subclasse.trim() || n.classe || 'Outros', estrategia: n.estrategia || 'Outros', novo: true };
  }
  return catalogoAtivos().get(S.fm.ativo) || null;
}

export function calcularMov(): MovimentoSimulado | null {
  const info = infoForm();
  let x = parseFloat(String(S.fm.valor).replace(',', '.'));
  if (!info || !isFinite(x)) return null;
  S.fm.modo = S.fm.acao === 'alvo' ? S.fm.nivel : 'valor';
  if (S.fm.acao === 'aplicar') x = Math.abs(x);
  if (S.fm.acao === 'resgatar') x = -Math.abs(x);
  let v = x;
  if (S.fm.modo !== 'valor') {
    const P = posSel();
    const pl = somar(P);
    const t = divPrecisa(x, 100);
    const filtro = {
      ativo: (p: Posicao) => p.nomeAtivo === info.ativo,
      subclasse: (p: Posicao) => p.classe === info.classe && p.subclasse === info.subclasse,
      classe: (p: Posicao) => p.classe === info.classe
    }[S.fm.modo as 'ativo' | 'subclasse' | 'classe'];
    const atual = somaSe(P, filtro);
    const tPl = multPrecisa(t, pl);
    v = S.fm.origem === 'aporte' ? divPrecisa(subPrecisa(tPl, atual), subPrecisa(1, t)) : subPrecisa(tPl, atual);
  }
  return { ...info, v: arredondarFinanceiro(v, 2), origem: S.fm.origem, conta: contaMov() };
}

export function infoAtivo() {
  const doAtivo = S.posicoes.filter(p => p.nomeAtivo === S.ativo);
  const p0 = doAtivo[0];
  return p0
    ? { nome: S.ativo, classe: p0.classe, subclasse: p0.subclasse, estrategia: p0.estrategia, existe: true, doAtivo }
    : { nome: S.ativo, classe: 'Novo', subclasse: 'Novo', estrategia: 'Novo', existe: false, doAtivo: [] };
}

export function simular() {
  const contas = unidades('cliente');
  const info = infoAtivo();
  const posAtual = new Map<string, number>();
  const sub = new Map<string, number>();
  const cla = new Map<string, number>();

  const soma = (m: Map<string, number>, p: Posicao) => {
    if (p.clienteId) m.set(p.clienteId, somaPrecisa(m.get(p.clienteId), (p as any)[S.campoValor]));
  };

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
      pCaixa: divPrecisa(c.caixa, c.pl),
      atual,
      pAtual: divPrecisa(atual, c.pl),
      pSub: divPrecisa(sub.get(c.key) || 0, c.pl),
      pClasse: divPrecisa(cla.get(c.key) || 0, c.pl),
      valorAlvo,
      aAlocar,
      pDepois: divPrecisa(somaPrecisa(atual, aAlocar), c.pl),
      sitTipo: sit[0],
      situacao: sit[1]
    };
  });

  if (S.publico === 'tem') linhas = linhas.filter(l => l.atual > 0);
  if (S.publico === 'naotem') linhas = linhas.filter(l => l.atual === 0);

  return { linhas, info, posAtual, contas };
}

export function posicaoAtivos(nomes: string[]) {
  const us = unidades('cliente');
  const totalBase = somar(S.posicoes);
  const ativos = nomes.map(nome => {
    const ps = S.posicoes.filter(p => p.nomeAtivo === nome);
    const porCli = new Map<string, number>();
    for (const p of ps) {
      if (p.clienteId) porCli.set(p.clienteId, somaPrecisa(porCli.get(p.clienteId), (p as any)[S.campoValor]));
    }
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
      media: divPrecisa(v, totalBase),
      nCli: porCli.size,
      pesoMedio: pesos.length ? divPrecisa(somaLista(pesos), pesos.length) : 0,
      maior: pesos.length ? Math.max(...pesos) : 0,
      maiorNome: clientes.length ? clientes.reduce((a, c) => (c.p > a.p ? c : a)).nome : ''
    };
  });

  const vSel = somaLista(ativos, x => x.v);
  const mediaSel = divPrecisa(vSel, totalBase);
  const linhas = [...us.values()]
    .map(u => {
      const l: any = { key: u.key, u, nome: u.nome, contasTxt: u.contas.join(', '), pl: u.pl, total: 0 };
      ativos.forEach((a, i) => {
        const v = a.porCli.get(u.key) || 0;
        l['v' + i] = v;
        l['p' + i] = divPrecisa(v, u.pl);
        l.total = somaPrecisa(l.total, v);
      });
      l.pTotal = divPrecisa(l.total, u.pl);
      l.dif = subPrecisa(l.pTotal, mediaSel);
      return l;
    })
    .filter(l => l.total > 0.005);

  return { ativos, linhas, vSel, mediaSel, totalBase, nClientes: us.size };
}
