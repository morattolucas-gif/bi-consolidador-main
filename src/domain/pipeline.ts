import { S } from './state';
import { montarPosicao } from '../parsers/btg';
import { montarClientes } from './calculations';
import { somaLista } from './precision';
import { numero, chaveConta, inteiro, brl } from '../components/formatters';
import { salvarFontes, registrar, usuario } from './storage';
import { $ } from '../components/dom';
import type { FonteExtrato, Posicao } from '../types';

let callbacks: {
  renderFontes?: () => void;
  irPara?: (aba: string, primeira?: boolean) => void;
  render?: () => void;
} = {};

export function registrarCallbacksUI(cb: typeof callbacks) {
  callbacks = { ...callbacks, ...cb };
}

export function adicionarFonte(f: Partial<FonteExtrato> & { id: string; inst: string; registros: any[] }) {
  if (f.id !== 'EXEMPLO') S.fontes.delete('EXEMPLO');
  f.total = somaLista(f.registros, r => numero(r.bruto) || 0);
  if (f.id !== 'EXEMPLO') {
    f.enviadoEm = new Date().toISOString();
    f.enviadoPor = usuario();
    if (f.combinado) {
      delete f.combinado;
      S.fontes.set(f.id, f as FonteExtrato);
      salvarFontes();
      recalcular();
      return;
    }
    const antes = S.fontes.get(f.id);
    const desc =
      f.id === 'BTG'
        ? `${f.arquivo || ''} · ${f.rotulo}${f.dataRef ? ` · posição de ${f.dataRef}` : ''}`
        : `${f.inst} · ${f.rotulo} · ${brl(f.total)}${f.dataRef ? ` · referência ${f.dataRef}` : ''} · ${f.arquivo || ''}`;
    registrar(
      f.id === 'BTG' ? 'Planilha do BTG carregada' : antes ? 'Extrato substituído' : 'Extrato incluído',
      antes && f.id !== 'BTG' ? `${desc} (antes: ${antes.arquivo || '–'}${antes.dataRef ? `, referência ${antes.dataRef}` : ''})` : desc
    );
  }
  S.fontes.set(f.id, f as FonteExtrato);
  salvarFontes();
  recalcular();
  if (f.id === 'BTG') {
    const el = $('#aviso-antigo');
    if (el) el.hidden = true;
  }
}

export function removerFonte(id: string) {
  const f = S.fontes.get(id);
  if (f && id !== 'EXEMPLO') registrar('Fonte removida', `${f.inst} · ${f.rotulo || ''} · ${f.arquivo || ''}`);
  S.fontes.delete(id);
  salvarFontes();
  if (!S.fontes.size) {
    location.reload();
    return;
  }
  recalcular();
}

export function recalcular() {
  const contasComExtrato = new Set(
    [...S.fontes.values()].filter(f => f.contaBTG).map(f => chaveConta(f.contaBTG))
  );
  const regs = [...S.fontes.values()].flatMap(f =>
    f.registros
      .filter(r => !(f.id === 'BTG' && contasComExtrato.has(chaveConta(r.conta))))
      .map(r => ({ instituicao: f.inst, ...r }))
  );
  const posicoes = regs.map(montarPosicao).filter((p): p is Posicao => p !== null);
  const exemplo = S.fontes.has('EXEMPLO');
  Object.assign(S, { posicoes, exemplo });
  const { clientes, familias, porConta } = montarClientes(posicoes, exemplo);
  Object.assign(S, { clientes, familias, clientePorConta: porConta });

  const insts = [...new Set(posicoes.map(p => p.instituicao))];
  const temPos = posicoes.length > 0;
  const temBase = (S.baseBtg && S.baseBtg.length > 0);
  const temDados = temPos || temBase;
  const primeira = !temDados;

  const fonteEl = $('#fonte');
  if (fonteEl) {
    if (temPos) {
      fonteEl.textContent = `${insts.join(' + ')} · ${inteiro(S.clientes.size)} ${
        S.clientes.size === 1 ? 'cliente' : 'clientes'
      }`;
    } else if (temBase) {
      fonteEl.textContent = `Base BTG · ${inteiro(S.baseBtg.length)} contas (CRM)`;
    }
  }
  const erroEl = $('#erro');
  if (erroEl) erroEl.hidden = true;
  const vazioEl = $('#vazio');
  if (vazioEl && temDados) vazioEl.hidden = true;
  const painelEl = $('#painel');
  if (painelEl && temDados) painelEl.hidden = false;
  const controlesEl = $('#controles');
  if (controlesEl && temDados) controlesEl.hidden = false;
  const abasEl = $('#abas');
  if (abasEl) abasEl.hidden = false;
  const faixaExemploEl = $('#faixa-exemplo');
  if (faixaExemploEl) faixaExemploEl.hidden = !exemplo;

  if (callbacks.renderFontes) callbacks.renderFontes();
  const destino = S.aba === 'base' || (temBase && !temPos) ? 'base' : (primeira ? 'carteira' : S.aba);
  if (callbacks.irPara) callbacks.irPara(destino, primeira);
}
