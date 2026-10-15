import { esc, num, pct } from './formatters';
import { RAMPA } from '../domain/constants';

export function corLegivel(hex: string): string {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.substr(i, 2), 16));
  if (0.299 * r + 0.587 * g + 0.114 * b <= 125) return hex;
  const k = 0.62,
    mix = (c: number, n: number) => Math.round(c * (1 - k) + n * k);
  return (
    '#' +
    [mix(r, 0x0a), mix(g, 0x1f), mix(b, 0x44)]
      .map(v => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export interface DonutItem {
  pct: number;
  cor: string;
  rot: string;
}

export function donutDG(dados: DonutItem[], centro: string, total: string): string {
  const size = 250,
    ro = 118,
    ri = 76,
    gap = 1.2,
    cx = size / 2,
    cy = size / 2,
    out: string[] = [],
    fora: { am: number; pc: number }[] = [];
  let ang = -90;
  out.push(
    `<svg viewBox="-70 -16 ${size + 140} ${size + 32}" class="donut" role="img" aria-label="Distribuição por classe">`
  );
  for (const { pct: pc, cor, rot } of dados) {
    const sweep = (pc / 100) * 360;
    const a0 = ang + (sweep > 3 ? gap / 2 : 0),
      a1 = ang + Math.min(sweep, 359.99) - (sweep > 3 ? gap / 2 : 0);
    const big = a1 - a0 > 180 ? 1 : 0,
      r0 = (a0 * Math.PI) / 180,
      r1 = (a1 * Math.PI) / 180;
    const P = [
      [cx + ro * Math.cos(r0), cy + ro * Math.sin(r0)],
      [cx + ro * Math.cos(r1), cy + ro * Math.sin(r1)],
      [cx + ri * Math.cos(r1), cy + ri * Math.sin(r1)],
      [cx + ri * Math.cos(r0), cy + ri * Math.sin(r0)]
    ].map(x => x.map(v => v.toFixed(2)).join(','));
    out.push(
      `<path d="M ${P[0]} A ${ro} ${ro} 0 ${big} 1 ${P[1]} L ${P[2]} A ${ri} ${ri} 0 ${big} 0 ${P[3]} Z" fill="${cor}" data-tip="${esc(
        `${rot}\n${num(pc, 2)}% da carteira`
      )}"/>`
    );
    const am = ((a0 + a1) / 2 * Math.PI) / 180;
    if (pc >= 9) {
      const rm = (ro + ri) / 2,
        claro =
          0.299 * parseInt(cor.substr(1, 2), 16) +
            0.587 * parseInt(cor.substr(3, 2), 16) +
            0.114 * parseInt(cor.substr(5, 2), 16) >
          125;
      out.push(
        `<text x="${(cx + rm * Math.cos(am)).toFixed(1)}" y="${(cy + rm * Math.sin(am)).toFixed(
          1
        )}" text-anchor="middle" dominant-baseline="central" fill="${
          claro ? '#0A1F44' : '#FFF'
        }" font-size="13" font-weight="700">${num(pc, 1)}%</text>`
      );
    } else fora.push({ am, pc });
    ang += sweep;
  }
  for (const lado of ['d', 'e']) {
    const itens = fora
      .filter(f => (Math.cos(f.am) >= 0) === (lado === 'd'))
      .map(f => ({ ...f, y: cy + (ro + 16) * Math.sin(f.am) }))
      .sort((a, b) => a.y - b.y);
    let ult = -1e9;
    for (const it of itens) {
      const y = Math.max(it.y, ult + 15);
      ult = y;
      const s = lado === 'd' ? 1 : -1;
      const xa = cx + (ro + 2) * Math.cos(it.am),
        ya = cy + (ro + 2) * Math.sin(it.am),
        xb = cx + (ro + 26) * s;
      out.push(
        `<polyline points="${xa.toFixed(1)},${ya.toFixed(1)} ${xb},${y.toFixed(1)} ${xb + 4 * s},${y.toFixed(
          1
        )}" fill="none" stroke="#A8B4C4" stroke-width="1.1"/>`
      );
      out.push(
        `<text x="${xb + 6 * s}" y="${y.toFixed(1)}" text-anchor="${
          lado === 'd' ? 'start' : 'end'
        }" dominant-baseline="central" class="donut-ext" font-size="11.5" font-weight="700">${num(it.pc, 2)}%</text>`
      );
    }
  }
  out.push(`<text x="${cx}" y="${cy - 10}" text-anchor="middle" class="donut-k">${esc(centro)}</text>`);
  out.push(`<text x="${cx}" y="${cy + 12}" text-anchor="middle" class="donut-v">${esc(total)}</text></svg>`);
  return out.join('');
}

export interface BarraItem {
  rot: string;
  v: number;
  v2?: number;
  texto: string;
  tip?: string;
  acao?: string;
  sub?: boolean;
  seta?: string;
}

export function barras(itens: BarraItem[], { alvo = null, duplo = false }: { alvo?: number | null; duplo?: boolean } = {}): string {
  if (!itens.length) return '<p class="muted">Nada para mostrar.</p>';
  const max = Math.max(...itens.map(i => Math.max(i.v, i.v2 || 0)), alvo || 0) * 1.05 || 1;
  const w = (v: number) => ((Math.max(v, 0) / max) * 100).toFixed(2) + '%';
  return (
    '<div class="barras">' +
    itens
      .map(
        i => `
    <div class="barra-linha${i.sub ? ' sub' : ''}" data-tip="${esc(i.tip || '')}"${i.acao ? ` data-acao="${esc(i.acao)}"` : ''}>
      <div class="barra-rot">${i.seta !== undefined ? `<span class="seta">${i.seta}</span>` : ''}${esc(i.rot)}</div>
      <div class="trilho${duplo ? ' duplo' : ''}">
        ${i.v > 0 ? `<div class="barra" style="width:${w(i.v)}"></div>` : ''}
        ${duplo && (i.v2 || 0) > 0 ? `<div class="barra b2" style="width:${w(i.v2 || 0)}"></div>` : ''}
        ${alvo !== null ? `<div class="alvo" style="left:${w(alvo)}"></div>` : ''}
      </div>
      <div class="barra-val num">${esc(i.texto)}</div>
    </div>`
      )
      .join('') +
    '</div>'
  );
}

export function miniBarra(v: number, max: number, alvo: number | null = null, casas: number = 2): string {
  const w = (x: number) => (Math.max(0, Math.min(x / max, 1)) * 100).toFixed(1) + '%';
  return `<div class="mini"><div class="mini-trilho">${v > 0 ? `<div class="barra" style="width:${w(v)}"></div>` : ''}${
    alvo !== null ? `<div class="alvo" style="left:${w(alvo)}"></div>` : ''
  }</div><span class="num">${pct(v, casas)}</span></div>`;
}

export function calor(t: number): string {
  if (!(t > 0)) return 'color:var(--muted)';
  const i = Math.min(Math.floor(Math.sqrt(t) * RAMPA.length), RAMPA.length - 1);
  return `background:${RAMPA[i]};color:${i >= 6 ? '#ffffff' : '#0E1726'}`;
}
