import * as XLSX from 'xlsx';
import { norm, esc, num, brl, dataBR, chaveConta, nomeProprio } from '../components/formatters';
import { somaLista, multPrecisa, arredondarFinanceiro } from '../domain/precision';
import { S } from '../domain/state';
import { montarPosicao, ehExtratoBTG, lerExtratoBTG, lerPlanilha, data } from './btg';
import { ehPoliticasExcel, lerPoliticasExcel } from './politicas-excel';
import { lerExcelPadrao } from './excel-padrao';
import { lerPdfLinhas, lerExtratoPdf } from './pdf-reader';
import { lerFoto, lerFotoExtrato } from './ocr';
import { buscarPtax } from './nomad';
import { reconciliar } from './reconciliar';
import { idbBanco, salvarPoliticas, gravarLocal, registrar, donoPorPasta, lembrarDonoPasta } from '../domain/storage';
import { cadastroDe } from '../domain/calculations';
import { adicionarFonte, recalcular } from '../domain/pipeline';
import { CHAVE_CAD_ARQ } from '../domain/constants';
import { $ } from '../components/dom';
import type { ExtratoLido, ExtratoRegistro } from '../types';

let modalDonoHandler: ((ext: ExtratoLido) => Promise<any>) | null = null;
export function setModalDonoHandler(handler: (ext: ExtratoLido) => Promise<any>) {
  modalDonoHandler = handler;
}

export const emVisualizador = (() => {
  try { return typeof window !== 'undefined' && window.top !== window.self; } catch { return true; }
})();

export const temPastaLembrada = typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';

export async function guardarPasta(h: any) {
  try {
    const db = await idbBanco();
    await new Promise<void>((ok, falha) => {
      const tx = db.transaction('pasta', 'readwrite');
      tx.objectStore('pasta').put(h, 'posicoes');
      tx.oncomplete = () => ok();
      tx.onerror = () => falha(tx.error);
    });
  } catch {}
}

export async function pastaGuardada(): Promise<any> {
  try {
    const db = await idbBanco();
    return await new Promise(ok => {
      const r = db.transaction('pasta').objectStore('pasta').get('posicoes');
      r.onsuccess = () => ok(r.result || null);
      r.onerror = () => ok(null);
    });
  } catch {
    return null;
  }
}

export async function arquivosDaPasta(h: any, prefixo = h.name): Promise<File[]> {
  const out: File[] = [];
  for await (const [nome, e] of (h as any).entries()) {
    const rel = `${prefixo}/${nome}`;
    if (e.kind === 'directory') {
      out.push(...(await arquivosDaPasta(e, rel)));
    } else {
      const f = await e.getFile();
      Object.defineProperty(f, 'webkitRelativePath', { value: rel });
      out.push(f);
    }
  }
  return out;
}

export async function escolherPasta(): Promise<File[]> {
  if (temPastaLembrada && !emVisualizador) {
    try {
      const h = await (window as any).showDirectoryPicker({ id: 'bi-posicoes', mode: 'read' });
      await guardarPasta(h);
      return await arquivosDaPasta(h);
    } catch (e: any) {
      if (e && e.name === 'AbortError') return [];
    }
  }
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file';
    (inp as any).webkitdirectory = true;
    inp.multiple = true;
    inp.onchange = () => resolve([...(inp.files || [])]);
    inp.oncancel = () => resolve([]);
    inp.click();
  });
}

export function chavePosicao(r: any): string {
  const venc = data(r.vencimento);
  return [norm(r.produto || r.ativo || ''), venc ? venc.toISOString().slice(0, 10) : '', norm(r.taxaTexto || '').replace(/\s+/g, '')].join('|');
}

export function combinarComExistente(ext: ExtratoLido, dono: any, id: string) {
  const chaves = new Set(dono.regs.map(chavePosicao));
  const cand = [...S.fontes.values()].filter(
    f => f.id !== 'BTG' && f.id !== 'EXEMPLO' && f.inst === dono.inst && (f.id === id || f.registros.some(r => norm(r.nome) === norm(dono.cliente)))
  );
  for (const f of cand) {
    const iguais = f.registros.filter(r => chaves.has(chavePosicao(r))).length;
    if (f.id !== id && iguais < Math.max(1, Math.min(f.registros.length, chaves.size) / 2)) continue;
    const dNovo = data(ext.data), dVelho = data(f.dataRef);
    const perto = dNovo && dVelho && Math.abs(+dNovo - +dVelho) <= 10 * 864e5;
    if (iguais && perto && (ext.modelo || '') !== (f.modelo || '')) {
      const novoMaisRecente = +dNovo >= +dVelho;
      const mapa = new Map(f.registros.map(r => [chavePosicao(r), r]));
      for (const r of dono.regs) {
        const k = chavePosicao(r);
        if (!mapa.has(k) || novoMaisRecente) mapa.set(k, r);
      }
      return { id: f.id, regs: [...mapa.values()], combinado: f, dataRef: novoMaisRecente ? ext.data : f.dataRef };
    }
    return { id: f.id, regs: dono.regs, substitui: f };
  }
  return { id, regs: dono.regs };
}

export function incluirExtrato(ext: ExtratoLido, dono: any) {
  const nomeArq = ext.arquivo;
  const comb = combinarComExistente(ext, dono, `${dono.inst}|${dono.conta || nomeArq}`);
  if (comb.combinado) {
    const f0 = comb.combinado;
    registrar('Extratos combinados', `${dono.inst} · ${f0.arquivo} + ${nomeArq} (mesmas aplicações em formatos diferentes: cada uma contada uma vez)`);
    adicionarFonte({
      ...f0,
      combinado: true,
      arquivo: `${f0.arquivo} + ${nomeArq}`,
      modelo: `${f0.modelo || ''}+${ext.modelo || ''}`,
      dataRef: comb.dataRef,
      registros: comb.regs.map((r: any) => ({ ...r, conta: f0.registros[0]?.conta || r.conta, nome: dono.cliente, data: r.data || ext.data }))
    });
    return;
  }
  if (comb.substitui && comb.id !== `${dono.inst}|${dono.conta || nomeArq}`) {
    S.fontes.delete(comb.id);
  }
  adicionarFonte({
    id: `${dono.inst}|${dono.conta || nomeArq}`,
    inst: dono.inst,
    contaBTG: ext.contaBTG || null,
    dataRef: ext.data || null,
    modelo: ext.modelo || `${dono.inst}-${ext.tipo || ''}`,
    rotulo: `${nomeProprio(dono.cliente).split(' ')[0]} ${dono.conta}`.trim(),
    arquivo: nomeArq,
    registros: dono.regs.map((r: any) => ({ ...r, conta: dono.contaFull || `${dono.inst} ${nomeArq}`, nome: dono.cliente, data: ext.data }))
  });
}

export function macroMaisRecente(ext: ExtratoLido): string | null {
  if (!ext.contaBTG) return null;
  const linhas = S.fontes.get('BTG')?.registros?.filter(p => chaveConta(p.conta) === chaveConta(ext.contaBTG)) || [];
  if (!linhas.length) return null;
  const dm = new Date(Math.max(...linhas.map(p => +(data(p.data) || 0))));
  const m = String(ext.data || '').match(/(\d{2})\/(\d{2})\/(\d{4})/),
    de = m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
  if (de && +dm && +de > +dm) return null;
  return +dm ? dataBR(dm) : 'sem data';
}

export function incluirMacro(regs: any[], nomeArq: string) {
  const ds = regs.map(r => data(r.data)).filter(Boolean);
  adicionarFonte({
    id: 'BTG',
    inst: 'BTG',
    rotulo: `${new Set(regs.map(r => r.conta)).size} contas`,
    arquivo: nomeArq,
    registros: regs,
    dataRef: ds.length ? dataBR(new Date(Math.max(...ds.map(d => +d)))) : null
  });
}

export async function lerArquivo(arquivo: Blob | File, opc: { tipo?: string; inst?: string } = {}): Promise<any> {
  const nomeArq = (arquivo as File).name || 'arquivo';
  const tipo =
    opc.tipo ||
    (/\.pdf$/i.test(nomeArq)
      ? 'pdf'
      : /^image\//.test(arquivo.type) || /\.(png|jpe?g|webp|bmp)$/i.test(nomeArq)
      ? 'foto'
      : 'excel');
  const progresso = (msg: string) => {
    const a = $('#aviso-carga');
    if (a) {
      a.textContent = msg;
      a.hidden = !msg;
    }
  };
  let ext: ExtratoLido;
  try {
    progresso(`Lendo ${nomeArq}…`);
    const buffer = tipo === 'foto' ? null : await arquivo.arrayBuffer();
    if (tipo === 'excel') {
      const wb = XLSX.read(buffer, { type: 'array' });
      if (ehPoliticasExcel(wb)) {
        return { politicas: lerPoliticasExcel(wb) };
      }
      if (ehExtratoBTG(wb)) ext = lerExtratoBTG(wb);
      else {
        try {
          return { macro: lerPlanilha(buffer!) };
        } catch {
          ext = lerExcelPadrao(buffer!);
          if (!ext.inst && opc.inst) ext.inst = opc.inst;
        }
      }
    } else if (tipo === 'pdf') {
      ext = lerExtratoPdf(await lerPdfLinhas(buffer!), opc.inst);
    } else {
      ext = lerFotoExtrato(await lerFoto(arquivo, progresso), opc.inst);
      if (!ext.inst && opc.inst) ext.inst = opc.inst;
    }
  } finally {
    progresso('');
  }
  ext!.arquivo = nomeArq;
  ext!.avisos = ext!.avisos || [];
  ext!.tipo = tipo;
  reconciliar(ext!);
  return { ext };
}

export async function processarArquivo(arquivo: Blob | File, opc: { tipo?: string; inst?: string } = {}): Promise<any> {
  const r = await lerArquivo(arquivo, opc);
  if (r.politicas) {
    for (const [conta, pol] of r.politicas) {
      S.politicasPorConta.set(conta, pol);
    }
    await salvarPoliticas();
    registrar('Políticas importadas', `${r.politicas.size} contas atualizadas via ${(arquivo as File).name || 'Excel'}`);
    recalcular();
    alert(`Políticas de Investimento carregadas com sucesso: ${r.politicas.size} contas atualizadas.`);
    return { politicas: true };
  }
  if (r.macro) {
    incluirMacro(r.macro, (arquivo as File).name || 'arquivo');
    return { macro: true };
  }
  const dm = macroMaisRecente(r.ext);
  if (
    dm &&
    !confirm(
      `A conta ${r.ext.contaBTG} já está na planilha diária do BTG (posição de ${dm}), que é igual ou mais recente que este extrato${
        r.ext.data ? ` (${r.ext.data})` : ''
      }.\n\nUsar o extrato mesmo assim? Ele substitui as linhas dessa conta vindas da planilha.`
    )
  )
    return null;

  if (!modalDonoHandler) throw new Error('Handler de conferência de dono não configurado.');
  const dono = await modalDonoHandler(r.ext);
  if (!dono || !dono.regs.length) return null;
  incluirExtrato(r.ext, dono);
  return dono;
}

export async function processarArquivos(arquivos: (Blob | File)[], opc: { tipo?: string; inst?: string } = {}) {
  for (const a of arquivos) {
    try {
      await processarArquivo(a, opc);
    } catch (e: any) {
      const errEl = $('#erro');
      if (errEl) {
        errEl.textContent = `${(a as File).name || 'arquivo'}: ${e.message || e}`;
        errEl.hidden = false;
      }
    }
  }
}

export function interpretarCadastro(texto: string) {
  const lista = (nome: string) => {
    const i = texto.indexOf(nome);
    if (i < 0) return null;
    const ini = texto.indexOf('[', i),
      fim = texto.indexOf('];', ini);
    if (ini < 0 || fim < 0) return null;
    const json = texto
      .slice(ini, fim + 1)
      .replace(/\/\/[^\n]*/g, '')
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/'([^'\\]*)'/g, (_m, s) => JSON.stringify(s))
      .replace(/,\s*([\]}])/g, '$1');
    return JSON.parse(json);
  };
  const clientes = lista('CADASTRO_CLIENTES');
  if (!Array.isArray(clientes)) throw new Error('o arquivo não tem o cadastro de clientes (CADASTRO_CLIENTES)');
  return { clientes, apelidos: lista('APELIDOS_CLIENTES') || [] };
}

export function aplicarCadastro(cad: { clientes: any[]; apelidos: any[] }) {
  (window as any).CADASTRO_CLIENTES = cad.clientes;
  (window as any).APELIDOS_CLIENTES = cad.apelidos;
}

export async function lerCadastroDaPasta(arquivo: File) {
  const cad = interpretarCadastro(await arquivo.text());
  aplicarCadastro(cad);
  gravarLocal(CHAVE_CAD_ARQ, { ...cad, arquivo: arquivo.name, em: new Date().toISOString() });
  return cad;
}

const INST_NOME_ARQ: [RegExp, string][] = [
  [/\bbtg\b/i, 'BTG'],
  [/\bxp\b/i, 'XP'],
  [/safra/i, 'Safra'],
  [/nomad/i, 'Nomad'],
  [/rhino/i, 'Rhino'],
  [/caixa|\blci\b/i, 'Caixa'],
  [/ita[uú]/i, 'Itaú'],
  [/bradesco/i, 'Bradesco'],
  [/santander/i, 'Santander']
];

export function planoPasta(arquivos: File[]) {
  const cadastros = arquivos.filter(f => /^grupos\.js$/i.test(f.name)).sort((a, b) => b.lastModified - a.lastModified);
  const tipoDe = (n: string) =>
    /\.pdf$/i.test(n) ? 'pdf' : /\.(xlsx|xls|xlsm)$/i.test(n) ? 'excel' : /\.(png|jpe?g|webp|bmp)$/i.test(n) ? 'foto' : null;
  const dataNome = (n: string) => {
    let m = n.match(/(20\d{2})[.\-_ ](\d{2})[.\-_ ](\d{2})/);
    if (m) return `${m[1]}${m[2]}${m[3]}`;
    m = n.match(/(\d{2})[.\-_](\d{2})[.\-_](20\d{2})/);
    return m ? `${m[3]}${m[2]}${m[1]}` : '';
  };
  const itens = arquivos
    .map(f => {
      const partes = (f.webkitRelativePath || f.name).split('/');
      return { f, nome: partes.at(-1)!, partes, tipo: tipoDe(partes.at(-1)!) };
    })
    .filter(x => x.tipo && !/^~\$|^\./.test(x.nome));
  const ignorados = arquivos.length - itens.length;

  const macros = itens.filter(
    x => x.tipo === 'excel' && /posi[cç][aãoõ]/i.test(x.nome) && dataNome(x.nome) && !INST_NOME_ARQ.slice(1).some(([re]) => re.test(x.nome))
  );
  macros.sort((a, b) => dataNome(b.nome).localeCompare(dataNome(a.nome)) || b.f.lastModified - a.f.lastModified);
  const macro = macros[0] || null;

  const ehMes = (s: string) => /^\d{2}[.\-_]\d{2}$/.test(s) || /^20\d{2}[.\-_]\d{2}$/.test(s);
  const chaveMes = (s: string) => {
    const [a, b] = s.split(/[.\-_]/);
    return a.length === 4 ? `${a}${b}` : `20${a}${b}`;
  };
  const porCliente = new Map<string, any>();
  for (const x of itens) {
    if (macros.includes(x)) continue;
    const iMes = x.partes.findIndex((s, i) => i < x.partes.length - 1 && ehMes(s));
    const pastaCliente = iMes > 0 ? x.partes[iMes - 1] : x.partes.at(-2) || '';
    const chave = iMes > 0 ? x.partes.slice(0, iMes).join('/') : x.partes.slice(0, -1).join('/');
    const mes = iMes > 0 ? chaveMes(x.partes[iMes]) : '';
    const inst = (INST_NOME_ARQ.find(([re]) => re.test(x.nome)) || [])[1] || '';
    const g = porCliente.get(chave) || { chave, pastaCliente, mes: '', itens: [], antigos: 0 };
    if (mes > g.mes) {
      g.antigos += g.itens.length;
      g.itens = [];
      g.mes = mes;
    }
    if (mes === g.mes) g.itens.push({ ...x, inst, mes, pastaCliente, chavePasta: chave, rotMes: iMes > 0 ? x.partes[iMes] : '' });
    else g.antigos++;
    porCliente.set(chave, g);
  }
  const grupos = [...porCliente.values()].filter(g => g.itens.length).sort((a, b) => a.pastaCliente.localeCompare(b.pastaCliente, 'pt-BR'));
  return { macro, nMacros: macros.length, grupos, antigos: somaLista(grupos, g => g.antigos), ignorados, cadastro: cadastros[0] || null };
}

export function confirmarPlano(plano: any): Promise<any> {
  return new Promise(resolve => {
    const dlg = $('#dlg-extrato') as HTMLDialogElement | null;
    if (!dlg) return resolve(null);
    const rotTipo: Record<string, string> = { excel: 'Excel', pdf: 'PDF', foto: 'Foto' };
    let n = 0;
    const linhas = plano.grupos
      .map(
        (g: any) =>
          `<tr class="grupo-p"><td colspan="4">${esc(g.pastaCliente || 'Sem pasta de cliente')}${
            g.itens[0].rotMes ? ` · mês ${esc(g.itens[0].rotMes)}` : ''
          }${g.antigos ? ` <span class="muted" style="font-weight:400">(${g.antigos} de meses anteriores ignorados)</span>` : ''}</td></tr>` +
          g.itens
            .map(
              (x: any) =>
                `<tr><td><input type="checkbox" data-i="${n++}" checked aria-label="Ler ${esc(x.nome)}"></td><td>${esc(
                  x.inst || '?'
                )}</td><td>${rotTipo[x.tipo]}</td><td>${esc(x.nome)}</td></tr>`
            )
            .join('')
      )
      .join('');

    dlg.innerHTML = `<form method="dialog" class="dlg dlg-largo">
      <h2>Ler a pasta de posições</h2>
      <p class="sec">${
        plano.macro
          ? `Planilha do BTG: <b>${esc(plano.macro.nome)}</b>${plano.nMacros > 1 ? ` (a mais recente de ${plano.nMacros})` : ''}.`
          : 'Nenhuma planilha diária do BTG encontrada (nome com data e "Posições").'
      }
        ${plano.grupos.length ? ` Extratos de outras instituições: o mês mais recente de cada cliente.` : ''}</p>
      ${plano.macro ? `<label class="opcao" style="margin:8px 0"><input type="checkbox" name="macro" checked> Carregar a planilha do BTG (substitui a que está no painel)</label>` : ''}
      ${plano.grupos.length ? `<div class="plano-pasta"><table><thead><tr><th></th><th>Instituição</th><th>Tipo</th><th>Arquivo</th></tr></thead><tbody>${linhas}</tbody></table></div>` : ''}
      <p class="sec" style="font-size:12px">Extrato de conta já cadastrada entra direto. Conta nova, foto ou extrato cuja soma não bate com o total abrem a conferência para você escolher o dono. Fotos levam alguns segundos cada.</p>
      <div class="dlg-botoes"><button value="cancelar" class="btn" formnovalidate>Cancelar</button><button value="ok" class="btn btn-pri">Ler</button></div>
    </form>`;

    dlg.onclose = () => {
      if (dlg.returnValue !== 'ok') return resolve(null);
      const marcados = new Set([...dlg.querySelectorAll<HTMLInputElement>('input[data-i]:checked')].map(c => +c.dataset.i!));
      const extratos = plano.grupos.flatMap((g: any) => g.itens).filter((_: any, i: number) => marcados.has(i));
      resolve({ macro: dlg.querySelector<HTMLInputElement>('input[name=macro]')?.checked ? plano.macro : null, extratos });
    };
    dlg.showModal();
  });
}

export async function donoAutomatico(ext: ExtratoLido, x: any): Promise<any> {
  const lembrada = donoPorPasta()[`${x.chavePasta}|${ext.inst}`];
  if (!ext.conta && lembrada) ext.conta = lembrada.replace(new RegExp('^' + ext.inst + '\\s+'), '');
  if (!ext.conta || ext.tipo === 'foto' || ext.regs.some(r => r.produto === 'Outros (não detalhado)')) return null;
  const cf = ext.inst === 'BTG' ? ext.conta : `${ext.inst} ${ext.conta}`;
  const cad = cadastroDe(cf);
  if (!cad) return null;
  let regs = ext.regs.map(r => ({ ...r }));
  if (ext.moeda === 'USD') {
    const px = await buscarPtax();
    if (!px) return null;
    regs = regs.map(r => {
      const valBrl = arredondarFinanceiro(multPrecisa(r.usd || 0, px.cambio), 2);
      return { ...r, cambio: px.cambio, cambioData: px.data, bruto: valBrl, liquido: valBrl };
    });
    ext.avisoAuto = `câmbio PTAX ${num(px.cambio, 4)}`;
  }
  return { inst: ext.inst, conta: ext.conta, contaFull: cf, cliente: cad.cliente, regs };
}

export async function lerPasta(opc: { auto?: boolean; arquivos?: File[] } = {}) {
  const auto = !!opc.auto;
  const arquivos = opc.arquivos || (await escolherPasta());
  if (!arquivos.length) return;
  const plano = planoPasta(arquivos);
  if (!plano.macro && !plano.grupos.length) {
    if (!auto) alert('Não encontrei planilhas, PDFs ou fotos nesta pasta.');
    return;
  }
  const jaCarregado = (nome: string) => [...S.fontes.values()].some(f => f.arquivo === nome);
  const escolha = auto
    ? {
        macro: plano.macro && !jaCarregado(plano.macro.nome) ? plano.macro : null,
        extratos: plano.grupos.flatMap(g => g.itens).filter(x => !jaCarregado(x.nome))
      }
    : await confirmarPlano(plano);
  if (!escolha) return;

  const resultado: any[] = [], pendentes: any[] = [];
  if (plano.cadastro) {
    try {
      const c = await lerCadastroDaPasta(plano.cadastro);
      resultado.push({ st: 'ok', nome: plano.cadastro.name, txt: `cadastro de clientes: ${c.clientes.length} contas` });
      if (S.fontes.size) recalcular();
    } catch (e: any) {
      resultado.push({ st: 'er', nome: plano.cadastro.name, txt: `cadastro não lido: ${e.message || e}` });
    }
  }

  const progresso = (msg: string) => {
    const a = $('#aviso-carga');
    if (a) {
      a.textContent = msg;
      a.hidden = !msg;
    }
  };

  if (escolha.macro) {
    try {
      progresso(`Lendo ${escolha.macro.nome}…`);
      const r = await lerArquivo(escolha.macro.f, { tipo: 'excel' });
      if (r.macro) {
        incluirMacro(r.macro, escolha.macro.nome);
        resultado.push({ st: 'ok', nome: escolha.macro.nome, txt: `posição da base: ${new Set(r.macro.map((x: any) => x.conta)).size} contas` });
      } else {
        resultado.push({ st: 'er', nome: escolha.macro.nome, txt: 'não parece a planilha de posição do BTG' });
      }
    } catch (e: any) {
      resultado.push({ st: 'er', nome: escolha.macro.nome, txt: e.message || String(e) });
    } finally {
      progresso('');
    }
  }

  let i = 0;
  for (const x of escolha.extratos) {
    i++;
    if (auto && x.tipo === 'foto') {
      pendentes.push(x);
      resultado.push({ st: 'al', nome: x.nome, txt: 'foto: precisa de conferência' });
      continue;
    }
    try {
      progresso(`Lendo ${i} de ${escolha.extratos.length}: ${x.nome}…`);
      const r = await lerArquivo(x.f, { inst: x.inst, tipo: x.tipo });
      progresso('');
      if (r.macro) {
        resultado.push({ st: 'al', nome: x.nome, txt: 'é uma planilha de posição da base: ignorada (use só a mais recente)' });
        continue;
      }
      const ext = r.ext as ExtratoLido;
      if (!ext.inst) ext.inst = x.inst || 'Outra';
      if (!ext.clienteSugerido && x.pastaCliente) ext.clienteSugerido = x.pastaCliente;
      const dm = macroMaisRecente(ext);
      if (dm) {
        resultado.push({
          st: 'al',
          nome: x.nome,
          txt: `a conta ${ext.contaBTG} já está na planilha diária do BTG (posição de ${dm}, mais recente que o extrato${
            ext.data ? ` de ${ext.data}` : ''
          }): extrato ignorado`
        });
        continue;
      }
      const semConta = !ext.conta;
      let dono = await donoAutomatico(ext, x),
        semPergunta = !!dono;
      if (!dono && auto) {
        pendentes.push(x);
        resultado.push({ st: 'al', nome: x.nome, txt: 'precisa de conferência' });
        continue;
      }
      if (!dono) {
        if (!modalDonoHandler) throw new Error('Handler de conferência de dono não configurado.');
        dono = await modalDonoHandler(ext);
      }
      if (!dono || !dono.regs.length) {
        resultado.push({ st: 'al', nome: x.nome, txt: 'pulado por você' });
        continue;
      }
      if (semConta) lembrarDonoPasta(`${x.chavePasta}|${dono.inst}`, dono.contaFull);
      incluirExtrato(ext, dono);
      const soma = somaLista(dono.regs, (r: any) => r.bruto);
      resultado.push({
        st: 'ok',
        nome: x.nome,
        txt: `${nomeProprio(dono.cliente).split(' ')[0]} · ${dono.contaFull} · ${brl(soma)}${
          semPergunta ? ' · automático' : ' · conferido'
        }${ext.avisoAuto ? ` (${ext.avisoAuto})` : ''}${ext.data ? ` · posição de ${ext.data}` : ''}`
      });
    } catch (e: any) {
      progresso('');
      resultado.push({ st: 'er', nome: x.nome, txt: e.message || String(e) });
    }
  }

  const ok = resultado.filter(r => r.st === 'ok');
  if (ok.length || !auto) {
    registrar(
      auto ? 'Pasta atualizada ao abrir' : 'Pasta lida',
      `${ok.length} de ${resultado.length} arquivos entraram` +
        (resultado.some(r => r.st !== 'ok')
          ? ` · fora: ${resultado.filter(r => r.st !== 'ok').map(r => r.nome).join(', ')}`
          : '')
    );
  }

  if (auto) {
    const box = $('#aviso-pasta');
    if (box) {
      const novaMacro = ok.find(r => escolha.macro && r.nome === escolha.macro.nome);
      const partes = [];
      if (novaMacro) partes.push(`planilha do BTG <b>${esc(escolha.macro.nome)}</b>`);
      if (ok.length - (novaMacro ? 1 : 0)) partes.push(`${ok.length - (novaMacro ? 1 : 0)} extrato(s) novo(s)`);
      if (partes.length) {
        box.innerHTML = `Entrou da pasta: ${partes.join(' e ')}.`;
        box.hidden = false;
      }
    }
  }
}

export async function atualizarComPasta() {
  const box = $('#aviso-pasta');
  const h = await pastaGuardada();
  if (!h) {
    await lerPasta();
    return;
  }
  try {
    if (box) {
      box.textContent = 'Verificando a pasta…';
      box.hidden = false;
    }
    await lerPasta({ auto: true, arquivos: await arquivosDaPasta(h) });
  } catch (e: any) {
    if (box) {
      box.textContent = `Não consegui ler a pasta (${e.message || e}). Use "Ler pasta" no topo.`;
      box.hidden = false;
    }
  }
}

export function avisarPlanilhaAntiga() {
  const f = S.fontes.get('BTG'), box = $('#aviso-antigo');
  if (!box) return;
  const hoje = new Date().toDateString();
  const avisoPasta = $('#aviso-pasta');
  if (!f || !f.enviadoEm || new Date(f.enviadoEm).toDateString() === hoje || (avisoPasta && !avisoPasta.hidden)) {
    box.hidden = true;
    return;
  }
  box.innerHTML = `A planilha do BTG carregada é <b>${esc(f.arquivo || 'a última lida')}</b>${f.dataRef ? ` (posição de ${esc(f.dataRef)})` : ''}, lida em ${new Date(f.enviadoEm).toLocaleDateString('pt-BR')}.
    Se já existe uma mais nova na pasta, <button class="btn-link" id="aviso-ler-pasta">clique aqui para atualizar</button>.`;
  box.hidden = false;
  const btn = $('#aviso-ler-pasta');
  if (btn) btn.onclick = () => atualizarComPasta();
}

