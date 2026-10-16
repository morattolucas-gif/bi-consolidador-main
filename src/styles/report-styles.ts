// Estilos consolidados do Diagnóstico Patrimonial e Relatórios Impressos (Padrão Propósito Capital)
// Garante inclusão completa nos relatórios PDF gerados dinamicamente em janelas/iframes isolados

export const DIAG_REPORT_CSS = `
:root {
  --marca: #04142d;
  --marca-2: #0d2547;
  --page: #f3f5f8;
  --surface: #ffffff;
  --surface-2: #eef1f5;
  --ink: #0b0b0b;
  --ink-2: #4a5263;
  --muted: #8a90a0;
  --grid: #e3e7ee;
  --axis: #c5cbd6;
  --border: rgba(4, 20, 45, 0.10);
  --s1: #2a78d6;
  --s1-sub: #86b6ef;
  --cmp: #b4b9c4;
  --accent: #04142d;
  --accent-ink: #ffffff;
  --link: #2a78d6;
  --good: #0ca30c;
  --crit: #d03b3b;
  font-family: "Manrope", system-ui, -apple-system, "Segoe UI", sans-serif;
  font-variant-numeric: tabular-nums lining-nums;
}

#diag, .sim-dg {
  --dg-navy: #0A1F44;
  --dg-titulo: #0A1F44;
  --dg-texto: #0E1726;
  --dg-texto2: #2F3D52;
  --dg-rotulo: #56657A;
  --dg-linha: #CBD6E3;
  --dg-alt: #E8EEF6;
  --dg-total: #E2EAF4;
  --dg-alerta: #A32E2E;
  --dg-azul: #5A9BD8;
  --dg-serif: "Manrope", system-ui, "Segoe UI", sans-serif;
  color: var(--dg-texto);
}

.num { font-variant-numeric: tabular-nums; }
.muted { color: var(--muted); }
.sec { color: var(--ink-2); }

.rel-topo { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px 16px; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); border-bottom: 2px solid var(--dg-azul); padding-bottom: 8px; margin: 4px 0 16px; }
.rel-topo .btn-pri { letter-spacing: normal; text-transform: none; font-size: 13px; }
.rel-sec { background: #FFFFFF; color: var(--dg-texto); color-scheme: light; border: 1px solid #E3E9F0; border-radius: 12px; padding: 22px 24px; margin-bottom: 16px; scroll-margin-top: 140px; }
.rel-cab { display: flex; gap: 14px; align-items: baseline; border-bottom: 1px solid var(--dg-linha); padding-bottom: 12px; margin-bottom: 18px; }
.rel-num { font-family: var(--dg-serif); font-size: 26px; font-weight: 800; letter-spacing: -.02em; color: var(--dg-azul); line-height: 1; }
.rel-h2 { font-family: var(--dg-serif); font-size: 22px; font-weight: 800; color: var(--dg-titulo); margin: 0; letter-spacing: -.02em; }
.rel-sub { margin: 3px 0 0; font-size: 13px; color: var(--dg-texto2); }
#diag .box-k { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--dg-navy); font-weight: 700; margin-bottom: 8px; }
#diag .hbars-dg { display: grid; gap: 7px; }
#diag .hbars-dg.duas { grid-template-columns: 1fr 1fr; column-gap: 28px; }
#diag .hb { display: grid; grid-template-columns: minmax(110px, 1.1fr) 2fr 58px 112px; align-items: center; gap: 10px; font-size: 12px; }
#diag .hb-n { color: var(--dg-texto); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#diag .hb-t { height: 12px; background: var(--dg-alt); border-radius: 3px; overflow: hidden; }
#diag .hb-t i { display: block; height: 100%; border-radius: 3px; }
#diag .hb-p { text-align: right; font-weight: 800; color: var(--dg-titulo); }
#diag .hb-v { text-align: right; color: var(--dg-texto2); }

.vis-ativos { color: #0E1726; }
.va-part { margin-bottom: 16px; }
.va-part .va-k { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #0A1F44; font-weight: 700; margin-bottom: 6px; }
.va-pilha { display: flex; height: 26px; border-radius: 6px; overflow: hidden; }
.va-pilha i { display: flex; align-items: center; justify-content: center; color: #fff; font-size: 11px; font-weight: 700; font-style: normal; white-space: nowrap; overflow: hidden; }
.va-pilha-leg { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 6px; font-size: 11.5px; color: #2F3D52; }
.va-pilha-leg span::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: var(--c); margin-right: 6px; vertical-align: -1px; }
.va-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; }
.va-card { border: 1px solid #CBD6E3; border-top: 4px solid var(--c, #0A1F44); border-radius: 10px; padding: 14px 16px; background: #fff; break-inside: avoid; }
.va-topo { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.va-topo b { display: block; font-size: 15px; font-weight: 800; color: #0A1F44; }
.va-topo small { color: #56657A; font-size: 11.5px; }
.va-valor { font-size: 20px; font-weight: 800; color: #0A1F44; margin-top: 8px; letter-spacing: -.01em; }
.va-valor span { font-size: 12px; font-weight: 600; color: #2F3D52; margin-left: 6px; }
.va-anel { flex: none; text-align: center; font-size: 10.5px; color: #2F3D52; line-height: 1.2; }
.va-anel svg { display: block; margin: 0 auto 2px; }
.va-barras { margin-top: 12px; display: grid; gap: 8px; }
.va-b { display: grid; grid-template-columns: 128px 1fr 58px; align-items: center; gap: 8px; font-size: 12px; }
.va-b .r { color: #2F3D52; }
.va-b .r small { display: block; color: #56657A; font-size: 10.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.va-b .tr { height: 12px; background: #E8EEF6; border-radius: 3px; overflow: hidden; }
.va-b .tr i { display: block; height: 100%; border-radius: 3px; }
.va-b .v { text-align: right; font-weight: 800; color: #0A1F44; }
.va-nota { font-size: 11px; color: #56657A; margin-top: 10px; }

#diag .col-dg { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
.dg-multi > [data-bloco="top"] { grid-column: 1 / -1; }
#diag .box-k .bk-x { float: right; letter-spacing: .04em; text-transform: none; font-size: 12px; color: var(--dg-titulo); font-weight: 700; }
.kpis-dg { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px; }
.kpi-dg { border: 1px solid #C9D5E3; border-top: 3px solid var(--dg-navy); padding: 14px 16px; background: #FFFFFF; min-width: 0; }
.kpi-dg .k { font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--dg-rotulo); }
.kpi-dg .v { font-family: var(--dg-serif); font-size: 22px; font-weight: 800; letter-spacing: -.02em; color: var(--dg-titulo); margin: 6px 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kpi-dg .s { font-size: 11.5px; color: var(--dg-texto2); }
.kpi-dg .shr { height: 4px; background: var(--dg-linha); margin-top: 8px; }
.kpi-dg .shr i { display: block; height: 100%; background: #2E6FB7; }
.kpi-dg.main { background: var(--dg-navy); border-color: var(--dg-navy); }
.kpi-dg.main .k { color: rgba(255,255,255,.72); }
.kpi-dg.main .v, .kpi-dg.main .s { color: #fff; }

.dt-wrap { overflow-x: auto; }
table.dt { width: 100%; border-collapse: collapse; border: 1px solid var(--dg-linha); }
table.dt thead th { position: static; background: var(--dg-navy); color: #fff; font-size: 10px; letter-spacing: .09em; text-transform: uppercase; text-align: right; padding: 8px 9px; font-weight: 700; white-space: normal; border: 0; }
table.dt thead th.l { text-align: left; }
table.dt tbody td { padding: 7px 9px; font-size: 12.5px; text-align: right; border-bottom: 1px solid var(--dg-linha); white-space: normal; color: var(--dg-texto); }
table.dt tbody td.l { text-align: left; }
table.dt tbody td.num { font-variant-numeric: tabular-nums; white-space: nowrap; }
table.dt tbody tr:nth-child(even) td { background: var(--dg-alt); }
table.dt tbody tr:hover td { background: #DCE7F4; }
table.dt .nm { font-weight: 700; }
table.dt td.ativos { font-size: 11.5px; color: var(--dg-texto2); }
table.dt td.tot { font-weight: 700; color: var(--dg-titulo); }
table.dt tr.total td { background: var(--dg-total) !important; border-top: 1.4px solid var(--dg-navy); font-weight: 700; color: var(--dg-titulo); }
#diag .sw { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 7px; vertical-align: 1px; box-shadow: 0 0 0 1px rgba(10,31,68,.15); }
#diag .al { color: var(--dg-alerta); font-weight: 700; }

.cbloco { margin-bottom: 16px; break-inside: avoid; border: 1px solid var(--dg-linha); }
.cbloco table.dt { border: 0; }
.bloco-dg { margin-top: 24px; }
.empilhada { display: flex; height: 22px; margin: 4px 0 8px; border: 1px solid var(--dg-linha); }
.empilhada i { display: block; height: 100%; border-right: 2px solid #fff; }
.empilhada i:last-child { border-right: 0; }
.empilhada-leg { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 12px; color: var(--dg-texto2); }
.empilhada-leg b { color: var(--dg-titulo); }
.dg-blocos.largo { columns: 1; }

.leitura { background: #F2F6FB; border: 1px solid var(--dg-linha); border-left: 3px solid var(--dg-navy); padding: 12px 16px; margin-top: 18px; break-inside: avoid; }
.dg-2col > div > .leitura:first-child { margin-top: 0; height: 100%; }
.leitura-k { font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--dg-navy); font-weight: 700; margin-bottom: 8px; }
.leitura p { margin: 0 0 7px; font-size: 12.5px; line-height: 1.55; color: var(--dg-texto2); }
.leitura p:last-child { margin-bottom: 0; }
.leitura b { color: var(--dg-texto); }

.estate { background: var(--dg-navy); color: #fff; padding: 14px 16px; height: 100%; break-inside: avoid; }
.estate .leitura-k { color: #9CC3E8; }
.estate p { margin: 0 0 7px; font-size: 12.5px; line-height: 1.5; color: rgba(255,255,255,.88); }
.estate b { color: #fff; }

.cb-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 12px; padding: 8px 12px; color: #fff; background: var(--dg-navy, #0A1F44); }
.cb-nome { font-family: var(--dg-serif); font-size: 15px; font-weight: 700; flex: 1; }
.cb-val { font-family: var(--dg-serif); font-size: 15px; font-weight: 700; }
.cb-pct { font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; opacity: .82; }

.dg-classe { display: grid; grid-template-columns: minmax(260px, 340px) 1fr; gap: 20px; align-items: center; }
.dg-hz { grid-template-columns: minmax(200px, 250px) 1fr; }
.leg-hz { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; font-size: 11px; color: var(--dg-texto-2, #4A5A70); margin-top: 4px; }
.leg-hz .sw { margin-right: 5px; }
.dg-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
.dg-auto > :only-child { grid-column: 1 / -1; }

#diag tr.grupo-v td { background: var(--dg-fundo-cab, #F3F6FA); font-weight: 700; }
#diag .veic { padding-left: 18px; display: inline-block; }
.dg-blocos { columns: 2 560px; column-gap: 20px; }

.donut { width: 100%; max-width: 360px; display: block; margin: 0 auto; }
.donut path { stroke: #FFFFFF; stroke-width: 1; }
.donut-ext { fill: var(--dg-titulo); }
.donut-k { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; fill: var(--dg-rotulo); }
.donut-v { font-family: var(--dg-serif); font-size: 18px; font-weight: 700; fill: var(--dg-titulo); }

#diag .obs { margin: 12px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--dg-texto2); border-left: 2px solid var(--dg-navy); padding: 3px 0 3px 10px; }
#diag .obs.al { border-left-color: var(--dg-alerta); color: var(--dg-texto2); font-weight: 400; }
#diag .obs b { color: var(--dg-texto); }
.tag-dg { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #4A5A70; background: #EDF2F8; border: 1px solid #C4CEDB; border-radius: 3px; padding: 0 5px; white-space: nowrap; cursor: help; vertical-align: 1px; }
.rel-divisor { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin: 28px 0 12px; display: flex; align-items: center; gap: 12px; }
.rel-divisor::after { content: ""; flex: 1; height: 1px; background: var(--border); }
@media (max-width: 900px) { .dg-classe, .dg-2col { grid-template-columns: 1fr; } .rel-sec { padding: 16px; } }
`;
