import * as XLSX from 'xlsx';
import { $ } from '../dom';
import { esc, norm, num, brl, brlCurto, chaveConta, pct } from '../formatters';
import { somaLista, somaPrecisa, multPrecisa, arredondarFinanceiro } from '../../domain/precision';
import { S } from '../../domain/state';
import { cadastroDe, nomesFamilias, associacoesNovas, clienteDaConta } from '../../domain/calculations';
import { contasSel } from '../../domain/simulator';
import { recalcular, removerFonte } from '../../domain/pipeline';
import { salvarPoliticas, registrar, gravarLocal, lerLocal } from '../../domain/storage';
import { CHAVE_CAD, CHAVE_HIST, CHAVE_USUARIO, CHAVE_VERSAO, VERSOES_BI, VERSAO_BI } from '../../domain/constants';
import { buscarPtax } from '../../parsers/nomad';
import { processarArquivos, atualizarComPasta, setModalDonoHandler } from '../../parsers/pasta';
import { baixarModeloPoliticaExcel, lerPoliticasExcel } from '../../parsers/politicas-excel';
import type { ExtratoLido, ExtratoRegistro } from '../../types';

export const INSTITUICOES = [
  ['BTG', 'BTG Pactual'],
  ['XP', 'XP Investimentos'],
  ['Safra', 'Safra'],
  ['Caixa', 'Caixa Econômica'],
  ['Nomad', 'Nomad'],
  ['Rhino', 'Rhino Securitizadora']
];

export function dicaAnexo(inst: string, tipo: string): string {
  if (tipo === 'foto') return 'Print ou foto legível do aplicativo ou do extrato. O painel lê o texto (no próprio navegador) e mostra uma tabela para você conferir antes de adicionar.';
  if (inst === 'BTG' && tipo === 'excel') return 'Pode ser a posição da base inteira (relatório "Posição") ou o extrato de um cliente ("Extrato da Conta Investimento"). O painel reconhece sozinho.';
  if (inst === 'BTG' && tipo === 'pdf') return 'Extrato da Conta Investimento em PDF. O Excel do mesmo extrato também funciona.';
  if (inst === 'Caixa' && tipo === 'pdf') return 'Informativo mensal de LCI ou "Saldo em carteira" da Caixa (os dois mostram as mesmas aplicações: use um deles).';
  if (inst === 'XP' && tipo === 'pdf') return 'Relatório "Posição Consolidada" da XP.';
  if (inst === 'Safra' && tipo === 'pdf') return 'Relatório Diário do Safra (posição de investimentos).';
  if (inst === 'Nomad') return 'Lista de posições em dólar. O painel converte para reais pelo câmbio (PTAX), que você pode ajustar.';
  if (tipo === 'excel') return 'Excel no formato padrão do painel. <button type="button" class="btn-link" data-acao="modelo">Baixar o modelo</button>';
  return 'PDFs reconhecidos: BTG, XP, Safra, Caixa e Nomad. Para outra instituição, use foto (com conferência) ou o Excel padrão.';
}

export function escolherAnexo(padrao: { inst?: string } = {}): Promise<any> {
  return new Promise(resolve => {
    const dlg = $('#dlg-extrato') as HTMLDialogElement;
    if (!dlg) return resolve(null);
    dlg.innerHTML = `<form method="dialog" class="dlg">
      <h2>Anexar extrato</h2>
      <div class="dlg-linha">
        <label class="campo"><span class="rotulo">Instituição</span>
          <select name="inst">${INSTITUICOES.map(([v, n]) => `<option value="${v}">${esc(n)}</option>`).join('')}<option value="__outra">Outra…</option></select></label>
        <label class="campo" id="campo-outra" hidden><span class="rotulo">Nome da instituição</span><input type="text" name="instOutra" placeholder="ex.: Itaú"></label>
      </div>
      <div class="campo"><span class="rotulo">Tipo de extrato</span>
        <span class="seg" id="anexo-tipo"><button type="button" data-v="excel" aria-pressed="true">Excel</button><button type="button" data-v="pdf" aria-pressed="false">PDF</button><button type="button" data-v="foto" aria-pressed="false">Foto</button></span></div>
      <p class="sec" id="anexo-dica" style="min-height:2.6em"></p>
      <label class="campo"><span class="rotulo">Arquivo</span><input type="file" name="arq" required></label>
      <div class="dlg-botoes"><button value="cancelar" class="btn" formnovalidate>Cancelar</button><button value="ok" class="btn btn-pri">Ler extrato</button></div>
    </form>`;
    const f = dlg.querySelector('form') as any;
    let tipo = 'excel';
    const atualizar = () => {
      const inst = f.inst.value;
      const outraEl = $('#campo-outra');
      if (outraEl) outraEl.hidden = inst !== '__outra';
      f.arq.accept = ({ excel: '.xlsx,.xls', pdf: '.pdf', foto: 'image/*' } as any)[tipo];
      f.arq.multiple = true;
      const dicaEl = $('#anexo-dica');
      if (dicaEl) dicaEl.innerHTML = dicaAnexo(inst, tipo);
    };
    $('#anexo-tipo')?.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      tipo = b.dataset.v!;
      $('#anexo-tipo')?.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      f.arq.value = '';
      atualizar();
    });
    f.inst.addEventListener('change', () => {
      const p = ({ BTG: 'excel', XP: 'pdf', Safra: 'pdf', Nomad: 'pdf', Rhino: 'foto' } as any)[f.inst.value];
      if (p) ($(`#anexo-tipo button[data-v="${p}"]`) as HTMLElement)?.click();
      else atualizar();
    });
    atualizar();
    if (padrao.inst) {
      if ([...f.inst.options].some((o: any) => o.value === padrao.inst)) {
        f.inst.value = padrao.inst;
        f.inst.dispatchEvent(new Event('change'));
      } else {
        f.inst.value = '__outra';
        f.instOutra.value = padrao.inst;
        atualizar();
      }
    }
    dlg.onclose = () => {
      if (dlg.returnValue !== 'ok' || !f.arq.files.length) return resolve(null);
      const inst = f.inst.value === '__outra' ? f.instOutra.value.trim() || 'Outra' : f.inst.value;
      resolve({ inst, tipo, arquivos: [...f.arq.files] });
    };
    dlg.showModal();
  });
}

export async function anexarExtrato(padrao: { inst?: string } = {}) {
  const escolha = await escolherAnexo(padrao);
  if (escolha) await processarArquivos(escolha.arquivos, { inst: escolha.inst, tipo: escolha.tipo });
}

export const MERCADOS_OPC = [
  'Renda Fixa',
  'Fundos',
  'Previdência',
  'Renda Variável',
  'Internacional',
  'COE',
  'Criptoativos',
  ['Conta Corrente', 'Saldo em conta'],
  'Valores a receber',
  'Derivativos',
  'Outros'
];

export const ESTRATEGIAS_OPC = [
  'Pós-fixado',
  'Inflação',
  'Pré-fixado',
  'Renda Variável',
  'Alternativo',
  'Retorno Absoluto (MM)',
  'Internacional',
  'Caixa',
  'Valores a receber',
  'Derivativos',
  'Sem classificação'
];

export const SUB_PADRAO: Record<string, string> = {
  'Valores a receber': 'VR',
  'Renda Fixa': 'PRIVADO',
  Fundos: 'FN',
  'Previdência': 'PP',
  'Renda Variável': 'ACAO',
  Internacional: 'ETF',
  COE: 'COE',
  Criptoativos: 'CRY',
  'Conta Corrente': 'CC',
  'Valor em Trânsito': 'FN',
  Derivativos: 'Derivativos',
  Outros: 'Outros'
};

export function perguntarDono(ext: ExtratoLido): Promise<any> {
  return new Promise(resolve => {
    const dlg = $('#dlg-extrato') as HTMLDialogElement;
    if (!dlg) return resolve(null);
    const clientes = [...S.clientes.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const familias = nomesFamilias();
    const contaCad = (c: string) => (ext.inst === 'BTG' ? c : `${ext.inst} ${c}`.trim());

    if (!ext.conta && ext.clienteSugerido) {
      const k = norm(ext.clienteSugerido);
      const igual = [...S.fontes.values()].find(f => f.inst === ext.inst && f.registros.some(r => norm(r.nome) === k));
      if (igual) ext.conta = String(igual.registros[0].conta).replace(new RegExp('^' + ext.inst + '\\s+'), '');
    }

    const cad = ext.inst && ext.conta ? cadastroDe(contaCad(ext.conta)) : null;
    let sugerido: any = null;
    if (cad) sugerido = S.clientes.get('p:' + norm(cad.cliente)) || null;
    if (!sugerido && ext.contaBTG) sugerido = clienteDaConta(S.posicoes.find(p => chaveConta(p.conta) === chaveConta(ext.contaBTG))?.conta || '') || null;
    if (!sugerido && ext.clienteSugerido) sugerido = clientes.find(c => norm(c.nome) === norm(ext.clienteSugerido)) || null;

    const usd = ext.moeda === 'USD';
    const rotuloLinha = (r: any) =>
      r.produto && r.ativo && r.produto !== r.ativo && !r.emissor
        ? `${r.ativo} — ${r.produto}`
        : r.ativo && r.emissor
        ? r.ativo
        : r.produto || r.ativo || '';
    const regs = ext.regs.map(r => ({ ...r }));

    const opc = (lista: any[], v: string) => {
      const vals = lista.map(o => (Array.isArray(o) ? o[0] : o));
      return (
        lista
          .map(o => {
            const [val, rot] = Array.isArray(o) ? o : [o, o];
            return `<option value="${esc(val)}" ${val === v ? 'selected' : ''}>${esc(rot)}</option>`;
          })
          .join('') + (v && !vals.includes(v) ? `<option selected>${esc(v)}</option>` : '')
      );
    };

    const linha = (r: any, i: number) => `<tr data-i="${i}">
      <td><input type="text" class="r-nome" value="${esc(rotuloLinha(r))}" data-orig="${esc(rotuloLinha(r))}"></td>
      <td><select class="r-merc">${opc(MERCADOS_OPC, r.mercado)}</select></td>
      <td><select class="r-estr">${opc(ESTRATEGIAS_OPC, r.estrategia || 'Sem classificação')}</select></td>
      <td class="n"><input type="number" step="0.01" class="r-val" value="${usd ? r.usd : r.bruto}"></td>
      <td class="n"><button type="button" class="btn-x" data-rm="${i}" title="Remover linha" aria-label="Remover linha">×</button></td></tr>`;

    dlg.innerHTML = `<form method="dialog" class="dlg dlg-largo">
      <h2>Anexar extrato ${esc(ext.inst || '')}</h2>
      <p class="sec">${esc(ext.arquivo || '')}${ext.data ? ` · posição de ${esc(ext.data)}` : ''}${
      ext.clienteSugerido ? ` · titular no extrato: <b>${esc(ext.clienteSugerido)}</b>` : ''
    }</p>
      ${ext.avisos?.length ? `<ul class="avisos">${ext.avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
      <details class="conferencia" ${ext.revisar ? 'open' : ''}>
        <summary>Conferir posições lidas (<span id="conf-n">${regs.length}</span>) · soma <b id="conf-soma"></b> <span id="conf-total"></span></summary>
        ${
          usd
            ? `<label class="campo" style="max-width:260px;margin:8px 0"><span class="rotulo">Câmbio (R$ por US$)</span><input type="number" step="0.0001" name="cambio" required placeholder="buscando PTAX…"><small class="muted" id="ptax-info"></small></label>`
            : ''
        }
        <div class="tabela-wrap" style="max-height:300px"><table class="conf"><thead><tr><th>Ativo</th><th>Classe</th><th>Estratégia</th><th class="n">${
          usd ? 'Valor (US$)' : 'Valor bruto (R$)'
        }</th><th></th></tr></thead>
          <tbody>${regs.map(linha).join('')}</tbody></table></div>
        <button type="button" class="btn" id="conf-add" style="margin-top:8px">+ Adicionar linha</button>
      </details>
      <div class="dlg-linha">
        <label class="campo"><span class="rotulo">Instituição</span><input type="text" name="inst" value="${esc(
          ext.inst || ''
        )}" required ${ext.inst === 'BTG' ? 'readonly' : ''}></label>
        <label class="campo"><span class="rotulo">Conta</span><input type="text" name="conta" value="${esc(
          ext.conta || ''
        )}" required ${ext.contaBTG ? 'readonly' : ''} placeholder="${ext.conta ? '' : 'número ou apelido da conta'}"></label>
      </div>
      <fieldset class="dlg-dono">
        <legend>De quem é este extrato?</legend>
        ${
          clientes.length
            ? `<label class="opcao"><input type="radio" name="modo" value="existente" ${sugerido ? 'checked' : ''}> Cliente que já está no painel
          <select name="cliente">${clientes
            .map(
              c =>
                `<option value="${esc(c.id)}" ${sugerido && sugerido.id === c.id ? 'selected' : ''}>${esc(c.nome)}${
                  c.familiaNome && c.familiaNome !== c.nome ? ` · ${esc(c.familiaNome)}` : ''
                }</option>`
            )
            .join('')}</select></label>`
            : ''
        }
        <label class="opcao"><input type="radio" name="modo" value="novo" ${sugerido ? '' : 'checked'}> Novo cliente
          <input type="text" name="nome" placeholder="Nome completo" value="${esc(cad?.cliente || ext.clienteSugerido || '')}"></label>
        <label class="opcao sub"><span>Grupo familiar</span>
          <select name="familia"><option value="">Nenhum (cliente sozinho)</option>${familias
            .map(fm => `<option ${cad?.familia === fm ? 'selected' : ''}>${esc(fm)}</option>`)
            .join('')}<option value="__nova">+ Nova família…</option></select>
          <input type="text" name="novaFamilia" placeholder="Nome da nova família" hidden></label>
      </fieldset>
      ${
        ext.contaBTG
          ? `<p class="sec" style="font-size:12px">Este extrato substitui, no painel, as linhas da conta ${esc(
              ext.contaBTG
            )} vindas da posição da base (é mais completo e mais recente).</p>`
          : ''
      }
      <div class="dlg-botoes"><button value="cancelar" class="btn" formnovalidate>Cancelar</button><button value="ok" class="btn btn-pri">Adicionar ao painel</button></div>
    </form>`;

    const f = dlg.querySelector('form') as any,
      corpo = dlg.querySelector('table.conf tbody') as HTMLElement;
    const cambio = () => (usd ? parseFloat(f.cambio.value) || 0 : 1);
    let ptaxUsada: any = null;

    const somar = () => {
      const vals = [...corpo.querySelectorAll<HTMLInputElement>('.r-val')].map(i => parseFloat(i.value) || 0);
      const s = somaPrecisa(...vals);
      const nEl = $('#conf-n');
      if (nEl) nEl.textContent = String(vals.length);
      const somaEl = $('#conf-soma');
      if (somaEl) {
        somaEl.textContent = usd
          ? `US$ ${num(s)}${cambio() ? ` = ${brl(arredondarFinanceiro(multPrecisa(s, cambio()), 2))}` : ''}`
          : brl(s);
      }
      const tot = ext.total;
      const totalEl = $('#conf-total');
      if (totalEl) {
        totalEl.innerHTML = tot
          ? Math.abs(s - tot) < 0.05
            ? `<span class="ok-txt">✓ fecha com o total do extrato</span>`
            : `<span class="al-txt">extrato: ${brl(tot)}</span>`
          : '';
      }
    };

    corpo.addEventListener('input', somar);
    corpo.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest('[data-rm]');
      if (b) {
        b.closest('tr')?.remove();
        somar();
      }
    });

    $('#conf-add')?.addEventListener('click', () => {
      regs.push({
        mercado: 'Outros',
        sub: 'Outros',
        produto: '',
        estrategia: 'Sem classificação',
        bruto: 0,
        liquido: 0,
        usd: 0,
        moeda: ext.moeda,
        _nova: true
      } as any);
      corpo.insertAdjacentHTML('beforeend', linha(regs.at(-1), regs.length - 1));
      somar();
    });

    if (usd) {
      f.cambio.addEventListener('input', somar);
      buscarPtax().then(p => {
        ptaxUsada = p;
        if (p && !f.cambio.value) {
          f.cambio.value = p.cambio.toFixed(4);
          const ptaxEl = $('#ptax-info');
          if (ptaxEl) ptaxEl.textContent = `PTAX de venda de ${p.data.split('-').reverse().join('/')} (Banco Central)`;
          somar();
        } else if (!p) {
          const ptaxEl = $('#ptax-info');
          if (ptaxEl) ptaxEl.textContent = 'Não consegui buscar a PTAX: digite o câmbio.';
        }
      });
    }

    somar();
    f.familia.addEventListener('change', () => {
      f.novaFamilia.hidden = f.familia.value !== '__nova';
    });
    dlg.querySelectorAll('input[name=modo]').forEach(r =>
      r.addEventListener('change', () => {
        if (f.modo.value === 'novo') f.nome.focus();
      })
    );

    dlg.onclose = () => {
      if (dlg.returnValue !== 'ok') return resolve(null);
      const cb = cambio();
      const finais = [...corpo.querySelectorAll('tr')]
        .map(tr => {
          const r = { ...regs[+tr.dataset.i!] };
          const nome = (tr.querySelector('.r-nome') as HTMLInputElement).value.trim(),
            merc = (tr.querySelector('.r-merc') as HTMLSelectElement).value,
            estr = (tr.querySelector('.r-estr') as HTMLSelectElement).value;
          const val = parseFloat((tr.querySelector('.r-val') as HTMLInputElement).value) || 0;
          if (merc !== r.mercado) r.sub = SUB_PADRAO[merc] || merc;
          r.mercado = merc;
          r.estrategia = estr;
          if (nome !== (tr.querySelector('.r-nome') as HTMLInputElement).dataset.orig || (r as any)._nova) {
            r.produto = nome;
            if (!r.emissor) r.ativo = nome;
          }
          if (usd) {
            r.usd = val;
            r.cambio = cb;
            r.cambioData = ptaxUsada && Math.abs(cb - ptaxUsada.cambio) < 1e-6 ? ptaxUsada.data : undefined;
            r.bruto = r.liquido = arredondarFinanceiro(multPrecisa(val, cb), 2);
          } else {
            const ir = (r.bruto || 0) - (r.liquido ?? r.bruto ?? 0);
            r.bruto = val;
            r.liquido = arredondarFinanceiro(val - ir, 2);
          }
          delete (r as any)._nova;
          return r;
        })
        .filter(r => r.bruto);

      const inst = f.inst.value.trim(),
        conta = f.conta.value.trim();
      const cf = inst === 'BTG' ? conta : `${inst} ${conta}`.trim();
      let cliente: string, familia: string | null;

      if (f.modo.value === 'existente' && f.cliente) {
        const c = S.clientes.get(f.cliente.value)!;
        cliente = c.nome;
        familia = c.familiaNome || null;
        for (const ct of c.contas) {
          if (!cadastroDe(ct)) S.cadExtra.set(chaveConta(ct), { conta: ct, cliente, familia: familia || cliente });
        }
      } else {
        cliente = f.nome.value.trim() || ext.clienteSugerido || `Cliente ${cf}`;
        familia = f.familia.value === '__nova' ? f.novaFamilia.value.trim() : f.familia.value;
      }

      if (!cadastroDe(cf) || norm(cadastroDe(cf)?.cliente) !== norm(cliente)) {
        S.cadExtra.set(chaveConta(cf), { conta: cf, cliente, familia: familia || cliente });
        try {
          localStorage.setItem(CHAVE_CAD, JSON.stringify([...S.cadExtra.values()]));
        } catch {}
      }
      resolve({ inst, conta, contaFull: cf, cliente, regs: finais });
    };
    dlg.showModal();
  });
}

setModalDonoHandler(perguntarDono);

export function abrirExtratos() {
  const dlg = $('#dlg-extrato') as HTMLDialogElement;
  if (!dlg) return;
  const fs = [...S.fontes.values()].filter(f => f.id !== 'EXEMPLO');
  const quando = (f: any) => (f.enviadoEm ? new Date(f.enviadoEm).toLocaleDateString('pt-BR') : '–');
  const btg = S.fontes.get('BTG');
  const grupos = new Map<string, any[]>();

  for (const f of fs.filter(f => f.id !== 'BTG')) {
    const c = clienteDaConta(f.registros[0]?.conta);
    const fam = c?.familiaId ? S.familias.get(c.familiaId)?.nome : null;
    const k = fam || c?.nome || 'Sem cliente';
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push({ f, pessoa: c?.nome || '' });
  }

  const linha = ({ f, pessoa }: any, fam: boolean) => `<tr><td><b>${esc(f.inst)}</b></td><td>${esc(
    String(f.registros[0]?.conta || '').replace(new RegExp('^' + f.inst + '\\s+'), '')
  )}${fam && pessoa ? `<br><small class="muted">${esc(pessoa)}</small>` : ''}</td>
    <td class="sec">${esc(f.arquivo || '–')}</td><td>${esc(f.dataRef || '–')}</td><td>${esc(quando(f))}</td><td class="n">${esc(
    brl(f.total)
  )}</td>
    <td class="n" style="white-space:nowrap"><button type="button" class="btn-link" data-subst="${esc(
      f.inst
    )}">Substituir</button> · <button type="button" class="btn-link" data-rm="${esc(f.id)}">Remover</button></td></tr>`;

  const cab =
    '<tr><th>Instituição</th><th>Conta</th><th>Arquivo</th><th>Posição de</th><th>Carregado em</th><th class="n">Valor</th><th></th></tr>';
  const linhaBtg = btg
    ? `<tr class="ext-cli"><td colspan="7">Planilha diária do BTG<small>base de todos os clientes · ${esc(
        btg.rotulo || ''
      )} · ${esc(brl(btg.total))}</small></td></tr>
    <tr class="ext-btg"><td><b>BTG</b></td><td>${esc(btg.rotulo || '')}</td><td class="sec">${esc(
        btg.arquivo || '–'
      )}</td><td>${esc(btg.dataRef || '–')}</td><td>${esc(quando(btg))}</td><td class="n">${esc(brl(btg.total))}</td>
    <td class="n" style="white-space:nowrap"><button type="button" class="btn-link" id="ext-atualizar">Atualizar com a pasta</button> · <button type="button" class="btn-link" data-subst="BTG">Substituir</button></td></tr>`
    : '';

  dlg.innerHTML = `<form method="dialog" class="dlg dlg-largo">
    <h2>Extratos carregados</h2>
    <p class="sec"><b>Posição de</b> = data das posições dentro do arquivo (a planilha do BTG é sempre do dia anterior). <b>Carregado em</b> = quando o arquivo entrou no B.I.</p>
    ${btg ? '' : `<p class="sec">Nenhuma planilha do BTG carregada. <button type="button" class="btn-link" id="ext-atualizar">Atualizar com a pasta</button></p>`}
    <input type="search" id="ext-busca" placeholder="Buscar cliente, instituição ou arquivo…" style="width:100%;margin-top:8px">
    ${
      grupos.size || btg
        ? `<div class="ext-lista"><table><thead>${cab}</thead><tbody>${linhaBtg}
      ${[...grupos.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
        .map(
          ([k, itens]) =>
            `<tr class="ext-cli"><td colspan="7">${esc(k)}<small>${itens.length} ${
              itens.length === 1 ? 'extrato' : 'extratos'
            } · ${esc(brl(somaLista(itens, x => x.f.total)))}</small></td></tr>` +
            itens.map(x => linha(x, grupos.size > 0 && k !== x.pessoa)).join('')
        )
        .join('')}
    </tbody></table></div>`
        : '<p class="sec" style="margin-top:10px">Nenhum extrato de outra instituição carregado.</p>'
    }
    <p class="sec" style="font-size:12px;margin-top:8px">Substituir: anexe o extrato novo da mesma instituição e conta (ex.: Safra de setembro no lugar do de agosto); o anterior sai e fica registrado no histórico.</p>
    <div class="dlg-botoes"><button type="button" class="btn" id="ext-anexar">+ Anexar extrato</button><button value="ok" class="btn btn-pri">Fechar</button></div>
  </form>`;

  $('#ext-busca')?.addEventListener('input', e => {
    const b = norm((e.target as HTMLInputElement).value);
    let cliVisivel = false;
    dlg.querySelectorAll<HTMLTableRowElement>('.ext-lista tbody tr').forEach(tr => {
      if (tr.classList.contains('ext-cli')) {
        cliVisivel = !b || norm(tr.textContent).includes(b);
        tr.hidden = false;
        tr.dataset.casa = cliVisivel ? '1' : '';
        return;
      }
      tr.hidden = b ? !cliVisivel && !norm(tr.textContent).includes(b) : false;
    });
    dlg.querySelectorAll<HTMLTableRowElement>('.ext-lista tr.ext-cli').forEach(tr => {
      let n = tr.nextElementSibling as HTMLTableRowElement | null,
        algum = false;
      while (n && !n.classList.contains('ext-cli')) {
        if (!n.hidden) algum = true;
        n = n.nextElementSibling as HTMLTableRowElement | null;
      }
      tr.hidden = !algum;
    });
  });

  dlg.querySelector('tbody')?.addEventListener('click', async e => {
    const s = (e.target as HTMLElement).closest('[data-subst]') as HTMLElement;
    const r = (e.target as HTMLElement).closest('[data-rm]') as HTMLElement;
    if (s) {
      dlg.close();
      await anexarExtrato({ inst: s.dataset.subst });
      return;
    }
    if (r && confirm('Remover este extrato do painel? (O arquivo na pasta não é apagado.)')) {
      dlg.close();
      removerFonte(r.dataset.rm!);
    }
  });

  const anexarBtn = $('#ext-anexar');
  if (anexarBtn) anexarBtn.onclick = async () => { dlg.close(); await anexarExtrato(); };
  const atualBtn = $('#ext-atualizar');
  if (atualBtn) atualBtn.onclick = async () => { dlg.close(); await atualizarComPasta(); };
  dlg.showModal();
}

export function editarCadastro() {
  if (S.exemplo) {
    alert('O cadastro vale para a base real. Na base fictícia os clientes já vêm agrupados.');
    return;
  }
  const dlg = $('#dlg-extrato') as HTMLDialogElement;
  if (!dlg) return;
  const selContas = new Set(contasSel().map(chaveConta));
  const contas = [...new Set(S.posicoes.map(p => p.conta))]
    .map(conta => {
      const cad = cadastroDe(conta),
        cli = clienteDaConta(conta),
        p0 = S.posicoes.find(p => p.conta === conta);
      const pl = somaLista(S.posicoes.filter(p => p.conta === conta), p => (p as any)[S.campoValor] || 0);
      return {
        conta,
        planilha: p0?.nome || '',
        inst: p0?.instituicao || '',
        pl,
        cliente: cad?.cliente || '',
        familia: cad?.familia && norm(cad.familia) !== norm(cad.cliente) ? cad.familia : '',
        atual: cli?.nome || ''
      };
    })
    .sort(
      (a, b) =>
        +selContas.has(chaveConta(b.conta)) - +selContas.has(chaveConta(a.conta)) ||
        (a.familia || a.cliente || a.planilha).localeCompare(b.familia || b.cliente || b.planilha, 'pt-BR')
    );

  const familias = nomesFamilias(),
    pessoas = [...new Set([...S.clientes.values()].map(c => c.nome).concat(contas.map(c => c.cliente)).filter(Boolean))].sort();

  dlg.innerHTML = `<form method="dialog" class="dlg dlg-largo">
    <h2>Editar cadastro de clientes</h2>
    <p class="sec"><b>Mesma pessoa com duas contas:</b> escreva o mesmo nome em "Cliente". <b>Casal ou família</b> (ex.: marido e esposa, cada um com a sua conta): nomes diferentes em "Cliente" e o <b>mesmo nome em "Família"</b>. Conta sem cliente preenchido continua separada, com o nome da planilha.</p>
    <input type="search" id="cad-busca" placeholder="Buscar conta, nome ou família…" style="width:100%;margin-top:8px">
    <div class="cad-lista"><table><thead><tr><th>Conta</th><th>Na planilha</th><th class="n">Patrimônio</th><th>Cliente (nome completo)</th><th>Família (opcional)</th></tr></thead><tbody>
      ${contas
        .map(
          (c, i) => `<tr data-i="${i}" class="${selContas.has(chaveConta(c.conta)) ? 'cad-sel' : ''}"><td><b>${esc(
            c.conta
          )}</b></td><td class="sec">${esc(c.planilha)}${c.inst && c.inst !== 'BTG' ? ` · ${esc(c.inst)}` : ''}</td><td class="n">${esc(
            brlCurto(c.pl)
          )}</td>
        <td><input type="text" class="cad-cli" list="cad-pessoas" value="${esc(c.cliente)}" placeholder="${esc(c.atual)}"></td>
        <td><input type="text" class="cad-fam" list="cad-familias" value="${esc(c.familia)}" placeholder="—"></td></tr>`
        )
        .join('')}
    </tbody></table></div>
    <datalist id="cad-pessoas">${pessoas.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <datalist id="cad-familias">${familias.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <p class="sec" style="font-size:12px">As mudanças valem na hora neste navegador. Para valerem para todos, depois use "Guardar clientes novos" (barra "Carregado:") e atualize o <b>grupos.js</b> da pasta B.I.</p>
    <div class="dlg-botoes"><button value="cancelar" class="btn" formnovalidate>Cancelar</button><button value="ok" class="btn btn-pri">Salvar cadastro</button></div>
  </form>`;

  const corpo = dlg.querySelector('tbody') as HTMLElement;
  corpo.addEventListener('input', e => {
    const tr = (e.target as HTMLElement).closest('tr') as HTMLTableRowElement;
    const c = contas[+tr.dataset.i!];
    tr.classList.toggle(
      'cad-mudou',
      (tr.querySelector('.cad-cli') as HTMLInputElement).value.trim() !== c.cliente ||
        (tr.querySelector('.cad-fam') as HTMLInputElement).value.trim() !== c.familia
    );
  });

  $('#cad-busca')?.addEventListener('input', e => {
    const b = norm((e.target as HTMLInputElement).value);
    corpo.querySelectorAll<HTMLTableRowElement>('tr').forEach(tr => {
      tr.hidden = Boolean(
        b &&
          !norm(
            tr.textContent +
              ' ' +
              [...tr.querySelectorAll('input')].map(i => i.value).join(' ')
          ).includes(b)
      );
    });
  });

  dlg.onclose = () => {
    if (dlg.returnValue !== 'ok') return;
    const mud: string[] = [];
    corpo.querySelectorAll<HTMLTableRowElement>('tr').forEach(tr => {
      const c = contas[+tr.dataset.i!],
        cli = (tr.querySelector('.cad-cli') as HTMLInputElement).value.trim(),
        fam = (tr.querySelector('.cad-fam') as HTMLInputElement).value.trim();
      if (cli === c.cliente && fam === c.familia) return;
      if (!cli) {
        S.cadExtra.delete(chaveConta(c.conta));
        mud.push(`${c.conta} → sem cadastro`);
        return;
      }
      S.cadExtra.set(chaveConta(c.conta), { conta: c.conta, cliente: cli, familia: fam || cli });
      mud.push(`${c.conta} → ${cli}${fam ? ` (família ${fam})` : ''}`);
    });
    if (!mud.length) return;
    try {
      localStorage.setItem(CHAVE_CAD, JSON.stringify([...S.cadExtra.values()]));
    } catch {}
    registrar('Cadastro de clientes alterado', mud.join('; '));
    const conta0 = contasSel()[0];
    recalcular();
    const c = clienteDaConta(conta0);
    if (c) {
      S.sel = c.familiaId || c.id;
    }
  };
  dlg.showModal();
}

export function baixarCadastro() {
  const lista = new Map<string, any>();
  const win = window as any;
  for (const c of win.CADASTRO_CLIENTES || []) lista.set(chaveConta(c.conta), c);
  for (const c of S.cadExtra.values()) lista.set(chaveConta(c.conta), c);
  const linhas = [...lista.values()]
    .sort((a, b) => (a.familia || a.cliente).localeCompare(b.familia || b.cliente, 'pt-BR'))
    .map(c => {
      const desc =
        c.descricao || (win.CADASTRO_CLIENTES || []).find((x: any) => chaveConta(x.conta) === chaveConta(c.conta))?.descricao;
      return `  { conta: ${JSON.stringify(c.conta)}, cliente: ${JSON.stringify(c.cliente)}, familia: ${JSON.stringify(
        c.familia || c.cliente
      )}${desc ? `, descricao: ${JSON.stringify(desc)}` : ''} },`;
    })
    .join('\n');
  const apelidos = (win.APELIDOS_CLIENTES || []).length
    ? `\n// Apelidos: contas novas reconhecidas pelo nome do titular\nwindow.APELIDOS_CLIENTES = ${JSON.stringify(
        win.APELIDOS_CLIENTES,
        null,
        2
      )};\n`
    : '';
  const js = `// Cadastro de clientes: conta → cliente (pessoa) → família.\n// ARQUIVO LOCAL: não vai para o GitHub. Salve na mesma pasta do painel.html (substituindo o anterior).\n// Contas de outras instituições usam o prefixo do banco (ex.: "XP 1234567").\n\nwindow.CADASTRO_CLIENTES = [\n${linhas}\n];\n${apelidos}`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([js], { type: 'text/javascript' }));
  a.download = 'grupos.js';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function salvarNovos() {
  const novas = associacoesNovas();
  registrar('Cadastro de clientes novos aberto para salvar', novas.map(c => `${c.conta} → ${c.cliente}`).join('; '));
  const texto =
    'Claude, adicione ao cadastro de clientes (grupos.js):\n' +
    novas
      .map(
        c =>
          `- conta ${c.conta} → cliente ${c.cliente}${c.familia && norm(c.familia) !== norm(c.cliente) ? `, família ${c.familia}` : ''}`
      )
      .join('\n');
  const dlg = $('#dlg-extrato') as HTMLDialogElement;
  if (!dlg) return;

  dlg.innerHTML = `<form method="dialog" class="dlg">
    <h2>Guardar ${novas.length === 1 ? '1 cliente novo' : `${novas.length} clientes novos`}</h2>
    <p class="sec">Por enquanto, estas associações estão guardadas só neste navegador. Para ficarem permanentes (e valerem no computador do Lucas), escolha um caminho:</p>
    <h3 class="dlg-sub">1. Mandar para o Claude (mais fácil)</h3>
    <p class="sec">Copie o texto abaixo e cole na conversa com o Claude. Ele atualiza o cadastro.</p>
    <textarea readonly rows="${Math.min(8, novas.length + 2)}" class="dlg-texto">${esc(texto)}</textarea>
    <div class="dlg-botoes" style="justify-content:flex-start;margin-top:8px"><button type="button" class="btn btn-pri" id="copiar-novos">Copiar texto</button><span class="muted" id="copiado" style="font-size:12px;align-self:center"></span></div>
    <h3 class="dlg-sub">2. Baixar o arquivo</h3>
    <p class="sec">Baixa o <b>grupos.js</b> atualizado. O navegador vai avisar que arquivos .js "podem danificar o dispositivo": é um aviso padrão para esse tipo de arquivo. Clique em <b>Manter</b> e coloque o arquivo na <b>pasta de extratos</b> (a que você escolhe em "Ler pasta"), substituindo o antigo. No próximo "Ler pasta" ou "Atualizar com a pasta" o B.I. lê o cadastro novo.</p>
    <div class="dlg-botoes" style="justify-content:flex-start;margin-top:8px"><button type="button" class="btn" id="baixar-grupos">Baixar grupos.js</button></div>
    <div class="dlg-botoes"><button value="fechar" class="btn">Fechar</button></div>
  </form>`;

  const copiarBtn = $('#copiar-novos');
  if (copiarBtn) {
    copiarBtn.onclick = async () => {
      const ta = dlg.querySelector('textarea')!;
      try {
        await navigator.clipboard.writeText(ta.value);
      } catch {
        ta.select();
        document.execCommand('copy');
      }
      const copiadoEl = $('#copiado');
      if (copiadoEl) copiadoEl.textContent = 'Copiado! Agora cole na conversa com o Claude.';
    };
  }
  const baixarBtn = $('#baixar-grupos');
  if (baixarBtn) baixarBtn.onclick = baixarCadastro;
  dlg.onclose = null;
  dlg.showModal();
}

export function abrirPoliticas() {
  const dlg = $('#dlg-extrato') as HTMLDialogElement;
  if (!dlg) return;
  const totalPol = S.politicasPorConta.size;
  const linhas = [...S.politicasPorConta.entries()]
    .map(([conta, p]) => {
      const c = S.clientes.get(clienteDaConta(conta)?.id || '');
      const titular = c?.nome ? `<small class="muted">(${esc(c.nome)})</small>` : '';
      return `<tr>
      <td><b>${esc(conta)}</b> ${titular}</td>
      <td>${esc(p.nome || 'Personalizada')}</td>
      <td>Pós: ${pct(p.classes?.Pos?.alvo)} · Infl: ${pct(p.classes?.Infl?.alvo)} · Ações: ${pct(p.classes?.Acoes?.alvo)}</td>
      <td>Corp: ${pct(p.credito?.Corp?.max || 0.25)} max</td>
      <td><button type="button" class="btn btn-peq" data-rm-pol="${esc(conta)}">Remover</button></td>
    </tr>`;
    })
    .join('');

  dlg.innerHTML = `<form method="dialog" class="dlg" style="max-width:760px">
    <h2>Políticas de Investimento por Conta (LGPD)</h2>
    <p class="sec">Em conformidade com a LGPD, o arquivo associa faixas operacionais apenas ao <b>número da conta</b>, sem trafegar nomes de pessoas nem CPFs. Contas sem política específica utilizam os parâmetros padrão da mesa.</p>
    <div style="display:flex;gap:10px;margin:12px 0;flex-wrap:wrap">
      <button type="button" class="btn btn-pri" id="pol-importar">Importar Planilha de Políticas (.xlsx)</button>
      <button type="button" class="btn" id="pol-baixar-modelo">Baixar Modelo de Políticas (Excel)</button>
      <input type="file" id="pol-file-input" accept=".xlsx,.xls" hidden>
    </div>
    <div class="tabela-wrap" style="max-height:300px">
      <table>
        <thead><tr><th>Conta</th><th>Perfil / Política</th><th>Alvos Principais</th><th>Teto Crédito</th><th></th></tr></thead>
        <tbody>${
          linhas ||
          '<tr><td colspan="5" class="sec" style="text-align:center;padding:16px">Nenhuma política personalizada carregada. Todas as contas seguem a Política Padrão.</td></tr>'
        }</tbody>
      </table>
    </div>
    <div class="dlg-botoes">
      <button type="button" class="btn" id="pol-limpar-todas" ${totalPol ? '' : 'disabled'}>Limpar Todas</button>
      <button value="ok" class="btn btn-pri">Fechar</button>
    </div>
  </form>`;

  const bkpBtn = $('#pol-baixar-modelo');
  if (bkpBtn) bkpBtn.onclick = () => baixarModeloPoliticaExcel();
  const impBtn = $('#pol-importar');
  if (impBtn) impBtn.onclick = () => ($('#pol-file-input') as HTMLInputElement)?.click();

  const fileInp = $('#pol-file-input') as HTMLInputElement | null;
  if (fileInp) {
    fileInp.onchange = async e => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      try {
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const mapa = lerPoliticasExcel(wb);
        for (const [conta, pol] of mapa) S.politicasPorConta.set(conta, pol);
        await salvarPoliticas();
        registrar('Políticas importadas', `${mapa.size} contas via ${f.name}`);
        recalcular();
        dlg.close();
        alert(`Sucesso: ${mapa.size} políticas carregadas e salvas com sucesso.`);
      } catch (err: any) {
        alert('Erro ao ler planilha de políticas: ' + (err.message || err));
      }
    };
  }

  const limparBtn = $('#pol-limpar-todas');
  if (limparBtn) {
    limparBtn.onclick = async () => {
      if (confirm('Deseja remover todas as políticas personalizadas? As contas voltarão a usar a Política Padrão.')) {
        S.politicasPorConta.clear();
        await salvarPoliticas();
        recalcular();
        dlg.close();
      }
    };
  }

  dlg.querySelector('tbody')?.addEventListener('click', async e => {
    const btn = (e.target as HTMLElement).closest('[data-rm-pol]') as HTMLElement;
    if (btn) {
      S.politicasPorConta.delete(btn.dataset.rmPol!);
      await salvarPoliticas();
      recalcular();
      dlg.close();
      abrirPoliticas();
    }
  });
  dlg.showModal();
}

export function perguntarUsuario(): Promise<void> {
  return new Promise(resolve => {
    const dlg = $('#dlg-extrato') as HTMLDialogElement;
    if (!dlg) return resolve();
    const nomes = [
      ...new Set(
        lerLocal(CHAVE_HIST, [])
          .map((h: any) => h.quem)
          .filter((n: string) => n && n !== 'Sem nome')
          .concat(['Vinicius', 'Lucas Moratto'])
      )
    ];
    dlg.innerHTML = `<form method="dialog" class="dlg"><h2>Quem está usando o B.I.?</h2>
      <p class="sec">O nome vai para o histórico de cada ação (anexar, trocar extrato, gerar relatório…). Fica salvo neste navegador.</p>
      <label class="campo" style="margin:12px 0"><span class="rotulo">Seu nome</span><input type="text" name="nome" list="lista-usuarios" required value="${esc(
        lerLocal(CHAVE_USUARIO, '')
      )}"></label>
      <datalist id="lista-usuarios">${nomes.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      <div class="dlg-botoes"><button value="cancelar" class="btn" formnovalidate>Cancelar</button><button value="ok" class="btn btn-pri">Salvar</button></div></form>`;

    dlg.onclose = () => {
      const n = (dlg.querySelector('[name=nome]') as HTMLInputElement)?.value.trim();
      if (dlg.returnValue === 'ok' && n) {
        const antes = lerLocal(CHAVE_USUARIO, '');
        gravarLocal(CHAVE_USUARIO, n);
        if (antes !== n) registrar('Usuário identificado', antes ? `${antes} → ${n}` : n);
      }
      mostrarUsuario();
      resolve();
    };
    dlg.showModal();
  });
}

export function mostrarUsuario() {
  const btn = $('#btn-usuario');
  if (btn) btn.textContent = lerLocal(CHAVE_USUARIO, '') || 'Quem é você?';
}

export function carregarCadLocal(): Map<string, any> {
  try {
    return new Map((JSON.parse(localStorage.getItem(CHAVE_CAD) || '[]') || []).map((c: any) => [chaveConta(c.conta), c]));
  } catch {
    return new Map();
  }
}

export function salvarCadLocal(): void {
  try {
    localStorage.setItem(CHAVE_CAD, JSON.stringify([...S.cadExtra.values()]));
  } catch {}
}

export function limparCadLocal(): void {
  const pendentes = new Set(associacoesNovas().map((c: any) => chaveConta(c.conta)));
  for (const k of [...S.cadExtra.keys()]) {
    if (!pendentes.has(k)) S.cadExtra.delete(k);
  }
  salvarCadLocal();
}

export function conferirVersao(): void {
  const vista = lerLocal(CHAVE_VERSAO, '');
  if (vista === VERSAO_BI) return;
  for (const v of VERSOES_BI.filter(v => (vista ? v.versao > vista : v.versao === VERSAO_BI)).reverse()) {
    registrar(`B.I. atualizado (versão ${v.versao})`, v.mudancas.join(' • '));
  }
  gravarLocal(CHAVE_VERSAO, VERSAO_BI);
}

export function abrirHistorico(): void {
  const dlg = $('#dlg-extrato') as HTMLDialogElement;
  if (!dlg) return;
  const h = lerLocal(CHAVE_HIST, []);
  const quando = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };
  dlg.innerHTML = `<form method="dialog" class="dlg dlg-largo">
    <h2>Histórico</h2>
    <p class="sec">Ações feitas neste navegador e as mudanças no código do B.I. Quando a pasta da empresa estiver ligada, o histórico passa a ser de todos.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:10px">
      <span class="seg" id="hist-aba"><button type="button" data-v="atv" aria-pressed="true">Atividades (${h.length})</button><button type="button" data-v="ver" aria-pressed="false">Mudanças no B.I.</button></span>
      <input type="search" id="hist-busca" placeholder="Buscar: cliente, instituição, pessoa…" style="flex:1;min-width:200px">
    </div>
    <div class="hist-lista" id="hist-atv">${h.length ? `<table><thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Detalhe</th></tr></thead><tbody>${h.map((x: any) => `<tr><td class="quando">${quando(x.em)}</td><td>${esc(x.quem)}</td><td><b>${esc(x.acao)}</b></td><td class="sec">${esc(x.detalhe)}</td></tr>`).join('')}</tbody></table>` : '<p class="sec" style="padding:14px">Nada registrado ainda.</p>'}</div>
    <div class="hist-lista" id="hist-ver" hidden>${VERSOES_BI.map(v => `<div class="hist-versao"><h4>Versão ${esc(v.versao)} · ${esc(v.data.split('-').reverse().join('/'))} · ${esc(v.autor)}</h4><ul>${v.mudancas.map(m => `<li>${esc(m)}</li>`).join('')}</ul></div>`).join('')}</div>
    <div class="dlg-botoes"><button type="button" class="btn" id="hist-baixar">Baixar histórico (Excel)</button><button value="ok" class="btn btn-pri">Fechar</button></div>
  </form>`;
  
  const atvEl = $('#hist-atv');
  const verEl = $('#hist-ver');
  const segEl = $('#hist-aba');
  if (segEl) {
    segEl.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      segEl.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      const v = b.dataset.v;
      if (atvEl) atvEl.hidden = v !== 'atv';
      if (verEl) verEl.hidden = v !== 'ver';
    });
  }

  const buscaInput = $('#hist-busca');
  if (buscaInput) {
    buscaInput.addEventListener('input', e => {
      const b = norm((e.target as HTMLInputElement).value);
      dlg.querySelectorAll('#hist-atv tbody tr, #hist-ver .hist-versao').forEach(tr => {
        (tr as HTMLElement).hidden = Boolean(b && !norm(tr.textContent).includes(b));
      });
    });
  }

  const baixarBtn = $('#hist-baixar');
  if (baixarBtn) {
    baixarBtn.onclick = () => {
      const ws = XLSX.utils.json_to_sheet(h.map((x: any) => ({ Quando: quando(x.em), Quem: x.quem, Ação: x.acao, Detalhe: x.detalhe })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Histórico');
      XLSX.writeFile(wb, `Historico_BI_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };
  }

  dlg.showModal();
}

export function baixarModelo(): void {
  const COLUNAS_PADRAO = ['Instituição', 'Conta', 'Cliente', 'Classe', 'Subclasse', 'Estratégia', 'Ativo', 'Emissor', 'Vencimento', 'Taxa', 'Quantidade', 'Valor Bruto', 'Valor Líquido'];
  const ws = XLSX.utils.aoa_to_sheet([
    COLUNAS_PADRAO,
    ['Itaú', '12345-6', 'Nome do Cliente', 'Renda Fixa', 'BANCARIO', 'Pós-fixado', 'CDB', 'BANCO ITAU', '15/08/2028', 102, 1, 50000, 49500],
    ['Itaú', '12345-6', 'Nome do Cliente', 'Fundos', 'FN', 'Retorno Absoluto (MM)', 'FUNDO MULTIMERCADO X FIC FIM', '', '', '', 1000, 30000, 29800]
  ]);
  ws['!cols'] = COLUNAS_PADRAO.map(c => ({ wch: Math.max(12, c.length + 4) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Posição');
  XLSX.writeFile(wb, 'modelo_extrato_outras_instituicoes.xlsx');
}

