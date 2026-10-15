import { esc } from './formatters';
import { S } from '../domain/state';

export const $ = (s: string, el: ParentNode = document): HTMLElement | null => el.querySelector(s);
export const $$ = (s: string, el: ParentNode = document): HTMLElement[] => Array.from(el.querySelectorAll(s)) as HTMLElement[];

export interface ColunaTabela {
  k: string;
  rot: string;
  fmt?: (v: any, l: any) => string;
  html?: (v: any, l: any) => string;
  n?: boolean;
  cls?: string;
  estilo?: (v: any, l: any) => string;
}

export function ordenar(id: string, linhas: any[], padrao: { k: string; dir: number }) {
  const o = S.ordem[id] || padrao;
  const ord = [...linhas].sort((a, b) => {
    const x = a[o.k], y = b[o.k];
    if (x === y) return 0;
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    return (typeof x === 'string' ? x.localeCompare(y, 'pt-BR') : x - y) * o.dir;
  });
  return { o, ord };
}

export const setaOrdem = (o: { k: string; dir: number }, k: string): string =>
  o.k === k ? `<span class="ord">${o.dir > 0 ? '▲' : '▼'}</span>` : '';

export function tabela(
  id: string,
  cols: ColunaTabela[],
  linhas: any[],
  { attr = null, padrao = null }: { attr?: ((l: any) => string) | null; padrao?: { k: string; dir: number } | null } = {}
): string {
  const { o, ord } = ordenar(id, linhas, padrao || { k: cols.find(c => c.n)?.k || cols[0].k, dir: -1 });
  const th = cols
    .map(c => `<th class="${c.n ? 'n' : ''}" data-tab="${id}" data-k="${esc(c.k)}">${esc(c.rot)}${setaOrdem(o, c.k)}</th>`)
    .join('');
  const tb = ord
    .map(
      l =>
        `<tr${attr ? ' ' + attr(l) : ''}>` +
        cols
          .map(c => {
            const v = l[c.k];
            const st = c.estilo ? c.estilo(v, l) : '';
            return `<td class="${c.n ? 'n' : ''} ${c.cls || ''}"${st ? ` style="${st}"` : ''}>${
              c.html ? c.html(v, l) : esc(c.fmt ? c.fmt(v, l) : (v ?? '–'))
            }</td>`;
          })
          .join('') +
        '</tr>'
    )
    .join('');
  return `<div class="tabela-wrap"><table><thead><tr>${th}</tr></thead><tbody>${
    tb || `<tr><td colspan="${cols.length}" class="muted">Nenhum resultado.</td></tr>`
  }</tbody></table></div>`;
}

export interface ColunaDG {
  rot: string;
  w: string;
  l?: boolean;
  cls?: string;
  f: (linha: any) => string;
}

export function tabelaDG(cols: ColunaDG[], linhas: any[], total: string[] | null = null): string {
  const cg = `<colgroup>${cols.map(c => `<col style="width:${c.w}">`).join('')}</colgroup>`;
  const th = cols.map(c => `<th class="${c.l ? 'l' : ''}">${esc(c.rot)}</th>`).join('');
  const tr = linhas
    .map(
      l =>
        `<tr${l._attr ? ' ' + l._attr : ''}>${cols
          .map(c => `<td class="${c.l ? 'l' : 'num'} ${c.cls || ''}">${c.f(l)}</td>`)
          .join('')}</tr>`
    )
    .join('');
  const tt = total
    ? `<tr class="total">${cols.map((c, i) => `<td class="${c.l ? 'l' : 'num'}">${total[i] ?? ''}</td>`).join('')}</tr>`
    : '';
  return `<div class="dt-wrap"><table class="dt">${cg}<thead><tr>${th}</tr></thead><tbody>${tr}${tt}</tbody></table></div>`;
}
