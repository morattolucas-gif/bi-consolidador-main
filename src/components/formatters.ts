const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const vazio = (v: any): boolean => v === null || v === undefined || Number.isNaN(v);

export const brl = (v: any): string => (vazio(v) ? '–' : fmtBRL.format(v));

export const num = (v: any, c: number = 2): string =>
  vazio(v) ? '–' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });

export const pct = (v: any, c: number = 1): string =>
  vazio(v) || !isFinite(v) ? '–' : num(Number(v) * 100, c) + '%';

export const inteiro = (v: any): string => (vazio(v) ? '–' : Math.round(Number(v)).toLocaleString('pt-BR'));

export const dataBR = (d: any): string => (d instanceof Date && !isNaN(d.getTime()) ? d.toLocaleDateString('pt-BR') : '–');

export function brlCurto(v: any): string {
  if (vazio(v)) return '–';
  const a = Math.abs(Number(v));
  if (a >= 1e9) return 'R$ ' + num(Number(v) / 1e9, 2) + ' bi';
  if (a >= 1e6) return 'R$ ' + num(Number(v) / 1e6, 2) + ' mi';
  if (a >= 1e4) return 'R$ ' + num(Number(v) / 1e3, 1) + ' mil';
  return brl(v);
}

export const numBR = (s: any): number => {
  if (typeof s === 'number') return isNaN(s) ? 0 : s;
  if (!s) return 0;
  const str = String(s).trim().replace(/^[^\d\-]+/, '').replace(/\s+/g, '');
  const limpo = str.includes(',') ? str.replace(/\./g, '').replace(',', '.') : str;
  const n = parseFloat(limpo);
  return isNaN(n) ? 0 : n;
};

export const numero = numBR;

export const esc = (s: any): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const norm = (s: any): string =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// Texto sem acento, em minúsculas, só letras e números, com espaço nas pontas: os leitores procuram " palavra "
// (ex.: / extrato da conta investimento /, / cdb /). Sem os espaços e sem tirar os acentos, nada é reconhecido.
export const palavras = (s: any): string => ' ' + norm(s).replace(/[^a-z0-9]+/g, ' ').trim() + ' ';

export const compacto = (s: any): string =>
  norm(s).replace(/[^a-z0-9]/g, '');

export const chaveConta = (c: any): string => String(c ?? '').trim().replace(/^0+/, '');

const MINUSCULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'e/ou']);
export const nomeProprio = (s: any): string =>
  String(s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w, i) => (i && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

export const sigla = (inst: any): string => {
  const m: Record<string, string> = { 'BTG Pactual': 'BTG', 'XP Investimentos': 'XP', 'Banco Safra': 'Safra', 'Caixa Econômica Federal': 'Caixa', 'Nomad Global': 'Nomad' };
  return m[inst] || inst || 'Outra';
};

export const descContas = (c: { contas: string[] }): string =>
  c.contas.length > 1 ? `${c.contas.length} contas: ${c.contas.join(', ')}` : `conta ${c.contas[0]}`;

export const clienteDaConta = (conta: string, clientePorConta: Map<string, any>) => clientePorConta.get(conta);

import { S } from '../domain/state';
export const valor = (p: any): number =>
  S.campoValor === 'liquido' ? (p?.liquido ?? p?.bruto ?? 0) : (p?.bruto ?? p?.liquido ?? 0);



// Nomes repetidos (a planilha do BTG só traz o primeiro nome): nas listas aparece a conta para diferenciar
export const nomeRepetido = (nome: string, lista: { nome: string }[]): boolean => lista.filter(x => norm(x.nome) === norm(nome)).length > 1;
export const rotuloContas = (contas: string[]): string =>
  (contas.length > 1 ? 'contas ' : 'conta ') + contas.map(c => String(c).replace(/^0+(?=\d)/, '')).join(', ');
// Nome com uma palavra só (ex.: "Carlos", como vem na planilha): não serve para identificar uma pessoa
export const soPrimeiroNome = (nome: any): boolean => norm(nome).trim().split(/\s+/).filter(Boolean).length < 2;
