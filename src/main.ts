import './styles/main.css';
import { S } from './domain/state';
import { CHAVE_CAD_ARQ, CHAVE_USUARIO, SALDO_CONTA } from './domain/constants';
import {
  adicionarFonte,
  removerFonte,
  recalcular,
  registrarCallbacksUI
} from './domain/pipeline';
import {
  restaurarFontes,
  restaurarPoliticas,
  lerLocal,
  registrar
} from './domain/storage';
import { associacoesNovas } from './domain/calculations';
import {
  anexarExtrato,
  abrirPoliticas,
  abrirHistorico,
  editarCadastro,
  perguntarUsuario,
  mostrarUsuario,
  conferirVersao,
  salvarNovos,
  carregarCadLocal,
  limparCadLocal,
  baixarModelo,
  abrirExtratos,
  perguntarDono,
  abrirFundGuideModal
} from './components/views/modals';
import {
  lerPasta,
  atualizarComPasta,
  processarArquivos,
  processarArquivo,
  avisarPlanilhaAntiga,
  aplicarCadastro,
  lerCadastroDaPasta,
  setModalDonoHandler
} from './parsers/pasta';
import { baixarModeloPoliticaExcel } from './parsers/politicas-excel';
import { gerarExemplo } from './parsers/reconciliar';
import { renderCarteira } from './components/views/carteira';
import {
  renderConta,
  renderSimPreview,
  renderSimForm
} from './components/views/conta';
import {
  calcularMov,
  contaMov,
  contasSel
} from './domain/simulator';
import {
  renderAtivo,
  exportarPosicao,
  pdfPosicao,
  exportarSimulacao
} from './components/views/ativo';
import { gerarRelatorio } from './components/views/diagnostico';
import { $, $$ } from './components/dom';
import { esc, norm, clienteDaConta } from './components/formatters';

import { renderBaseClientes } from './components/views/base-clientes';
import { restaurarBaseBtg, restaurarFaixasBase, restaurarFundGuide } from './domain/storage';

const DIMS: Record<string, string> = {
  classe: 'Classe de ativos',
  subclasse: 'Subclasse',
  estrategia: 'Estratégia de investimento',
  riscoCredito: 'Risco de crédito',
  instituicao: 'Instituição custodiante'
};

/* =====================================================================
   Orquestração
   ===================================================================== */
export function render() {
  document.querySelectorAll('.dim-nome').forEach(e => {
    e.textContent = (DIMS[S.dim] || S.dim).toLowerCase();
  });
  if (S.aba === 'carteira') renderCarteira();
  if (S.aba === 'conta') renderConta();
  if (S.aba === 'ativo') renderAtivo();
  if (S.aba === 'base') renderBaseClientes();
}

export function irPara(aba: string, rolar: boolean = true) {
  S.aba = aba;
  const painelEl = $('#painel');
  if (painelEl && (aba === 'base' || S.posicoes.length > 0 || S.baseBtg?.length > 0)) {
    painelEl.hidden = false;
  }
  const vazioEl = $('#vazio');
  if (vazioEl && (aba === 'base' || S.posicoes.length > 0 || S.baseBtg?.length > 0)) {
    vazioEl.hidden = true;
  }
  const controlesEl = $('#controles');
  if (controlesEl && (S.posicoes.length > 0 || S.baseBtg?.length > 0)) {
    controlesEl.hidden = false;
  }
  document.querySelectorAll('.abas button').forEach(b => {
    b.setAttribute('aria-selected', String((b as HTMLElement).dataset.aba === aba));
  });
  document.querySelectorAll('.aba').forEach(s => {
    (s as HTMLElement).hidden = s.id !== 'aba-' + aba;
  });
  render();
  if (rolar) window.scrollTo({ top: 0 });
}
(window as any).irPara = irPara;

// Barra acima das abas: planilha do BTG carregada (arquivo, posição, lida em) e os botões de extratos
function renderFontes() {
  const fs = [...S.fontes.values()];
  const btg = S.fontes.get('BTG') || S.fontes.get('EXEMPLO');
  const lida = (f: any) => (f?.enviadoEm ? `lida em ${new Date(f.enviadoEm).toLocaleDateString('pt-BR')}` : '');
  const info = btg
    ? btg.id === 'EXEMPLO'
      ? 'Base fictícia de demonstração'
      : `Planilha do BTG: <b>${esc(btg.arquivo || '–')}</b>${btg.dataRef ? ` · posição de ${esc(btg.dataRef)}` : ''}${lida(btg) ? ` · ${esc(lida(btg))}` : ''}`
    : 'Sem planilha do BTG carregada';
  const nExt = fs.filter(f => f.id !== 'BTG' && f.id !== 'EXEMPLO').length;
  const nPol = S.politicasPorConta?.size || 0;
  const nNovos = associacoesNovas().length;
  const nBase = S.baseBtg?.length || 0;
  const el = $('#fontes');
  if (el) el.innerHTML = `<span class="info-dados">${info}</span>` +
    `<button class="btn" data-acao="extratos" title="Planilha do BTG e extratos de cada cliente: data, quem enviou, substituir e remover">Extratos${nExt ? ` (${nExt})` : ''}</button>` +
    `<button class="btn" data-acao="politicas" title="Gerenciar Políticas de Investimento em Excel por Conta (LGPD)">Políticas${nPol ? ` (${nPol})` : ''}</button>` +
    `<button class="btn" data-acao="irbase" title="Base de Clientes BTG (CRM / Plano de Negócio)">Base de Clientes${nBase ? ` (${nBase})` : ''}</button>` +
    `<button class="btn" data-acao="atualizarpasta" title="Lê a pasta de posições e carrega os arquivos mais recentes">Atualizar com a pasta</button>` +
    `<button class="btn" data-acao="addposicao" title="Carregar nova planilha de posições da base toda (D-0 / D-1) para acompanhar saldos e política">📊 + Posição diária</button>` +
    `<button class="btn" data-acao="addextrato" title="Anexar extrato oficial mensal fechado de um cliente (PDF ou Excel)">📑 + Extrato do cliente</button>` +
    (nNovos ? `<button class="btn" data-acao="salvarcad" title="Clientes associados a extratos que ainda não estão no cadastro permanente">Guardar ${nNovos === 1 ? '1 cliente novo' : `${nNovos} clientes novos`}</button>` : '');
  avisarCadastro();
}

// Sem cadastro (grupos.js) neste navegador, a planilha do BTG só traz o primeiro nome: avisa e oferece carregar o arquivo
function avisarCadastro() {
  const box = $('#aviso-cad');
  if (!box) return;
  const semCad = !S.exemplo && S.posicoes.length > 0 && !((window as any).CADASTRO_CLIENTES || []).length;
  box.hidden = !semCad;
  if (!semCad) return;
  box.innerHTML = `<b>Nomes completos não carregados:</b> a planilha do BTG só traz o primeiro nome. Carregue o cadastro de clientes (arquivo <b>grupos.js</b>, na pasta B.I do OneDrive) para o B.I. saber quem é quem.
    <button type="button" class="btn-link" id="btn-cad-arq">Carregar grupos.js</button>`;
  const b = $('#btn-cad-arq');
  if (b) b.onclick = () => ($('#arq-cadastro') as HTMLInputElement)?.click();
}
$('#arq-cadastro')?.addEventListener('change', async e => {
  const inp = e.target as HTMLInputElement;
  const a = inp.files?.[0];
  inp.value = '';
  if (!a) return;
  try {
    const c = await lerCadastroDaPasta(a);
    limparCadLocal();
    registrar('Cadastro carregado', `${a.name} · ${c.clientes.length} contas`);
    recalcular();
  } catch (err: any) {
    alert(`Não consegui ler o cadastro (${err.message || err}). Confira se é o grupos.js da pasta B.I.`);
  }
});

// Configura callback mútuo entre pipeline e UI
registrarCallbacksUI({
  renderFontes,
  irPara,
  render
});

// Configura handler do leitor de pasta para solicitar dono desconhecido via modal
setModalDonoHandler((ext: any) => perguntarDono(ext));

/* ---------- Eventos ---------- */
$('#btn-posicao')?.addEventListener('click', () => anexarExtrato({ modo: 'posicao' }));
$('#btn-anexar')?.addEventListener('click', () => anexarExtrato({ modo: 'extrato' }));
$('#btn-pasta')?.addEventListener('click', () => lerPasta());
$('#btn-politicas')?.addEventListener('click', () => abrirPoliticas());
$('#btn-historico')?.addEventListener('click', () => abrirHistorico());
$('#btn-fund-guide')?.addEventListener('click', () => abrirFundGuideModal());
$('#btn-cadastro')?.addEventListener('click', () => editarCadastro());
$('#btn-usuario')?.addEventListener('click', () => perguntarUsuario());
function carregarBaseBtgArquivo() {
  const inp = $('#input-base-btg') as HTMLInputElement;
  if (inp) {
    inp.click();
  }
}

const inputBaseBtg = $('#input-base-btg') as HTMLInputElement;
if (inputBaseBtg) {
  inputBaseBtg.addEventListener('change', async () => {
    const f = inputBaseBtg.files?.[0];
    if (!f) return;
    const aviso = $('#aviso-carga');
    try {
      if (aviso) {
        aviso.textContent = `Carregando Base BTG (${f.name})…`;
        aviso.hidden = false;
      }
      await processarArquivo(f);
      irPara('base');
    } catch (err: any) {
      const errEl = $('#erro');
      if (errEl) {
        errEl.textContent = `Erro ao ler Base BTG: ${err.message || err}`;
        errEl.hidden = false;
      }
    } finally {
      if (aviso) aviso.hidden = true;
      inputBaseBtg.value = '';
    }
  });
}

const inputFundGuide = $('#input-fund-guide') as HTMLInputElement;
if (inputFundGuide) {
  inputFundGuide.addEventListener('change', async () => {
    const f = inputFundGuide.files?.[0];
    if (!f) return;
    const aviso = $('#aviso-carga');
    try {
      if (aviso) {
        aviso.textContent = `Carregando Fund Guide (${f.name})…`;
        aviso.hidden = false;
      }
      await processarArquivo(f);
    } catch (err: any) {
      const errEl = $('#erro');
      if (errEl) {
        errEl.textContent = `Erro ao ler Fund Guide: ${err.message || err}`;
        errEl.hidden = false;
      }
    } finally {
      if (aviso) aviso.hidden = true;
      inputFundGuide.value = '';
    }
  });
}

$('#btn-vazio-posicao')?.addEventListener('click', e => { e.stopPropagation(); anexarExtrato({ modo: 'posicao' }); });
$('#btn-vazio-extrato')?.addEventListener('click', e => { e.stopPropagation(); anexarExtrato({ modo: 'extrato' }); });
$('#card-vazio-posicao')?.addEventListener('click', () => anexarExtrato({ modo: 'posicao' }));
$('#card-vazio-extrato')?.addEventListener('click', () => anexarExtrato({ modo: 'extrato' }));
$('#btn-vazio-base')?.addEventListener('click', e => { e.stopPropagation(); carregarBaseBtgArquivo(); });
$('#card-vazio-base')?.addEventListener('click', () => carregarBaseBtgArquivo());
$('#btn-vazio-fundguide')?.addEventListener('click', e => { e.stopPropagation(); abrirFundGuideModal(); });
$('#card-vazio-fundguide')?.addEventListener('click', () => abrirFundGuideModal());
$('#btn-vazio-pasta')?.addEventListener('click', e => { e.stopPropagation(); lerPasta(); });
$('#btn-vazio-anexar')?.addEventListener('click', e => { e.stopPropagation(); anexarExtrato({ modo: 'extrato' }); });
$('#drop')?.addEventListener('click', () => anexarExtrato());

$('#drop')?.addEventListener('keydown', e => {
  const ev = e as KeyboardEvent;
  if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault();
    anexarExtrato();
  }
});

$('#btn-exemplo')?.addEventListener('click', () => {
  S.fontes.clear();
  adicionarFonte({ id: 'EXEMPLO', inst: 'BTG', rotulo: 'base fictícia', registros: gerarExemplo() });
});

let contadorArrasto = 0;
window.addEventListener('dragenter', e => {
  e.preventDefault();
  contadorArrasto++;
  document.body.classList.add('arrastando');
});
window.addEventListener('dragleave', () => {
  if (--contadorArrasto <= 0) {
    contadorArrasto = 0;
    document.body.classList.remove('arrastando');
  }
});
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => {
  e.preventDefault();
  contadorArrasto = 0;
  document.body.classList.remove('arrastando');
  if (e.dataTransfer && e.dataTransfer.files.length) {
    processarArquivos([...e.dataTransfer.files]);
  }
});

function segmentado(id: string, aoMudar: (v: string) => void) {
  const el = $(id);
  if (!el) return;
  el.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    aoMudar(b.dataset.v || '');
  });
}

segmentado('#seg-valor', v => { S.campoValor = v as any; render(); });
segmentado('#seg-publico', v => { S.publico = v as any; render(); });
segmentado('#mapa-cols', v => { S.mapa.cols = v as any; delete S.ordem.mapa; render(); });
segmentado('#mapa-metrica', v => { S.mapa.metrica = v as any; render(); });

$('#mapa-filtro')?.addEventListener('change', e => {
  S.mapa.filtro = (e.target as HTMLSelectElement).value;
  if (S.mapa.filtro && S.mapa.cols === 'classe') S.mapa.cols = 'ativo';
  if (!S.mapa.filtro && S.mapa.cols === 'ativo') S.mapa.cols = 'classe';
  S.ordem.mapa = S.mapa.filtro ? { k: 'tot', dir: -1 } : undefined as any;
  render();
});
$('#mapa-busca')?.addEventListener('input', e => {
  S.mapa.busca = (e.target as HTMLInputElement).value;
  render();
});
$('#sel-raiox')?.addEventListener('change', e => {
  S.raioX = (e.target as HTMLSelectElement).value;
  render();
});
$('#raiox-mapa')?.addEventListener('click', () => {
  S.mapa.filtro = S.raioX;
  S.mapa.cols = 'ativo';
  S.ordem.mapa = { k: 'tot', dir: -1 };
  render();
  $('#cartao-mapa')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

$('#sel-dim')?.addEventListener('change', e => { S.dim = (e.target as HTMLSelectElement).value as any; render(); });
$('#sel-top')?.addEventListener('change', e => { S.topN = +(e.target as HTMLSelectElement).value; render(); });
$('#busca-ativos')?.addEventListener('input', e => { S.busca = (e.target as HTMLInputElement).value; render(); });

export function abrirUnidade(key: string) {
  S.sel = key;
  S.buscaConta = '';
  const buscaContaEl = $('#busca-conta') as HTMLInputElement;
  if (buscaContaEl) buscaContaEl.value = '';
  irPara('conta');
}

export const abrirConta = (conta: string) => {
  const c = clienteDaConta(conta, S.clientePorConta);
  if (c) abrirUnidade(c.id);
};

segmentado('#mapa-linhas', v => { S.mapa.nivel = v as any; render(); });
$('#sel-conta')?.addEventListener('change', e => { S.sel = (e.target as HTMLSelectElement).value; render(); });

function passoConta(d: number) {
  const selContaEl = $('#sel-conta') as HTMLSelectElement;
  if (!selContaEl) return;
  const lista = [...selContaEl.options].map(o => o.value);
  const i = lista.indexOf(S.sel);
  S.sel = lista[(i + d + lista.length) % lista.length];
  render();
}

$('#busca-conta')?.addEventListener('input', e => {
  S.buscaConta = (e.target as HTMLInputElement).value;
  render();
});

// Simulador da conta
$('#sim-ativo')?.addEventListener('change', e => { S.fm.ativo = (e.target as HTMLSelectElement).value; render(); });
segmentado('#sim-acao', v => { S.fm.acao = v as any; S.fm.valor = ''; render(); });
segmentado('#sim-nivel', v => { S.fm.nivel = v as any; render(); });
segmentado('#sim-origem', v => { S.fm.origem = v as any; render(); });

$('#sim-valor')?.addEventListener('input', e => {
  S.fm.valor = (e.target as HTMLInputElement).value;
  renderSimPreview();
});
$('#sim-conta')?.addEventListener('change', e => { S.fm.conta = (e.target as HTMLSelectElement).value; render(); });
$('#sim-novo-nome')?.addEventListener('input', e => {
  S.fm.novo.nome = (e.target as HTMLInputElement).value;
  renderSimForm(S.posicoes.filter(p => contasSel().includes(p.conta)));
  renderSimPreview();
});
$('#sim-novo-classe')?.addEventListener('change', e => {
  S.fm.novo.classe = (e.target as HTMLSelectElement).value;
  S.fm.novo.subclasse = '';
  const subEl = $('#sim-novo-sub') as HTMLInputElement;
  if (subEl) subEl.value = '';
  render();
});
$('#sim-novo-sub')?.addEventListener('input', e => {
  S.fm.novo.subclasse = (e.target as HTMLInputElement).value;
  renderSimPreview();
});
$('#sim-novo-estr')?.addEventListener('change', e => {
  S.fm.novo.estrategia = (e.target as HTMLSelectElement).value;
  renderSimPreview();
});

$('#sim-add')?.addEventListener('click', () => {
  const mov = calcularMov();
  if (!mov || Math.abs(mov.v) < 0.01) return;
  const ct = contaMov();
  if (!S.movs.has(ct)) S.movs.set(ct, []);
  S.movs.get(ct)!.push(mov);
  S.fm.valor = '';
  const valEl = $('#sim-valor') as HTMLInputElement;
  if (valEl) valEl.value = '';
  render();
});

$('#sim-limpar')?.addEventListener('click', () => {
  contasSel().forEach(ct => S.movs.delete(ct));
  render();
});

$('#conta-ant')?.addEventListener('click', () => passoConta(-1));
$('#conta-prox')?.addEventListener('click', () => passoConta(1));

$('#sel-ativo')?.addEventListener('change', e => {
  S.ativo = (e.target as HTMLSelectElement).value;
  const novoAtivoEl = $('#novo-ativo') as HTMLInputElement;
  if (novoAtivoEl) novoAtivoEl.value = '';
  render();
});

$('#novo-ativo')?.addEventListener('change', e => {
  const v = (e.target as HTMLInputElement).value.trim();
  if (!v) return;
  const achado = S.posicoes.find(p => norm(p.nomeAtivo) === norm(v));
  S.ativo = achado ? achado.nomeAtivo || v.toUpperCase() : v.toUpperCase();
  render();
});

$('#alvo')?.addEventListener('input', e => {
  S.alvo = Math.max(0, +(e.target as HTMLInputElement).value || 0) / 100;
  render();
});
$('#minimo')?.addEventListener('input', e => {
  S.minimo = Math.max(0, +(e.target as HTMLInputElement).value || 0);
  render();
});

$('#btn-exportar')?.addEventListener('click', () => exportarSimulacao());

segmentado('#seg-modo-ativo', v => { S.ativoModo = v as any; render(); });

$('#busca-varios')?.addEventListener('change', e => {
  const input = e.target as HTMLInputElement;
  const v = input.value.trim();
  if (!v) return;
  const achado = norm(v) === norm(SALDO_CONTA) ? { nomeAtivo: SALDO_CONTA } : S.posicoes.find(p => norm(p.nomeAtivo) === norm(v));
  if (achado && achado.nomeAtivo && !S.ativosSel.includes(achado.nomeAtivo)) {
    S.ativosSel.push(achado.nomeAtivo);
  }
  input.value = '';
  render();
  input.focus();
});

$('#chips-sel')?.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('[data-tirar-ativo]') as HTMLElement;
  if (b && b.dataset.tirarAtivo) {
    S.ativosSel = S.ativosSel.filter(n => n !== b.dataset.tirarAtivo);
    render();
  }
});

$('#btn-pos-excel')?.addEventListener('click', () => exportarPosicao());
$('#btn-pos-pdf')?.addEventListener('click', () => pdfPosicao());

$('#abas')?.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button');
  if (b && b.dataset.aba) irPara(b.dataset.aba);
});

// Janelas (dialog)
// Uma janela que fecha e logo abre outra no mesmo dialog (ex.: Extratos → Substituir): o aviso "close" da primeira
// chega atrasado, com a segunda já aberta, e a cancelava. Aviso de fechamento com a janela aberta é ignorado.
document.addEventListener('close', e => { if ((e.target as HTMLDialogElement).open) e.stopImmediatePropagation(); }, true);
document.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('dialog form[method="dialog"] button[value]') as HTMLButtonElement;
  if (!b) return;
  e.preventDefault();
  if (!b.hasAttribute('formnovalidate') && b.value !== 'cancelar' && !b.form?.reportValidity()) return;
  (b.closest('dialog') as HTMLDialogElement)?.close(b.value);
}, true);

document.addEventListener('keydown', e => {
  const target = e.target as HTMLElement;
  if (e.key !== 'Enter' || target.tagName !== 'INPUT' || !target.closest('dialog form[method="dialog"]')) return;
  const form = (target as HTMLInputElement).form;
  const ok = form?.querySelector('button.btn-pri[value]') as HTMLElement;
  if (ok) {
    e.preventDefault();
    ok.click();
  }
}, true);

// Cliques gerais: delegação
document.addEventListener('click', e => {
  const target = e.target as HTMLElement;
  const ac = target.closest('[data-acao]') as HTMLElement;
  if (ac && ac.dataset.acao) {
    const [tipo, ...resto] = ac.dataset.acao.split(':');
    const alvo = resto.join(':');
    if (tipo === 'abrir') {
      S.abertas.has(alvo) ? S.abertas.delete(alvo) : S.abertas.add(alvo);
      render();
    }
    if (tipo === 'ativo') {
      S.ativo = alvo;
      const novoAtivoEl = $('#novo-ativo') as HTMLInputElement;
      if (novoAtivoEl) novoAtivoEl.value = '';
      irPara('ativo');
    }
    if (tipo === 'conta') abrirConta(alvo);
    if (tipo === 'unidade') abrirUnidade(alvo);
    if (tipo === 'rmfonte') removerFonte(alvo);
    if (tipo === 'addposicao') anexarExtrato({ modo: 'posicao' });
    if (tipo === 'addextrato') anexarExtrato({ modo: 'extrato' });
    if (tipo === 'extratos') abrirExtratos();
    if (tipo === 'politicas') abrirPoliticas();
    if (tipo === 'irbase') irPara('base');
    if (tipo === 'modelo-politica') baixarModeloPoliticaExcel();
    if (tipo === 'atualizarpasta') atualizarComPasta();
    if (tipo === 'salvarcad') salvarNovos();
    if (tipo === 'relatorio') gerarRelatorio();
    if (tipo === 'modelo') baixarModelo();
    if (tipo === 'rmmov') {
      const [ct, i] = alvo.split('|');
      S.movs.get(ct)?.splice(+i, 1);
      render();
    }
    return;
  }

  const trU = target.closest('tr[data-ir-unidade]') as HTMLElement;
  if (trU && trU.dataset.irUnidade) {
    abrirUnidade(trU.dataset.irUnidade);
    return;
  }
  const th = target.closest('th[data-k]') as HTMLElement;
  if (th && th.dataset.tab && th.dataset.k) {
    const id = th.dataset.tab, k = th.dataset.k, atual = S.ordem[id];
    S.ordem[id] = { k, dir: atual && atual.k === k ? -atual.dir : (th.classList.contains('n') ? -1 : 1) };
    render();
    return;
  }
  const trA = target.closest('tr[data-ir-ativo]') as HTMLElement;
  if (trA && trA.dataset.irAtivo) {
    S.ativo = trA.dataset.irAtivo;
    const novoAtivoEl = $('#novo-ativo') as HTMLInputElement;
    if (novoAtivoEl) novoAtivoEl.value = '';
    irPara('ativo');
    return;
  }
  const trC = target.closest('tr[data-ir-conta]') as HTMLElement;
  if (trC && trC.dataset.irConta) {
    abrirConta(trC.dataset.irConta);
  }
});

// Tooltip
const tip = $('#tip');
if (tip) {
  document.addEventListener('mousemove', e => {
    const alvo = (e.target as HTMLElement).closest('[data-tip]') as HTMLElement;
    if (!alvo || !alvo.dataset.tip) {
      tip.style.display = 'none';
      return;
    }
    const linhas = alvo.dataset.tip.split('\n');
    tip.innerHTML = `<b>${esc(linhas[0])}</b>` + linhas.slice(1).map(l => `<div>${esc(l)}</div>`).join('');
    tip.style.display = 'block';
    const r = tip.getBoundingClientRect();
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - 14;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  });
}

// Inicialização da aplicação
async function bootstrap() {
  if (!Array.isArray((window as any).CADASTRO_CLIENTES)) {
    const c = lerLocal(CHAVE_CAD_ARQ, null);
    if (c && Array.isArray(c.clientes)) aplicarCadastro(c);
  }
  S.cadExtra = carregarCadLocal();
  limparCadLocal();
  mostrarUsuario();
  conferirVersao();

  const emVisualizador = (() => {
    try {
      return window.top !== window.self;
    } catch {
      return true;
    }
  })() || /sharepoint|onedrive|officeapps|usercontent|live\.com/i.test(location.hostname);

  if (emVisualizador) {
    const errEl = $('#erro');
    if (errEl) {
      errEl.innerHTML = `<b>Você está vendo o B.I. pela pré-visualização do OneDrive/SharePoint, que bloqueia parte dele</b> (leitor de Excel, dados salvos e janelas).<br>
        Para usar: abra o <b>Explorador de Arquivos</b> do Windows → <b>OneDrive → Consolidações → Posições → B.I</b> e dê dois cliques em <b>painel.html</b> (abre no Edge, Chrome ou Firefox).
        Se a pasta não aparecer no computador, no site do OneDrive clique em <b>"Adicionar atalho a Meus arquivos"</b> na pasta Consolidações e espere sincronizar.`;
      errEl.hidden = false;
    }
  } else {
    if (!lerLocal(CHAVE_USUARIO, '')) perguntarUsuario();
  }

  await restaurarPoliticas();
  await restaurarFaixasBase();
  await restaurarBaseBtg();
  await restaurarFundGuide();
  await restaurarFontes();
  avisarPlanilhaAntiga();

  if (S.baseBtg.length > 0 && S.posicoes.length === 0) {
    const vazioEl = $('#vazio');
    if (vazioEl) vazioEl.hidden = true;
    const painelEl = $('#painel');
    if (painelEl) painelEl.hidden = false;
    const controlesEl = $('#controles');
    if (controlesEl) controlesEl.hidden = false;
    const abasEl = $('#abas');
    if (abasEl) abasEl.hidden = false;
    renderFontes();
    irPara('base');
  } else {
    render();
  }
}

bootstrap();
