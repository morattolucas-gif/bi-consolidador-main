import { S } from './state';
import { Posicao, Unidade, Cliente, Familia } from '../types';
import { somaPrecisa, somaLista } from './precision';
import { chaveConta, nomeProprio, norm, palavras, descContas as fmtDescContas } from '../components/formatters';

import { RISCO_CREDITO } from './constants';

export const DIMS: Record<string, string> = {
  classe: 'Classe',
  subclasse: 'Subclasse',
  estrategia: 'Estratégia',
  riscoCredito: 'Risco de Crédito',
  instituicao: 'Instituição'
};

export const CHAVE: Record<string, (p: Posicao) => any> = {
  classe: p => p.classe,
  subclasse: p => p.subclasse,
  estrategia: p => p.estrategia,
  riscoCredito: p => RISCO_CREDITO[p.riscoCredito || p.contraparte || ''] || p.riscoCredito || 'Outros',
  instituicao: p => p.instituicao,
  ativo: p => p.nomeAtivo
};

export const valor = (p: Posicao): number => (p as any)[S.campoValor] || 0;
export const dimDe = (p: Posicao): string => {
  if (S.dim === 'riscoCredito') {
    const k = p.riscoCredito || p.contraparte || '';
    return RISCO_CREDITO[k] || k || 'Não identificado';
  }
  return (p as any)[S.dim] || 'Outros';
};

export const somar = (lista: Posicao[]): number => somaLista(lista, valor);

export function somarPor(lista: Posicao[], chave: (p: Posicao) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of lista) {
    const k = chave(p);
    m.set(k, somaPrecisa(m.get(k), valor(p)));
  }
  return m;
}

export const somaSe = (P: Posicao[], f: (p: Posicao) => boolean): number => somaLista(P.filter(f), valor);

export const ordenadoDesc = (m: Map<string, number>): [string, number][] => [...m.entries()].sort((a, b) => b[1] - a[1]);

export function contasResumo(): Map<string, { conta: string; nome: string; pl: number; caixa: number; n: number }> {
  const m = new Map<string, { conta: string; nome: string; pl: number; caixa: number; n: number }>();
  for (const p of S.posicoes) {
    let c = m.get(p.conta);
    if (!c) m.set(p.conta, (c = { conta: p.conta, nome: p.nome, pl: 0, caixa: 0, n: 0 }));
    c.pl = somaPrecisa(c.pl, valor(p));
    c.n++;
    if (p.caixa) c.caixa = somaPrecisa(c.caixa, valor(p));
  }
  return m;
}

export const rotuloConta = (c: { conta: string; nome: string }): string => `${c.conta} · ${c.nome}`;
export const investimentos = (): Posicao[] => S.posicoes.filter(p => !p.caixa && !p.transito && !p.receber);

export function descContas(c: Cliente): string {
  return c.contas.length > 1 ? `${c.contas.length} contas: ${c.contas.join(', ')}` : `conta ${c.contas[0]}`;
}

export function montarClientes(posicoes: Posicao[], exemplo: boolean) {
  const cad = new Map<string, any>();
  const win = window as any;
  if (!exemplo && Array.isArray(win.CADASTRO_CLIENTES)) {
    for (const c of win.CADASTRO_CLIENTES) cad.set(chaveConta(c.conta), c);
  }
  if (!exemplo) {
    // Alteração feita no navegador vale por cima do grupos.js, mas mantém a descrição da conta (ex.: "PJ — Holding")
    for (const c of S.cadExtra.values()) { const k = chaveConta(c.conta); cad.set(k, { ...cad.get(k), ...c }); }
  }
  const planilhaTemGrupo = posicoes.some(p => (p as any).grupo);
  const apelidos = exemplo ? [] : (win.APELIDOS_CLIENTES || []);
  const porApelido = (nome: string) => {
    const n = norm(nome).replace(/[^a-z0-9]/g, '');
    return n
      ? apelidos.find((a: any) => {
          const k = norm(a.nome).replace(/[^a-z0-9]/g, '');
          const primeira = palavras(a.nome).trim().split(' ')[0];
          return n === k || n.startsWith(k) || (n.length >= 3 && n === primeira);
        })
      : null;
  };

  S.descConta = new Map();
  for (const p of posicoes) {
    const c = cad.get(chaveConta(p.conta)) || porApelido(p.nome);
    if (c?.descricao) S.descConta.set(p.conta, c.descricao);
    if (c) {
      p.clienteNome = nomeProprio(c.cliente);
      p.clienteId = 'p:' + norm(c.cliente);
      p.familiaNome = c.familia || null;
    } else if (planilhaTemGrupo || exemplo) {
      p.clienteNome = nomeProprio(p.nome);
      p.clienteId = 'p:' + norm(p.nome);
      p.familiaNome = (p as any).grupo || null;
    } else {
      p.clienteNome = nomeProprio(p.nome);
      p.clienteId = 'p:' + p.conta;
      p.familiaNome = null;
    }
  }

  const clientes = new Map<string, Cliente>();
  const familias = new Map<string, Familia>();
  const porConta = new Map<string, Cliente>();

  for (const p of posicoes) {
    let c = clientes.get(p.clienteId!);
    if (!c) clientes.set(p.clienteId!, (c = { id: p.clienteId!, nome: p.clienteNome!, contas: [], familiaNome: p.familiaNome, familiaId: null }));
    if (!c.contas.includes(p.conta)) c.contas.push(p.conta);
    porConta.set(p.conta, c);
  }

  for (const c of clientes.values()) {
    if (!c.familiaNome) continue;
    const id = 'f:' + norm(c.familiaNome);
    let f = familias.get(id);
    if (!f) familias.set(id, (f = { id, nome: c.familiaNome, clientes: [], contas: [] }));
    f.clientes.push(c.id);
    f.contas.push(...c.contas);
  }

  for (const [id, f] of familias) {
    if (f.clientes.length < 2) familias.delete(id);
    else f.clientes.forEach(cid => {
      const cli = clientes.get(cid);
      if (cli) cli.familiaId = id;
    });
  }

  return { clientes, familias, porConta };
}

export const clienteDaConta = (conta: string): Cliente | undefined => S.clientePorConta.get(conta);

export function unidades(nivel: 'cliente' | 'familia' = 'cliente'): Map<string, Unidade> {
  const resumo = contasResumo();
  const m = new Map<string, Unidade>();
  for (const c of S.clientes.values()) {
    const f = nivel === 'familia' && c.familiaId ? S.familias.get(c.familiaId) : null;
    const key = f ? f.id : c.id;
    let u = m.get(key);
    if (!u) {
      m.set(
        key,
        (u = f
          ? { key, tipo: 'familia', nome: f.nome, sub: `família · ${f.clientes.length} clientes`, contas: [], pl: 0, caixa: 0 }
          : { key, tipo: 'cliente', nome: c.nome, sub: descContas(c) + (c.familiaId ? ` · ${S.familias.get(c.familiaId)?.nome}` : ''), contas: [], pl: 0, caixa: 0 })
      );
    }
    for (const ct of c.contas) {
      const r = resumo.get(ct);
      if (!r) continue;
      u.contas.push(ct);
      u.pl = somaPrecisa(u.pl, r.pl);
      u.caixa = somaPrecisa(u.caixa, r.caixa);
    }
  }
  return m;
}

export const unidadeDe = (conta: string, nivel: 'cliente' | 'familia'): string => {
  const c = clienteDaConta(conta);
  return nivel === 'familia' && c?.familiaId ? c.familiaId : (c?.id || conta);
};

export function nomesFamilias(): string[] {
  const s = new Set<string>();
  const win = window as any;
  for (const c of win.CADASTRO_CLIENTES || []) if (c.familia) s.add(c.familia);
  for (const c of S.cadExtra.values()) if (c.familia) s.add(c.familia);
  for (const c of S.clientes.values()) if (c.familiaNome) s.add(c.familiaNome);
  return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function cadastroDe(conta: string) {
  const k = chaveConta(conta);
  const win = window as any;
  return S.cadExtra.get(k) || (win.CADASTRO_CLIENTES || []).find((c: any) => chaveConta(c.conta) === k) || null;
}

export function associacoesNovas() {
  const win = window as any;
  return [...S.cadExtra.values()].filter(c => {
    const o = (win.CADASTRO_CLIENTES || []).find((x: any) => chaveConta(x.conta) === chaveConta(c.conta));
    return !o || norm(o.cliente) !== norm(c.cliente) || norm(o.familia || o.cliente) !== norm(c.familia || c.cliente) || (!!c.descricao && norm(c.descricao) !== norm(o.descricao || ''));
  });
}
