import './styles/main.css';
import { S } from './domain/state';
import { CHAVE_CAD_ARQ, CHAVE_USUARIO } from './domain/constants';
import {
  adicionarFonte,
  removerFonte,
  recalcular,
  registrarCallbacksUI
} from './domain/pipeline';
import {
  restaurarFontes,
  restaurarPoliticas,
  lerLocal
} from './domain/storage';
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
  perguntarDono
} from './components/views/modals';
import {
  lerPasta,
  atualizarComPasta,
  processarArquivos,
  avisarPlanilhaAntiga,
  aplicarCadastro,
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

const DIMS: Record<string, string> = {
  classe: 'Classe de ativos',
  subclasse: 'Subclasse',
  estrategia: 'Estratégia de investimento',
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
}

export function irPara(aba: string, rolar: boolean = true) {
  S.aba = aba;
  document.querySelectorAll('.abas button').forEach(b => {
    b.setAttribute('aria-selected', String((b as HTMLElement).dataset.aba === aba));
  });
  document.querySelectorAll('.aba').forEach(s => {
    (s as HTMLElement).hidden = s.id !== 'aba-' + aba;
  });
  render();
  if (rolar) window.scrollTo({ top: 0 });
}

// Configura callback mútuo entre pipeline e UI
registrarCallbacksUI({
  renderFontes: () => {},
  irPara,
  render
});

// Configura handler do leitor de pasta para solicitar dono desconhecido via modal
setModalDonoHandler((ext: any) => perguntarDono(ext));

/* ---------- Eventos ---------- */
$('#btn-anexar')?.addEventListener('click', () => anexarExtrato());
$('#btn-pasta')?.addEventListener('click', () => lerPasta());
$('#btn-politicas')?.addEventListener('click', () => abrirPoliticas());
$('#btn-historico')?.addEventListener('click', () => abrirHistorico());
$('#btn-cadastro')?.addEventListener('click', () => editarCadastro());
$('#btn-usuario')?.addEventListener('click', () => perguntarUsuario());
$('#btn-vazio-pasta')?.addEventListener('click', e => { e.stopPropagation(); lerPasta(); });
$('#btn-vazio-anexar')?.addEventListener('click', e => { e.stopPropagation(); anexarExtrato(); });

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
  const achado = S.posicoes.find(p => norm(p.nomeAtivo) === norm(v));
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
    if (tipo === 'addextrato') anexarExtrato();
    if (tipo === 'extratos') abrirExtratos();
    if (tipo === 'politicas') abrirPoliticas();
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
  await restaurarFontes();
  avisarPlanilhaAntiga();
  render();
}

bootstrap();
