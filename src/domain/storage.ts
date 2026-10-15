import { S } from './state';
import { CHAVE_FONTES, CHAVE_HIST, CHAVE_POLITICAS, CHAVE_PASTA, CHAVE_USUARIO } from './constants';
import { FonteExtrato, PoliticaInvestimento } from '../types';

const memoriaLocal = new Map<string, any>();

export const lerLocal = (k: string, padrao: any = null): any => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? (memoriaLocal.has(k) ? memoriaLocal.get(k) : padrao) : JSON.parse(v);
  } catch {
    return memoriaLocal.has(k) ? memoriaLocal.get(k) : padrao;
  }
};

export const gravarLocal = (k: string, v: any): boolean => {
  memoriaLocal.set(k, v);
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
};

export const usuario = (): string => lerLocal(CHAVE_USUARIO, '') || 'Sem nome';

export function idbBanco(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    if (!('indexedDB' in window)) return falha(new Error('IndexedDB não suportado'));
    const r = indexedDB.open('bi-base-clientes', 2);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('pasta')) db.createObjectStore('pasta');
      if (!db.objectStoreNames.contains('dados')) db.createObjectStore('dados');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => falha(r.error);
  });
}

export async function gravarIDB(chave: string, valor: any): Promise<boolean> {
  memoriaLocal.set(chave, valor);
  try {
    const db = await idbBanco();
    return await new Promise((ok, falha) => {
      const tx = db.transaction('dados', 'readwrite');
      tx.objectStore('dados').put(valor, chave);
      tx.oncomplete = () => ok(true);
      tx.onerror = () => falha(tx.error);
    });
  } catch (e) {
    console.warn('Gravação em IndexedDB falhou, recorrendo a localStorage:', e);
    return gravarLocal(chave, valor);
  }
}

export async function lerIDB(chave: string, padrao: any = null): Promise<any> {
  if (memoriaLocal.has(chave)) return memoriaLocal.get(chave);
  try {
    const db = await idbBanco();
    const res = await new Promise((ok, falha) => {
      const tx = db.transaction('dados', 'readonly');
      const req = tx.objectStore('dados').get(chave);
      req.onsuccess = () => ok(req.result !== undefined ? req.result : null);
      req.onerror = () => falha(tx.error);
    });
    if (res !== null) {
      memoriaLocal.set(chave, res);
      return res;
    }
  } catch (e) {
    console.warn('Leitura de IndexedDB falhou, recorrendo a localStorage:', e);
  }
  return lerLocal(chave, padrao);
}

export function registrar(acao: string, detalhe: string = '') {
  if (S.fontes.has('EXEMPLO') && !/B\.I\./.test(acao)) return;
  const h = lerLocal(CHAVE_HIST, []);
  h.unshift({ em: new Date().toISOString(), quem: usuario(), acao, detalhe });
  gravarLocal(CHAVE_HIST, h.slice(0, 1000));
}

export async function salvarFontes() {
  if (S.fontes.has('EXEMPLO')) return;
  const fs = [...S.fontes.values()].filter(f => f.id !== 'EXEMPLO');
  memoriaLocal.set(CHAVE_FONTES, fs);
  const ok = await gravarIDB(CHAVE_FONTES, fs);
  if (!ok) {
    const errEl = document.getElementById('erro');
    if (errEl) {
      errEl.textContent = 'Não consegui salvar os dados neste navegador (espaço cheio ou bloqueado). Eles valem até fechar a página.';
      errEl.hidden = false;
    }
  }
}

export async function restaurarFontes(): Promise<boolean> {
  let fs = await lerIDB(CHAVE_FONTES, null);
  if (!Array.isArray(fs) || !fs.length) {
    fs = lerLocal(CHAVE_FONTES, []);
  }
  if (!Array.isArray(fs) || !fs.length) return false;
  for (const f of fs as FonteExtrato[]) S.fontes.set(f.id, f);
  return true;
}

export async function salvarPoliticas() {
  const dados = [...S.politicasPorConta.entries()];
  memoriaLocal.set(CHAVE_POLITICAS, dados);
  await gravarIDB(CHAVE_POLITICAS, dados);
}

export async function restaurarPoliticas() {
  let dados = await lerIDB(CHAVE_POLITICAS, null);
  if (!dados) dados = lerLocal(CHAVE_POLITICAS, []);
  if (Array.isArray(dados) && dados.length) {
    S.politicasPorConta = new Map(dados);
  }
}

export function obterPoliticaDe(s: any): PoliticaInvestimento {
  if (!s) return {};
  const contas: string[] = s.tipo === 'familia' ? s.contas : s.tipo === 'cliente' ? s.contas : [s.key];
  for (const c of contas) {
    const p = S.politicasPorConta.get(c);
    if (p) return p;
  }
  return {};
}

export function donoPorPasta(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_PASTA) || '{}');
  } catch {
    return {};
  }
}

export function lembrarDonoPasta(chave: string, contaFull: string) {
  const m = donoPorPasta();
  m[chave] = contaFull;
  try {
    localStorage.setItem(CHAVE_PASTA, JSON.stringify(m));
  } catch {}
}
