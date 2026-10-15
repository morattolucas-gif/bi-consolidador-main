import { esc } from './formatters';

export const kpi = (rot: string, val: string, sub: string = '', titulo: string = ''): string =>
  `<div class="kpi"><div class="kpi-rot">${esc(rot)}</div><div class="kpi-val num" title="${esc(
    titulo || val
  )}">${esc(val)}</div>${sub ? `<div class="kpi-sub">${esc(sub)}</div>` : ''}</div>`;

export const kpiDG = (
  k: string,
  v: string,
  s: string = '',
  cls: string = '',
  barra: number | null = null
): string =>
  `<div class="kpi-dg ${cls}"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div>${
    s ? `<div class="s">${esc(s)}</div>` : ''
  }${
    barra !== null
      ? `<div class="shr"><i style="width:${Math.max(0, Math.min(100, barra * 100)).toFixed(2)}%"></i></div>`
      : ''
  }</div>`;

export const secaoDG = (n: number | string, titulo: string, sub: string, corpo: string, grupo: string = ''): string =>
  `<section class="rel-sec" data-grupo="${grupo}"><div class="rel-cab"><span class="rel-num">${n}</span><div><h2 class="rel-h2">${esc(
    titulo
  )}</h2><p class="rel-sub">${esc(sub)}</p></div></div>${corpo}</section>`;

export const obsDG = (textos: any[], titulo: string = 'Leitura', max: number = 3): string => {
  const t = textos.filter(Boolean).slice(0, max);
  return t.length
    ? `<div class="leitura"><div class="leitura-k">${esc(titulo)}</div>${t
        .map(x => (x.t ? `<p data-bloco="${x.bloco}">${x.t}</p>` : `<p>${x}</p>`))
        .join('')}</div>`
    : '';
};
