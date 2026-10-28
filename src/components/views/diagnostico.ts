import { S } from '../../domain/state';
import {
  CLASSES_EST,
  RISCO_CREDITO,
  CONTRAPARTES,
  HORIZONTES,
  JANELAS,
  PALETA_DG,
  NOME_INST
} from '../../domain/constants';
import {
  somaPrecisa,
  subPrecisa,
  multPrecisa,
  divPrecisa,
  somaLista
} from '../../domain/precision';
import { obterPoliticaDe, registrar } from '../../domain/storage';
import { $ } from '../dom';
import {
  esc,
  brl,
  brlCurto,
  pct,
  num,
  dataBR,
  norm,
  palavras,
  nomeProprio,
  soPrimeiroNome,
  valor
} from '../formatters';
import { DIAG_REPORT_CSS } from '../../styles/report-styles';
import { buscarFundoGuia } from '../../parsers/fund-guide';

// --- Diagnóstico e Enriquecimento de Ativos ---
// Grupo consolidado (mesma casa gestora): Contea, Carbyne, BRM, Apex, Eluja e Pignola
export const GESTORA_GRUPO_CONTEA = 'Contea / Carbyne / Apex / Pignola';
// De-para de ativos já identificados (seção 4.4 do padrão)
export const DEPARA = [
  // FIC FIM que investe em cota júnior (subordinada) de FIDC: o nome não diz "FIDC", então o enquadramento é manual
  { re: /\bVALADIER\b/, classe: 'Alt', contraparte: 'Estr', gestor: GESTORA_GRUPO_CONTEA, carac: 'FIDC — cota júnior (subordinada)', prazo: 'L', janela: 'cot', veiculo: 'FIDC' },
  { re: /\b5PRE11\b/, nome: 'ETF 5PRE11 — IT Now Pré', classe: 'Pre', contraparte: 'Sob', gestor: 'Itaú Asset', carac: 'Títulos públicos pré', prazo: 'M', janela: 'd2' },
  { re: /\bSMAL11\b/, nome: 'ETF SMAL11 — iShares Small Caps', classe: 'Acoes', contraparte: 'Acoes', gestor: 'BlackRock / iShares', carac: 'ETF small caps', prazo: 'L', janela: 'd2' },
  { re: /\bBOVA11\b/, nome: 'ETF BOVA11 — iShares Ibovespa', classe: 'Acoes', contraparte: 'Acoes', gestor: 'BlackRock / iShares', carac: 'ETF Ibovespa', prazo: 'L', janela: 'd2' },
  { re: /\bZIFI11\b/, nome: 'ZIFI11 — FII Zion', classe: 'FII', contraparte: 'Imob', gestor: 'Zion Capital', carac: 'FII listado' },
  { re: /\bJGPX11\b/, nome: 'JGPX11 — Fiagro JGP', classe: 'FII', contraparte: 'Imob', gestor: 'JGP', carac: 'Fiagro de crédito' },
  { re: /\bCPTA11\b/, nome: 'CPTA11 — Fiagro Capitânia', classe: 'FII', contraparte: 'Imob', gestor: 'Capitânia', carac: 'Fiagro de crédito' },
  { re: /\bGCRA11\b/, nome: 'GCRA11 — Fiagro Galapagos', classe: 'FII', contraparte: 'Imob', gestor: 'Galapagos Capital', carac: 'Fiagro recebíveis do agro' },
  { re: /\bJMBI11\b/, nome: 'JMBI11 — FI-Infra JiveMauá', classe: 'FII', contraparte: 'Corp', gestor: 'JiveMauá BossaNova', carac: 'FI-Infra listado (debêntures)' },
  { re: /\bBDIF11\b/, nome: 'BDIF11 — FI-Infra BTG', classe: 'FII', contraparte: 'Corp', gestor: 'BTG Pactual', carac: 'FI-Infra listado (debêntures)' },
  { re: /\bBDIV11\b/, nome: 'BDIV11 — FIP de dívida BTG', classe: 'Alt', contraparte: 'Alt', gestor: 'BTG Pactual', carac: 'FIP de dívida de infraestrutura' },
  { re: /\bHGLG11\b/, classe: 'FII', contraparte: 'Imob', gestor: 'Pátria', carac: 'FII logístico' },
  { re: /\bKNCR11\b/, classe: 'FII', contraparte: 'Imob', gestor: 'Kinea', carac: 'FII de recebíveis' },
  { re: /\bCTSE11\b/, emissor: 'CL Sites S.A. (grupo Clemar)', setor: 'Torres de telecom' },
  { re: /\bCJEN13\b/, emissor: 'TESC — Terminal Santa Catarina', setor: 'Terminal portuário' },
  // Mapeamentos específicos de Risco de Crédito solicitados pelo escritório
  { re: /\bKINEA OPORTUNIDADE/i, contraparte: 'Corp', gestor: 'Kinea', carac: 'Crédito Privado Corporativo' },
  { re: /\bMAG CASH 10/i, contraparte: 'Banc', gestor: 'Mongeral Aegon', carac: 'Crédito Bancário' },
  { re: /\bMCA\b|\bMCA II\b/i, contraparte: 'Estr', gestor: 'MAG / MCA', carac: 'Crédito Estruturado (FIDC)' },
  { re: /\bBRADESCO ZUPO\b/i, contraparte: 'Banc', gestor: 'Bradesco Asset', carac: 'Crédito Bancário' },
  { re: /\bSPARTA TOP\b/i, contraparte: 'Corp', gestor: 'Sparta', carac: 'Crédito Privado Corporativo' },
  { re: /\bABSOLUTE CRETA\b/i, contraparte: 'Corp', gestor: 'Absolute', carac: 'Crédito Privado Corporativo' },
  { re: /\bBTG CRED CORP\b|\bCRED CORP\b/i, contraparte: 'Corp', gestor: 'BTG Pactual', carac: 'Crédito Privado Corporativo' },
  { re: /\bCDB\b/i, contraparte: 'Banc', carac: 'Crédito Bancário' },
];
// Casas gestoras reconhecidas pelo nome do veículo (o grupo consolidado fica no topo para ter prioridade)
export const GESTORAS = [
  [/CONTEA|CARBYNE|\bBRM\b|\bAPEX\b|ELUJA|PIGNOLA/, GESTORA_GRUPO_CONTEA],
  [/\bBTG\b/, 'BTG Pactual'], [/\bITAU\b|\bIT NOW\b/, 'Itaú Asset'], [/ISHARES|BLACKROCK/, 'BlackRock / iShares'], [/\bJGP/, 'JGP'],
  [/CAPITANIA/, 'Capitânia'], [/GALAPAGOS/, 'Galapagos Capital'], [/JIVE/, 'JiveMauá BossaNova'], [/\bZION\b/, 'Zion Capital'],
  [/\bSEVEN\b/, 'Seven'],
  [/\bLCP\b/, 'LCP'], [/KAPITALO/, 'Kapitalo'], [/\bSAF\b|(?<!BOA )SAFRA/, 'Safra Asset'], [/\bTREND\b/, 'XP Asset (Trend)'], [/DANTE|SINGULAR/, 'Dante / Singular'],
  [/\bSORI\b/, 'Sori'], [/KINEA/, 'Kinea'], [/\bSPX\b/, 'SPX'], [/\bVERDE\b/, 'Verde'], [/LEGACY/, 'Legacy'], [/\bARX\b/, 'ARX'],
  [/AZ QUEST/, 'AZ Quest'], [/SPARTA/, 'Sparta'], [/VINCI/, 'Vinci'], [/PATRIA/, 'Pátria'], [/\bXP\b/, 'XP Asset'],
  [/VANGUARD/, 'Vanguard'], [/INVESCO/, 'Invesco'], [/SCHWAB/, 'Charles Schwab'], [/JPMORGAN/, 'JPMorgan'], [/SPDR|STATE STREET/, 'State Street'], [/SULAMERICA/, 'SulAmérica'],
];
export const SEM_ACENTO = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
// Horizonte por emissor, definido pelo escritório (ex.: relatório de referência do escritório): papéis de emissores com mercado secundário
// (vazio: o relatório mais recente do escritório usa o vencimento para todos os papéis; inclua aqui exceções futuras, ex.: [/MULTIPLAN/, 'M'])
export const HORIZONTE_EMISSOR = [];
// Nome de fundo em maiúsculas → caixa de título, preservando as siglas (FI, FIC, FIP, CP, LP…)
export const SIGLAS_FUNDO = new Set(['FI', 'FIC', 'FIM', 'FIP', 'FIA', 'FII', 'FIDC', 'FIRF', 'FICFIM', 'CP', 'LP', 'RL', 'IE', 'RF', 'DI', 'PCO', 'FC', 'ETF', 'BTG', 'XP', 'II', 'III', 'IV', 'BDR', 'ESG', 'USD', 'CDI', 'IPCA', 'MM', 'M', 'CRPR', 'PE']);
export const nomeLimpo = s => String(s).toLowerCase().split(/\s+/).map((w, i) => {
  const W = w.toUpperCase();
  if (SIGLAS_FUNDO.has(W.replace(/[^A-Z]/g, ''))) return W;
  if (i && ['de', 'do', 'da', 'dos', 'das', 'e'].includes(w)) return w;
  return w.charAt(0).toUpperCase() + w.slice(1);
}).join(' ');

export function emissorCurto(s: any) {
  if (!s) return null;
  const n = SEM_ACENTO(s);
  // "Boa Safra" (Boa Safra Sementes, emissora de CRA) vem antes do Banco Safra, que não pode pegar "BOA SAFRA"
  const fixos: [RegExp, string][] = [[/BTG PACTUAL/, 'BTG Pactual'], [/NACIONAL DESENV|BNDES/, 'BNDES'], [/BOA SAFRA/, 'Boa Safra Sementes'], [/(?<!BOA )SAFRA/, 'Banco Safra'], [/VOTORANTIM/, 'Banco Votorantim'],
    [/B ?B ?M\b/, 'Banco BBM'], [/ABC BRASIL/, 'Banco ABC Brasil'], [/BACEN|TESOURO/, 'Tesouro Nacional'], [/ITAU/, 'Itaú Unibanco'], [/BRADESCO/, 'Bradesco'],
    // Nomes curtos de emissores já vistos (como nos relatórios do escritório)
    [/COSERN/, 'Cosern'], [/WTE BIOGAS/, 'WTE Biogás Franca'], [/MULTIPLAN/, 'Multiplan'], [/MOMA/, 'Moma Residence'], [/RAIZEN/, 'Raízen'],
    [/\bJSL\b/, 'JSL'], [/DIRECIONAL/, 'Direcional Engenharia'], [/LOG COMMERCIAL/, 'LOG Commercial Properties'], [/IGUATEMI/, 'Iguatemi'],
    [/ENEVA/, 'Eneva'], [/ORIGEM ENERGIA/, 'Origem Energia'], [/FS AGRISOLUTIONS/, 'FS Agrisolutions'], [/CIDADE MARAVILHOSA/, 'Cidade Maravilhosa'],
    [/CANAL CIA SECURITIZ/, 'Canal Securitizadora'], [/TRES IRMAOS/, 'Três Irmãos'], [/GF PARTICIPA/, 'GF Participações']];
  for (const [re, nome] of fixos) if (re.test(n)) return nome;
  return nomeProprio(String(s).replace(/\b(S\.?\s?\/?\s?A\.?|LTDA\.?|CIA\.?)(?=\s|$)/gi, '').replace(/\s+/g, ' ').trim());
}
export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const mesAno = (d: any) => d instanceof Date && !isNaN(d.getTime()) ? `${MESES[d.getMonth()]}/${d.getFullYear()}` : null;

// Classifica uma posição nas visões do padrão: classe, contraparte, gestora/emissor, horizonte, liquidez
export function dgEnriquecer(p: any, base: Date) {
  const bruto = `${p.nomeAtivo || ''} ${p.ativo || ''} ${p.produto || ''}`;
  const up = ` ${SEM_ACENTO(bruto)} `, w = palavras(bruto);
  const tem = re => re.test(w);
  const dp: any = (DEPARA as any[]).find(d => d.re.test(up)) || {};
  const m = norm(p.classe), sub = norm(p.subclasse), estr = norm(p.estrategia);
  const ehTP = sub === 'titulo publico' || sub === 'tesouro direto';
  const ehBanc = sub === 'bancario' || (m === 'renda fixa' && tem(/ (cdb|lca|lci|lc|rdb|lf|lig) /));
  const ehPriv = sub === 'privado' || (m === 'renda fixa' && tem(/ (cri|cra|debenture|debentures|deb) /));
  const ehFundo = m === 'fundos' || m === 'previdencia';
  const ehFII = sub === 'fii' || tem(/ (fii|fiagro) /);
  const ehFIP = tem(/ fip /) || tem(/ mercados privados /) || tem(/ private equity /);
  const ehFIDC = tem(/ fidc /);
  // Compromissada (no extrato do BTG vem como "Compromissada -> Debênture"; na planilha, ativo "Comp*..."): liquidez D+0
  const ehComp = tem(/ compromissada /) || /^COMP\*/i.test(String(p.ativo || ''));
  const ehLista = m === 'renda variavel';
  const ticker = (p.ativo || '').toUpperCase().match(/^[A-Z]{4}\d{1,2}$/)?.[0] || null;
  const acaoDireta = ehLista && !ehFII && ticker && !/11$/.test(ticker);
  const intl = tem(/ (global|internacional|exterior|offshore|americana|nasdaq|eua|usa|reit|reits) /) || /\b[A-Z]{4}3[2-59]\b/.test(up) || estr.startsWith('internac');
  const estrK = estr.startsWith('pos') ? 'Pos' : estr.startsWith('infl') ? 'Infl' : estr.startsWith('pre') ? 'Pre'
    : estr.startsWith('renda var') ? 'Acoes' : estr.startsWith('retorno abs') ? 'MM' : estr.startsWith('altern') ? 'Alt' : null;
  const deriv = m === 'derivativos';
  // Ativos no exterior (ex.: Nomad): ETFs/fundos têm gestora; ações e REITs são risco direto da empresa
  const exterior = m === 'internacional';
  const exteriorDireto = exterior && !/etf|fundo/.test(sub);

  // Classe estratégica (o risco de fato, não o rótulo do custodiante)
  let classe;
  if (p.caixa || p.receber || (p.transito && !deriv)) classe = 'Caixa';
  else if (deriv) classe = tem(/ pre /) ? 'Pre' : tem(/ (ipca|ipc) /) ? 'Infl' : 'Pos';
  else if (exterior) classe = 'Intl';
  else if (dp.classe) classe = dp.classe;
  else if (m === 'outros') classe = 'Outros';
  else if (ehFIP) classe = 'Alt';
  else if (ehFII) classe = 'FII';
  else if (m === 'coe') classe = intl ? 'Intl' : 'Alt';
  else if (m === 'criptoativos') classe = 'Cripto';
  else if (ehLista) classe = intl ? 'Intl' : 'Acoes';
  else if (ehFIDC) classe = 'Pos';
  else if (estrK === 'Acoes' && intl) classe = 'Intl';
  else classe = estrK || (ehTP ? 'Infl' : 'Outros');

  // Risco de Crédito (de quem é o risco) — visão independente da classe com look-through
  let cp;
  if (classe === 'Caixa') cp = 'Caixa';
  else if (deriv) cp = 'Deriv';
  else if (exterior) cp = 'Intl';
  else if (dp.contraparte) cp = dp.contraparte;
  else if (p.contraparte) cp = p.contraparte;
  else if (p.riscoCredito) cp = p.riscoCredito;
  else if (ehTP || (ehFundo && tem(/ (tesouro|selic|ntn|lft|ltn) /))) cp = 'Sob';
  else if (ehBanc || m === 'coe') cp = 'Banc';
  else if (ehPriv) cp = 'Corp';
  else if (ehFIDC || tem(/ (mca|fidc|estruturado) /)) cp = 'Estr';
  else if (m === 'criptoativos') cp = 'Cripto';
  else if (ehFIP || classe === 'Alt') cp = (tem(/ (divida|debenture|credito) /) ? 'Estr' : 'ReaisSoc');
  else if (ehFII) {
    const ehTij = tem(/ (logistica|galpao|galpoes|shopping|shoppings|lajes|renda urbana|hospital|hospitais|imoveis|predio|tijolo) /) || /\b(hglg|knri|xpml|visc|btlg|hgru|vilg|knl1|hgre|alzr)\d{1,2}\b/i.test(bruto);
    const ehPapel = tem(/ (recebiveis|cri|cra|credito|debentures|infra) /) || /\b(kncr|cpta|jgpx|gcra|jmbi|bdif)\d{1,2}\b/i.test(bruto);
    cp = ehPapel ? 'Estr' : 'ReaisTijolo';
  }
  else if (classe === 'Acoes') cp = 'Acoes';
  else if (classe === 'Intl') cp = 'Intl';
  else if (ehFundo || ehFIDC) {
    if (tem(/ (mca|fidc|estruturado) /)) cp = 'Estr';
    else if (tem(/ (mag cash|zupo|bancario|pos fixado|di simples|referenciado di|tesouraria) /)) cp = 'Banc';
    else if (classe === 'MM' && !tem(/ (crpr|credito|deb) /)) cp = 'MM';
    else cp = 'Corp';
  }
  else if (classe === 'MM') cp = 'MM';
  else cp = 'Outros';

  // Casa gestora (quem administra o veículo) x emissor direto (devedor final)
  const direto = ehTP || ehBanc || ehPriv || m === 'coe' || classe === 'Caixa' || deriv || acaoDireta || m === 'criptoativos' || m === 'outros' || exteriorDireto;
  let ge, papel;
  if (direto) {
    if (ehTP) { ge = 'Tesouro Nacional'; papel = `Soberano — ${p.produto || 'título público'}`; }
    else if (classe === 'Caixa') { ge = p.instituicao === 'BTG' ? 'BTG Pactual' : p.instituicao; papel = p.receber ? 'Valores a receber' : p.transito ? 'Valor em trânsito' : 'Bancário — conta corrente'; }
    else if (deriv) { ge = p.instituicao === 'BTG' ? 'BTG Pactual' : p.instituicao; papel = 'Derivativo — contraparte da operação'; }
    else if (acaoDireta) { ge = ticker; papel = 'Ação listada'; }
    else if (exteriorDireto) { ge = p.produto || p.ativo; papel = `Exterior — ${p.subclasse}`; }
    else if (m === 'criptoativos') { ge = p.nomeAtivo; papel = 'Criptoativo'; }
    else if (m === 'outros') { ge = 'Não identificado'; papel = 'Posição não detalhada no extrato'; }
    else {
      ge = dp.emissor || emissorCurto(p.emissor) || 'Emissor não informado na base';
      const tipo = ehBanc ? (tem(/ lca /) ? 'LCA' : tem(/ lci /) ? 'LCI' : tem(/ lf /) ? 'LF' : 'CDB') : tem(/ cri /) ? 'CRI' : tem(/ (cra|crapre) /) ? 'CRA' : m === 'coe' ? 'COE'
        : ehComp ? 'Compromissada' : tem(/ (debenture|debentures|deb) /) || !p.produto ? 'Debênture' : p.produto;
      papel = dp.setor ? `${dp.setor} — ${tipo}` : (ehBanc ? `Bancário — ${tipo}` : tipo);
    }
  } else {
    ge = dp.gestor || (GESTORAS as [RegExp, string][]).find(([re]) => re.test(up))?.[1] || 'Gestora não identificada';
  }
  const fgc = (ehBanc && !tem(/ (lf|lig) /)) || (classe === 'Caixa' && !p.transito && !p.receber);

  // Horizonte de prazo (C/M/L) e janela de liquidez
  const anos = p.vencimento instanceof Date ? (p.vencimento.getTime() - base.getTime()) / 3.15576e10 : null;
  const txIdx = p.taxaCompra || p.taxaEmissao;
  // CDB do próprio banco custodiante a até 100% do CDI: liquidez diária
  const instNome = { BTG: 'BTG Pactual', Safra: 'Banco Safra' }[p.instituicao] || p.instituicao;
  const liqDiaria = ehBanc && classe === 'Pos' && tem(/ cdb /) && (!txIdx || txIdx <= 100.5) && emissorCurto(p.emissor) === instNome;

  // Procura liquidez/prazo de resgate informado na posição, no Fund Guide ou no texto
  let liqFundo = p.liquidez;
  if (!liqFundo && (ehFundo || ehFIDC)) {
    const g = buscarFundoGuia(p.nomeAtivo, p.cnpj);
    if (g?.liquidez) liqFundo = g.liquidez;
  }
  if (!liqFundo && (ehFundo || ehFIDC)) {
    const mD = String(p.nomeAtivo || '').match(/\b(D\+\d+)\b/i) || String(p.taxaTexto || '').match(/\b(D\+\d+)\b/i);
    if (mD) liqFundo = mD[1].toUpperCase();
  }
  if (liqFundo && !p.liquidez) {
    p.liquidez = liqFundo;
  }

  let prazo, janela;
  if (classe === 'Caixa') { prazo = 'C'; janela = 'dia'; }
  else if (dp.prazo || dp.janela) { prazo = dp.prazo || 'L'; janela = dp.janela && dp.janela !== 'd2' ? dp.janela : 'bolsa'; }
  else if (m === 'previdencia') { prazo = 'L'; janela = 'prev'; }
  else if (ehFIP || tem(/ d 366 /)) { prazo = 'L'; janela = 'cot'; }
  else if (ehLista || exterior) { prazo = 'L'; janela = 'bolsa'; }
  else if (m === 'criptoativos') { prazo = 'L'; janela = 'dia'; }
  else if (ehFundo || ehFIDC) {
    if (classe === 'Pos' && tem(/ (di|selic|liquidez|simples|tesouro|referenciado|referen) /) && (!liqFundo || /D\+[01]\b/i.test(liqFundo))) {
      prazo = 'C';
      janela = 'dia';
    } else if (liqFundo) {
      const mDias = liqFundo.match(/D\+(\d+)/i);
      const dias = mDias ? parseInt(mDias[1], 10) : null;
      if (dias !== null) {
        if (dias <= 1) {
          prazo = 'C';
          janela = 'dia';
        } else if (dias <= 5) {
          prazo = 'C';
          janela = `d${dias}`;
        } else {
          prazo = dias <= 730 ? 'M' : 'L';
          janela = `d${dias}`;
        }
      } else {
        prazo = ['Alt', 'Acoes', 'Intl'].includes(classe) ? 'L' : 'M';
        janela = 'cot';
      }
    } else {
      prazo = ['Alt', 'Acoes', 'Intl'].includes(classe) || ehFIDC ? 'L' : 'M';
      janela = 'cot';
    }
  }
  else if (tem(/ automatico /) || tem(/ automa co /) || liqDiaria || ehComp) { prazo = 'C'; janela = 'dia'; }
  else if (anos !== null) { prazo = anos <= 2 ? 'M' : 'L'; janela = 'venc'; }
  else { prazo = 'M'; janela = direto ? 'venc' : 'cot'; }
  // Horizonte definido pelo escritório para emissores específicos (papéis com mercado secundário)
  const hz = direto && !ehTP ? (HORIZONTE_EMISSOR as [RegExp, string][]).find(([re]) => re.test(SEM_ACENTO(p.emissor || ''))) : null;
  if (hz) prazo = hz[1];

  // Classificação confirmada? (fundo sem de-para depende da estratégia informada pelo banco)
  // (o nome do veículo já diz a carteira quando é Tesouro Selic / título público)
  const confirmado = !ehFundo || !!dp.classe || classe === 'Caixa' || tem(/ tesouro selic /) || (tem(/ tesouro /) && cp === 'Sob');

  // Nome exibido e característica
  let nome = dp.nome || (ehFundo && p.nomeAtivo === p.nomeAtivo.toUpperCase() ? nomeLimpo(p.nomeAtivo) : p.nomeAtivo);
  // Papel sem vencimento no extrato (ex.: securitizadora por foto): o código do ativo diferencia as posições
  if (!dp.nome && (ehPriv || ehBanc) && !deriv) nome = liqDiaria ? `${papel.split('— ').pop()} ${ge} — liquidez diária`
    : `${papel.split('— ').pop()} ${ge}${p.vencimento ? ' – ' + mesAno(p.vencimento) : p.ativo && p.ativo !== p.produto ? ' — ' + p.ativo : ''}`;
  if (exterior) nome = p.ativo && p.produto && p.ativo !== p.produto ? `${p.ativo} — ${p.produto}` : (p.produto || p.ativo);
  if (!dp.nome && ehTP) nome = `${p.produto || 'Título público'} Tesouro Nacional${p.vencimento ? ' ' + p.vencimento.getFullYear() : ''}`;
  if (classe === 'Caixa') nome = p.receber ? `A receber — ${p.nomeAtivo}` : p.transito ? `Valor em trânsito — ${p.nomeAtivo}` : 'Saldo em conta corrente';
  const tx = p.taxaCompra || p.taxaEmissao;
  let carac;
  if (dp.carac) carac = dp.carac;
  else if (classe === 'Caixa') carac = p.receber ? `Valor futuro${p.vencimento ? ' • ' + dataBR(p.vencimento) : ''}` : p.transito ? 'Valor em trânsito' : 'Disponibilidade imediata';
  else if (deriv) carac = 'Derivativo — marcação a mercado';
  else if (direto && (ehTP || ehBanc || ehPriv || m === 'coe')) {
    const idx = p.taxaTexto ? p.taxaTexto : classe === 'Pos' ? (tx ? (tx > 20 ? `${num(tx)}% do CDI` : `CDI + ${num(tx)}%`) : 'CDI')
      : classe === 'Infl' ? (tx ? `IPCA + ${num(tx)}%` : 'IPCA+') : classe === 'Pre' ? (tx ? `${num(tx)}% a.a.` : 'Pré-fixado') : (p.estrategia || '');
    // Liquidez diária (CDB do custodiante e compromissada): o vencimento não importa para o cliente
    carac = liqDiaria ? [idx, 'liquidez diária'].join(' • ')
      : [m === 'coe' ? 'COE' : idx, ehComp ? 'compromissada • liquidez D+0' : '', p.vencimento ? dataBR(p.vencimento) : 'venc. não informado'].filter(Boolean).join(' • ');
  }
  else if (exterior) carac = `${p.subclasse}${p.usd ? ' • US$ ' + num(p.usd) : ''}`;
  else if (ehFIP) carac = tem(/ (mercados privados|private) /) ? 'Private equity' : 'FIP';
  else if (ehFIDC) carac = ['FIDC', liqFundo ? `resgate ${liqFundo}` : ''].filter(Boolean).join(' • ');
  else if (ehFII) carac = 'FII listado';
  else if (acaoDireta) carac = 'Ação listada';
  else if (ehLista) carac = 'ETF / ativo listado';
  else if (m === 'previdencia') carac = nomeLimpo(p.nomeAtivo).replace(/\b(FI|FIC|RF|Ref|DI|FIM|FIA|FC)\b/g, '').replace(/\s+/g, ' ').trim();
  else if (ehFundo) {
    const baseFundo = { Pos: 'Fundo pós-fixado', Infl: 'Fundo de inflação', Pre: 'Fundo pré-fixado', MM: 'Multimercado', Acoes: 'Fundo de ações', Intl: 'Fundo internacional', Alt: 'Fundo alternativo' }[classe] || 'Fundo';
    carac = [baseFundo, liqFundo ? `resgate ${liqFundo}` : ''].filter(Boolean).join(' • ');
  }
  else carac = p.estrategia || '—';

  // Veículo (como o dinheiro está aplicado), para abrir cada classe: fundo, título público, CDB, crédito privado…
  const veiculo = dp.veiculo || (p.receber ? 'Valores a receber' : classe === 'Caixa' ? 'Conta corrente' : m === 'previdencia' ? 'Previdência' : deriv ? 'Derivativos' : ehTP ? 'Título público'
    : ehBanc ? 'Renda fixa bancária' : ehPriv ? 'Crédito privado (CRI, CRA, debênture)' : m === 'coe' ? 'COE' : ehFIP ? 'FIP' : ehFIDC ? 'FIDC'
    : ehFII ? 'FII / Fiagro' : acaoDireta ? 'Ações' : exteriorDireto ? 'Ativos no exterior' : exterior ? 'Fundos e ETFs no exterior'
    : m === 'criptoativos' ? 'Criptoativos' : ehLista ? 'ETF' : ehFundo ? 'Fundos' : 'Outros');
  return { p, v: valor(p), classe, cp, direto, ge, papel, fgc, prazo, janela, anos, confirmado, nome, carac, veiculo, intl: classe === 'Intl' };
}

/* ---------- Componentes do padrão ---------- */
export function corLegivel(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.substr(i, 2), 16));
  if (0.299 * r + 0.587 * g + 0.114 * b <= 125) return hex;
  const k = 0.62, mix = (c, n) => Math.round(c * (1 - k) + n * k);
  return '#' + [mix(r, 0x0A), mix(g, 0x1F), mix(b, 0x44)].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}
export function donutDG(dados, centro, total) {
  const size = 250, ro = 118, ri = 76, gap = 1.2, cx = size / 2, cy = size / 2, out = [], fora = [];
  let ang = -90;
  out.push(`<svg viewBox="-70 -16 ${size + 140} ${size + 32}" class="donut" role="img" aria-label="Distribuição por classe">`);
  for (const { pct: pc, cor, rot } of dados) {
    const sweep = pc / 100 * 360;
    const a0 = ang + (sweep > 3 ? gap / 2 : 0), a1 = ang + Math.min(sweep, 359.99) - (sweep > 3 ? gap / 2 : 0);
    const big = (a1 - a0) > 180 ? 1 : 0, r0 = a0 * Math.PI / 180, r1 = a1 * Math.PI / 180;
    const P = [[cx + ro * Math.cos(r0), cy + ro * Math.sin(r0)], [cx + ro * Math.cos(r1), cy + ro * Math.sin(r1)],
      [cx + ri * Math.cos(r1), cy + ri * Math.sin(r1)], [cx + ri * Math.cos(r0), cy + ri * Math.sin(r0)]].map(x => x.map(v => v.toFixed(2)).join(','));
    out.push(`<path d="M ${P[0]} A ${ro} ${ro} 0 ${big} 1 ${P[1]} L ${P[2]} A ${ri} ${ri} 0 ${big} 0 ${P[3]} Z" fill="${cor}" data-tip="${esc(`${rot}\n${num(pc, 2)}% da carteira`)}"/>`);
    const am = (a0 + a1) / 2 * Math.PI / 180;
    if (pc >= 9) {
      const rm = (ro + ri) / 2, claro = 0.299 * parseInt(cor.substr(1, 2), 16) + 0.587 * parseInt(cor.substr(3, 2), 16) + 0.114 * parseInt(cor.substr(5, 2), 16) > 125;
      out.push(`<text x="${(cx + rm * Math.cos(am)).toFixed(1)}" y="${(cy + rm * Math.sin(am)).toFixed(1)}" text-anchor="middle" dominant-baseline="central" fill="${claro ? '#0A1F44' : '#FFF'}" font-size="13" font-weight="700">${num(pc, 1)}%</text>`);
    } else fora.push({ am, pc });
    ang += sweep;
  }
  for (const lado of ['d', 'e']) {
    const itens = fora.filter(f => (Math.cos(f.am) >= 0) === (lado === 'd')).map(f => ({ ...f, y: cy + (ro + 16) * Math.sin(f.am) })).sort((a, b) => a.y - b.y);
    let ult = -1e9;
    for (const it of itens) {
      const y = Math.max(it.y, ult + 15); ult = y;
      const s = lado === 'd' ? 1 : -1;
      const xa = cx + (ro + 2) * Math.cos(it.am), ya = cy + (ro + 2) * Math.sin(it.am), xb = cx + (ro + 26) * s;
      out.push(`<polyline points="${xa.toFixed(1)},${ya.toFixed(1)} ${xb},${y.toFixed(1)} ${xb + 4 * s},${y.toFixed(1)}" fill="none" stroke="#A8B4C4" stroke-width="1.1"/>`);
      out.push(`<text x="${xb + 6 * s}" y="${y.toFixed(1)}" text-anchor="${lado === 'd' ? 'start' : 'end'}" dominant-baseline="central" class="donut-ext" font-size="11.5" font-weight="700">${num(it.pc, 2)}%</text>`);
    }
  }
  out.push(`<text x="${cx}" y="${cy - 10}" text-anchor="middle" class="donut-k">${esc(centro)}</text>`);
  out.push(`<text x="${cx}" y="${cy + 12}" text-anchor="middle" class="donut-v">${esc(total)}</text></svg>`);
  return out.join('');
}
export const rsDG = v => brl(v);
export const pcDG = v => pct(v, 2);
export const nAtivos = n => `${n} ${n === 1 ? 'ativo' : 'ativos'}`;
export const secaoDG = (n, titulo, sub, corpo, grupo = '') => `<section class="rel-sec${grupo === 'consolidacao_integrada' ? ' sec-apenas-rel' : ''}" data-grupo="${grupo}"${grupo === 'consolidacao_integrada' ? ' style="display:none"' : ''}><div class="rel-cab"><span class="rel-num">${n}</span><div><h2 class="rel-h2">${esc(titulo)}</h2><p class="rel-sub">${esc(sub)}</p></div></div>${corpo}</section>`;
// Caixa de leitura: a análise em prosa curta que fecha cada bloco (seção 7 do padrão)
export const obsDG = (textos, titulo = 'Leitura', max = 3) => {
  const t = textos.filter(Boolean).slice(0, max);
  return t.length ? `<div class="leitura"><div class="leitura-k">${esc(titulo)}</div>${t.map(x => x.t ? `<p data-bloco="${x.bloco}">${x.t}</p>` : `<p>${x}</p>`).join('')}</div>` : '';
};
export const kpiDG = (k, v, s = '', cls = '', barra = null) => `<div class="kpi-dg ${cls}"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div>${s ? `<div class="s">${esc(s)}</div>` : ''}${barra !== null ? `<div class="shr"><i style="width:${Math.max(0, Math.min(100, barra * 100)).toFixed(2)}%"></i></div>` : ''}</div>`;
export interface ColunaDG {
  rot: string;
  w?: string;
  l?: boolean | number;
  cls?: string;
  f: (linha: any) => any;
}

export function tabelaDG(cols: ColunaDG[], linhas: any[], total: any[] | null = null): string {
  const cg = `<colgroup>${cols.map(c => `<col style="width:${c.w || 'auto'}">`).join('')}</colgroup>`;
  const th = cols.map(c => `<th class="${c.l ? 'l' : ''}">${esc(c.rot)}</th>`).join('');
  const tr = linhas.map(l => `<tr${l._attr ? ' ' + l._attr : ''}>${cols.map(c => `<td class="${c.l ? 'l' : 'num'} ${c.cls || ''}">${c.f(l)}</td>`).join('')}</tr>`).join('');
  const tt = total ? `<tr class="total">${cols.map((c, i) => `<td class="${c.l ? 'l' : 'num'}">${total[i] ?? ''}</td>`).join('')}</tr>` : '';
  return `<div class="dt-wrap"><table class="dt">${cg}<thead><tr>${th}</tr></thead><tbody>${tr}${tt}</tbody></table></div>`;
}
export const listaNomes = (itens, max = 3) => {
  const nomes = [...new Set(itens.map(i => i.nome))];
  return esc(nomes.slice(0, max).join(', ')) + (nomes.length > max ? ` e mais ${nomes.length - max}` : '');
};
export function agruparDG(L: any[], chave: (x: any) => any): { k: any; v: number; itens: any[] }[] {
  const m = new Map<any, { k: any; v: number; itens: any[] }>();
  for (const x of L) {
    const k = chave(x);
    let g = m.get(k);
    if (!g) { g = { k, v: 0, itens: [] }; m.set(k, g); }
    g.v = somaPrecisa(g.v, x.v);
    g.itens.push(x);
  }
  return [...m.values()].sort((a, b) => b.v - a.v);
}

/* ---------- Renderização da visão do cliente ---------- */
// Junta posições iguais do mesmo titular numa linha (ex.: "Previdência VGBL — 5 planos", "CDB BTG Pactual — 2 papéis")
export function agregarPosicoes(L, titularDe) {
  const m = new Map();
  for (const x of L) {
    const prev = norm(x.p.classe) === 'previdencia';
    const base = prev ? `Previdência ${x.p.tipoPlano || ''}`.trim() : x.nome;
    const k = [titularDe(x), x.p.instituicao, base, x.classe, x.cp, x.ge, x.prazo, x.janela, x.v < 0].join('|');
    let g = m.get(k);
    if (!g) m.set(k, g = { ...x, base, prev, n: 0, v: 0, caracs: new Set(), confirmado: true });
    g.n++; g.v = somaPrecisa(g.v, x.v); g.caracs.add(x.carac); g.confirmado = g.confirmado && x.confirmado;
  }
  return [...m.values()].map(g => {
    const nome = g.prev ? `${g.base} — ${g.n} ${g.n === 1 ? 'plano' : 'planos'}` : g.n > 1 ? `${g.base} — ${g.n} papéis` : g.base;
    const caracs = [...g.caracs];
    const carac = caracs.length === 1 ? caracs[0] : caracs[0].replace(/ • \d{2}\/\d{2}\/\d{4}$/, '');
    return { ...g, nome, carac };
  });
}
// Barra empilhada da composição (só segmentos positivos), com legenda
// Composição por classe em barras horizontais: nome, barra proporcional, % e R$
export function barrasClasse(itens, cor, total, duasColunas = false) {
  const pos = itens.filter(c => c.v > 0), max = Math.max(...pos.map(c => c.v), 1);
  return `<div class="hbars-dg${duasColunas ? ' duas' : ''}">${pos.map(c => `<div class="hb" data-tip="${esc(`${CLASSES_EST[c.k]}\n${rsDG(c.v)} • ${num(c.v / total * 100, 2)}% da carteira`)}">
    <span class="hb-n"><span class="sw" style="background:${cor.get(c.k)}"></span>${esc(CLASSES_EST[c.k].split(' (')[0])}</span>
    <span class="hb-t"><i style="width:${(c.v / max * 100).toFixed(2)}%;background:${cor.get(c.k)}"></i></span>
    <span class="hb-p">${num(c.v / total * 100, 2)}%</span><span class="hb-v">${rsDG(c.v)}</span></div>`).join('')}</div>`;
}

export function renderDiag(s: any, P: any[]) {
  const alvo = $('#diag');
  const datas = P.map(p => p.data).filter(Boolean);
  const base = datas.length ? new Date(Math.max(...datas)) : new Date();
  const todos = P.map(p => dgEnriquecer(p, base)).filter(x => Math.abs(x.v) > 0.004);
  // Valores em trânsito não são posição alocável: ficam fora da análise, com nota
  const transito = todos.filter(x => x.p.transito && norm(x.p.classe) !== 'derivativos');
  const vTransito = somaLista(transito, (x: any) => x.v);
  const notaTransito = transito.length ? `Os valores em trânsito de ${rsDG(vTransito)} que constam do extrato foram excluídos desta análise: não representam posição alocável.` : '';
  const brutos = todos.filter(x => !transito.includes(x));
  const total = somaLista(brutos, (x: any) => x.v);
  if (!brutos.length || !(total > 0)) { alvo.innerHTML = ''; return; }

  // Titular: na família, cada cliente; numa pessoa com várias contas, cada conta
  const porFamilia = s.tipo === 'familia';
  const titularDe = x => porFamilia ? x.p.clienteNome : x.p.conta;
  const rotTit = k => porFamilia ? k : (S.descConta?.get(k) ? `${S.descConta.get(k)} (${k})` : `Conta ${k}`);
  const L = agregarPosicoes(brutos, titularDe);
  const titulares = agruparDG(L, titularDe);
  const multi = titulares.length > 1;
  const curto = k => {
    if (!porFamilia) return S.descConta?.get(k) ? S.descConta.get(k).split(' —')[0] : k;
    const f = String(k).split(' ')[0];
    return titulares.filter(t => String(t.k).split(' ')[0] === f).length > 1 ? k : f;
  };
  // Coluna "Tit.": inicial do titular (D / A); se duas iniciais coincidirem, usa o nome curto
  const iniciais = titulares.map(t => String(curto(t.k)).charAt(0).toUpperCase());
  const iniciaisUnicas = new Set(iniciais).size === iniciais.length;
  const inicial = x => multi ? esc(porFamilia && iniciaisUnicas ? String(curto(titularDe(x))).charAt(0).toUpperCase() : curto(titularDe(x))) : '';

  const classes = agruparDG(L, x => x.classe);
  const cor = new Map(classes.map((c, i) => [c.k, PALETA_DG[i % PALETA_DG.length]]));
  const sw = k => `<span class="sw" style="background:${cor.get(k)}"></span>`;
  const pcT = v => pcDG(v / total);
  const neg = L.filter(x => x.v < 0);
  const cps = agruparDG(L, x => x.cp);

  // Travas: toda visão soma o total (seção 3 do padrão)
  const eq = (a, b) => Math.abs(a - b) < 0.02;
  const travas = ([['classe', classes], ['contraparte', cps], ['horizonte', agruparDG(L, x => x.prazo)], ['titular', titulares], ['gestora/emissor', agruparDG(L, x => x.ge)], ['liquidez', agruparDG(L, x => x.janela)]] as [string, { k: any; v: number; itens: any[] }[]][])
    .filter(([, g]) => !eq(somaLista(g, (x: any) => x.v), total)).map(([n]) => n);
  if (travas.length) { alvo.innerHTML = `<div class="erro">Os agregados não fecham com o total (${esc(travas.join(', '))}). A visão foi bloqueada para não mostrar número errado.</div>`; return; }

  // Seções: { t, sub, corpo }. A numeração (01, 02…) é feita no fim, porque seções longas podem ser divididas
  const secoes = [];
  const sec = (t, sub, corpo) => secoes.push({ t, sub, corpo, grupo: grupoAtual });
  // Itens do relatório: cada seção pertence a um grupo e alguns quadros são blocos que podem sair do PDF
  // (padrao = vem marcado no filtro do relatório; opcional = vem desmarcado)
  const itensRel = [];
  let grupoAtual = '';
  const grupo = (id, rot, padrao = true) => { grupoAtual = id; itensRel.push({ id, rot, padrao, blocos: [] }); };
  const bl = (id, rot, padrao, html) => { itensRel.at(-1).blocos.push({ id, rot, padrao }); return `<div class="bl-rel" data-bloco="${id}">${html}</div>`; };
  const intl = somaLista(L.filter(x => x.intl), x => x.v);
  const prevs = L.filter(x => x.prev), vPrev = somaLista(prevs, x => x.v), nPlanos = somaLista(prevs, x => x.n);
  const contas = [...new Set(brutos.map(x => x.p.conta))];
  const insts = [...new Set(brutos.map(x => x.p.instituicao))];
  const colTit = multi ? [{ rot: 'Tit.', w: '6%', l: 1, cls: 'ativos', f: x => inicial(x) }] : [];
  // Várias instituições: coluna "Inst." nas tabelas e o painel de custódia
  const multiInst = insts.length > 1;
  const NOME_INST = { BTG: 'BTG Pactual', XP: 'XP Investimentos', Nomad: 'Nomad (offshore)', Rhino: 'Rhino Securitizadora', Safra: 'Safra' };
  const SIGLA_INST = { BTG: 'BTG', XP: 'XP', Nomad: 'NOM', Rhino: 'RHI', Safra: 'SAF' };
  const sigla = i => SIGLA_INST[i] || String(i).slice(0, 3).toUpperCase();
  const colInst = multiInst ? [{ rot: 'Inst.', w: '6%', l: 1, cls: 'ativos', f: x => esc(sigla(x.p.instituicao)) }] : [];
  const colTI = [...colTit, ...colInst];

  /* 01 — Consolidação patrimonial */
  let tabCpInst = '';
  grupo('consolidacao', 'Consolidação patrimonial');
  {
    const usdTot = somaLista(L, x => x.p.usd);
    let k = kpiDG('Patrimônio consolidado', rsDG(total), `${brutos.length} posições • ${contas.length} ${contas.length === 1 ? 'conta' : 'contas'}${insts.length > 1 ? ' em ' + insts.join(', ') : ''}${vTransito ? ` • + ${rsDG(vTransito)} em trânsito, fora da análise` : ''}`, 'main');
    const tops = multi ? titulares.slice(0, titulares.length > 2 ? 1 : 2) : [];
    for (const t of tops) k += kpiDG(rotTit(t.k), rsDG(t.v), `${pcT(t.v)} • ${[...new Set(t.itens.map(x => x.p.conta))].map(c => 'conta ' + c).join(', ')}`, '', t.v / total);
    if (multi && titulares.length > 2) k += kpiDG(porFamilia ? 'Clientes' : 'Contas', String(titulares.length), titulares.map(t => curto(t.k)).join(', '));
    if (!multi) k += kpiDG('Classes de ativo', String(classes.length), `maior: ${CLASSES_EST[classes[0].k]} (${pcT(classes[0].v)})`);
    if (!multi && !vPrev) k += kpiDG('Instituições', String(insts.length), insts.map(i => i === 'BTG' ? 'BTG Pactual' : i).join(', '));
    k += vPrev && !intl ? kpiDG('Previdência', pcT(vPrev), `${rsDG(vPrev)} • ${nPlanos} ${nPlanos === 1 ? 'plano' : 'planos'}`, '', vPrev / total)
               : kpiDG('Exposição internacional', pcT(intl), intl ? `${rsDG(intl)}${usdTot ? ` • US$ ${num(usdTot)} no exterior` : ''}` : 'Carteira 100% Brasil, 100% em reais');
    let corpo = `<div class="kpis-dg">${k}</div>`;
    if (!multiInst) corpo += bl('composicao', 'Composição por classe', true, `<div class="box-k">Composição por classe estratégica</div>${barrasClasse(classes, cor, total, true)}`);
    if (!multiInst && contas.length > 1) {
      // Uma instituição com 2+ contas: posição por conta (instituição, conta, titular, data-base)
      const porConta = agruparDG(L, x => x.p.conta);
      // Titular de cada conta: descrição do cadastro (ex.: "PJ — Holding Patrimonial"); PF = nome do cliente;
      // sem descrição, o nome do titular que veio no extrato (a planilha do BTG só traz o primeiro nome)
      const titularConta = (g: any) => {
        const p = g.itens[0].p, d = S.descConta?.get(g.k);
        if (d) return /^(pessoa f|pf$)/i.test(d) ? `${p.clienteNome} — PF` : /^PJ\s*[—-]/i.test(d) ? d.replace(/^PJ\s*[—-]\s*/i, '') + ' — PJ' : d;
        const t = p.titular || p.nome;
        return t && !soPrimeiroNome(t) && norm(t) !== norm(p.clienteNome) ? nomeProprio(t) : p.clienteNome;
      };
      const dataConta = (g: any) => { const dt = g.itens.map((x: any) => x.p.data).filter(Boolean); return dt.length ? dataBR(new Date(Math.max(...dt))) : '—'; };
      corpo += bl('custodia', 'Posição por conta', true, `<div class="box-k bloco-dg">Posição por conta e instituição</div>` + tabelaDG([
        { rot: 'Instituição', w: '13%', l: 1, f: (g: any) => esc(NOME_INST[g.itens[0].p.instituicao] || g.itens[0].p.instituicao) },
        { rot: 'Conta', w: '12%', l: 1, f: (g: any) => esc(String(g.k).replace(new RegExp('^' + g.itens[0].p.instituicao + '\s+'), '')) },
        { rot: 'Titular', w: '33%', l: 1, f: (g: any) => `<span class="nm">${esc(titularConta(g))}</span>` },
        { rot: 'Data-base', w: '11%', l: 1, f: (g: any) => dataConta(g) },
        { rot: 'Valor (R$)', w: '15%', f: (g: any) => rsDG(g.v) }, { rot: '% cart.', w: '9%', f: (g: any) => pcT(g.v) }, { rot: 'Nº', w: '7%', f: (g: any) => g.itens.length },
      ], porConta, ['TOTAL CONSOLIDADO', `${porConta.length} contas`, '', '', rsDG(total), '100,00%', L.length]));
    } else if (titulares.length > 2) {
      corpo += `<div class="box-k bloco-dg">Distribuição por ${porFamilia ? 'cliente' : 'conta'}</div>` + tabelaDG([
        { rot: porFamilia ? 'Cliente' : 'Conta', w: '34%', l: 1, f: t => `<span class="nm">${esc(rotTit(t.k))}</span>` },
        { rot: 'Contas', w: '30%', l: 1, cls: 'ativos', f: t => esc([...new Set(t.itens.map(x => x.p.conta))].join(' • ')) },
        { rot: 'Total (R$)', w: '18%', f: t => rsDG(t.v) }, { rot: '%', w: '10%', f: t => pcT(t.v) }, { rot: 'Nº', w: '8%', f: t => t.itens.length },
      ], titulares, ['TOTAL', `${contas.length} contas`, rsDG(total), '100,00%', L.length]);
    }
    // Maiores posições (dez quando há várias instituições, oito quando há uma)
    const top8 = [...L].sort((a, b) => b.v - a.v).slice(0, multiInst ? 10 : 8), v8 = somaLista(top8, x => x.v);
    const tab8 = tabelaDG([
      { rot: 'Posição', w: multi ? '52%' : '58%', l: 1, f: x => `<span class="nm">${top8.indexOf(x) + 1}. ${esc(x.nome)}</span>` }, ...colTI,
      { rot: 'Valor (R$)', w: '24%', f: x => rsDG(x.v) }, { rot: '% cart.', w: '18%', f: x => pcT(x.v) },
    ], top8, [`SOMA DAS ${top8.length} MAIORES`, ...colTI.map(() => ''), rsDG(v8), pcT(v8)]);
    const tabCp = tabelaDG([
      { rot: 'Contraparte', w: '30%', l: 1, f: c => `<span class="nm">${esc(CONTRAPARTES[c.k])}</span>` },
      { rot: 'Composição', w: '36%', l: 1, cls: 'ativos', f: c => listaNomes(c.itens, 2) },
      { rot: 'Valor (R$)', w: '20%', f: c => rsDG(c.v) }, { rot: '%', w: '14%', f: c => pcT(c.v) },
    ], cps);
    tabCpInst = tabCp;
    const porInst = agruparDG(L, x => x.p.instituicao);
    const descInst = g => {
      const ps = g.itens.map(x => x.p), cts = [...new Set(ps.map(p => String(p.conta).replace(new RegExp('^' + g.k + '\\s+'), '')))];
      const dt = ps.map(p => p.data).filter(Boolean), d = dt.length ? dataBR(new Date(Math.max(...dt))) : null;
      const usd = somaLista(ps, (p: any) => p.usd), pc = ps.find((p: any) => p.cambio), cb = pc?.cambio;
      const dCb = pc?.cambioData ? ` (PTAX ${pc.cambioData.split('-').reverse().join('/')})` : '';
      const quem = porFamilia ? `(${[...new Set(ps.map(p => p.clienteNome.split(' ')[0]))].join(', ')})` : '';
      const emUSD = usd ? `US$ ${num(usd)}${cb ? ` a R$ ${num(cb, 4)}${dCb}` : ''}` : '';
      if (usd && ps.every(p => p.usd)) return `Carteira nos EUA • ${emUSD}`;
      return `${cts.length > 1 ? 'Contas' : 'Conta'} ${cts.join(' e ')} ${quem}${d ? ` • data-base ${d}` : ''}${emUSD ? ` • inclui ${emUSD}` : ''}`.replace(/\s+/g, ' ').trim();
    };
    const tabInst = tabelaDG([
      { rot: 'Instituição', w: '24%', l: 1, f: g => `<span class="nm">${esc(NOME_INST[g.k] || g.k)}</span>` }, { rot: 'Contas e data-base', w: '36%', l: 1, cls: 'ativos', f: g => esc(descInst(g)) },
      { rot: 'Valor (R$)', w: '18%', f: g => rsDG(g.v) }, { rot: '% cart.', w: '12%', f: g => pcT(g.v) }, { rot: 'Nº', w: '10%', f: g => g.itens.length },
    ], porInst, ['TOTAL CONSOLIDADO', `${porInst.length} instituições`, rsDG(total), '100,00%', L.length]);
    // Várias instituições: custódia + classe por instituição (padrão) e dez maiores (opcional); uma instituição: oito maiores + contraparte
    let matrizInst = '';
    if (multiInst) {
      const cols: ColunaDG[] = [{ rot: 'Classe', w: '24%', l: 1, f: (c: any) => `${sw(c.k)}<span class="nm">${esc(CLASSES_EST[c.k].split(' (')[0])}</span>` }];
      const vI = (c: any, i: any) => somaLista(c.itens.filter((x: any) => x.p.instituicao === i.k), (x: any) => x.v);
      for (const i of porInst) cols.push({ rot: sigla(i.k), w: 'auto', f: c => vI(c, i) ? rsDG(vI(c, i)) : '—' });
      cols.push({ rot: 'Consolidado', w: 'auto', cls: 'tot', f: c => rsDG(c.v) }, { rot: '%', w: '8%', cls: 'tot', f: c => pcT(c.v) });
      matrizInst = tabelaDG(cols, classes, ['TOTAL', ...porInst.map(i => rsDG(i.v)), rsDG(total), '100,00%']);
    }
    // Várias instituições: à esquerda a custódia e, embaixo, a composição por classe; à direita a classe por instituição
    corpo += multiInst
      ? `<div class="dg-2col dg-auto dg-multi bloco-dg"><div class="col-dg">${bl('custodia', 'Onde o patrimônio está custodiado', true, `<div class="box-k">Onde o patrimônio está custodiado</div>${tabInst}`)}`
        + bl('composicao', 'Composição por classe', true, `<div class="box-k">Composição por classe estratégica</div>${barrasClasse(classes, cor, total)}`) + '</div>'
        + bl('classeInst', 'Classe estratégica por instituição', true, `<div class="box-k">Classe estratégica por instituição <span class="bk-x">valores em R$</span></div>${matrizInst}`)
        + bl('top', 'Dez maiores posições', false, `<div class="box-k">Dez maiores posições <span class="bk-x">${pcT(v8)} da carteira</span></div>${tab8}`) + '</div>'
      : `<div class="dg-2col dg-auto bloco-dg">${bl('top', 'Oito maiores posições', true, `<div class="box-k">Oito maiores posições</div>${tab8}`)}`
        + bl('contraparte', 'Visão por contraparte', true, `<div class="box-k">Visão por contraparte <span class="bk-x">de quem é o risco</span></div>${tabCp}`) + '</div>';
    sec('Consolidação Patrimonial', multiInst ? 'Onde o patrimônio está custodiado, de quem é cada carteira e como cada classe se divide entre as instituições.' : multi ? `Como o patrimônio se divide entre ${porFamilia ? 'os titulares' : 'as contas'} e de quem é o risco de cada real.` : 'O tamanho da carteira, onde ela está e de quem é o risco de cada real.', corpo);
  }

  /* 01b — Consolidação Patrimonial (Integrada: Custódia + Rosca e Classes) */
  grupo('consolidacao_integrada', 'Consolidação Patrimonial (Integrada: Custódia + Rosca e Classes)', false);
  {
    const usdTot = somaLista(L, x => x.p.usd);
    let k = kpiDG('Patrimônio consolidado', rsDG(total), `${brutos.length} posições • ${contas.length} ${contas.length === 1 ? 'conta' : 'contas'}${insts.length > 1 ? ' em ' + insts.join(', ') : ''}${vTransito ? ` • + ${rsDG(vTransito)} em trânsito, fora da análise` : ''}`, 'main');
    const tops = multi ? titulares.slice(0, titulares.length > 2 ? 1 : 2) : [];
    for (const t of tops) k += kpiDG(rotTit(t.k), rsDG(t.v), `${pcT(t.v)} • ${[...new Set(t.itens.map(x => x.p.conta))].map(c => 'conta ' + c).join(', ')}`, '', t.v / total);
    if (multi && titulares.length > 2) k += kpiDG(porFamilia ? 'Clientes' : 'Contas', String(titulares.length), titulares.map(t => curto(t.k)).join(', '));
    if (!multi) k += kpiDG('Classes de ativo', String(classes.length), `maior: ${CLASSES_EST[classes[0].k]} (${pcT(classes[0].v)})`);
    if (!multi && !vPrev) k += kpiDG('Instituições', String(insts.length), insts.map(i => i === 'BTG' ? 'BTG Pactual' : i).join(', '));
    k += vPrev && !intl ? kpiDG('Previdência', pcT(vPrev), `${rsDG(vPrev)} • ${nPlanos} ${nPlanos === 1 ? 'plano' : 'planos'}`, '', vPrev / total)
               : kpiDG('Exposição internacional', pcT(intl), intl ? `${rsDG(intl)}${usdTot ? ` • US$ ${num(usdTot)} no exterior` : ''}` : 'Carteira 100% Brasil, 100% em reais');

    // Onde o Patrimônio está Custodiado: Tabela detalhando instituição, número da conta, titular (PF ou PJ/Holding), data-base, valor financeiro e % da carteira
    const porConta = agruparDG(L, x => x.p.conta);
    const titularConta = (g: any) => {
      const p = g.itens[0].p, d = S.descConta?.get(g.k);
      if (d) return /^(pessoa f|pf$)/i.test(d) ? `${p.clienteNome} — PF` : /^PJ\s*[—-]/i.test(d) ? d.replace(/^PJ\s*[—-]\s*/i, '') + ' — PJ' : d;
      const t = p.titular || p.nome;
      return t && !soPrimeiroNome(t) && norm(t) !== norm(p.clienteNome) ? nomeProprio(t) : p.clienteNome;
    };
    const dataConta = (g: any) => { const dt = g.itens.map((x: any) => x.p.data).filter(Boolean); return dt.length ? dataBR(new Date(Math.max(...dt))) : '—'; };
    const tabCustodia = tabelaDG([
      { rot: 'Instituição', w: '16%', l: 1, f: (g: any) => esc(NOME_INST[g.itens[0].p.instituicao] || g.itens[0].p.instituicao) },
      { rot: 'Conta', w: '14%', l: 1, f: (g: any) => esc(String(g.k).replace(new RegExp('^' + g.itens[0].p.instituicao + '\\s+'), '')) },
      { rot: 'Titular', w: '30%', l: 1, f: (g: any) => `<span class="nm">${esc(titularConta(g))}</span>` },
      { rot: 'Data-base', w: '12%', l: 1, f: (g: any) => dataConta(g) },
      { rot: 'Valor (R$)', w: '16%', f: (g: any) => rsDG(g.v) },
      { rot: '% cart.', w: '12%', f: (g: any) => pcT(g.v) },
    ], porConta, ['TOTAL CONSOLIDADO', `${porConta.length} ${porConta.length === 1 ? 'conta' : 'contas'}`, '', '', rsDG(total), '100,00%']);

    // Gráfico Donut (Rosca) e Tabela de Classes
    const positivas = classes.filter(c => c.v > 0);
    const somaPos = somaLista(positivas, c => c.v);
    const rosca = donutDG(positivas.map(c => ({ pct: divPrecisa(c.v, somaPos) * 100, cor: cor.get(c.k), rot: CLASSES_EST[c.k] })), multi ? 'Consolidado' : 'Carteira', brlCurto(total).replace(/ mi$/, ' MM'));
    const tabClasses = tabelaDG([
      { rot: 'Classe estratégica', w: '26%', l: 1, f: c => `${sw(c.k)}<span class="nm">${esc(CLASSES_EST[c.k])}</span>` },
      { rot: 'Valor (R$)', w: '17%', f: c => rsDG(c.v) },
      { rot: '%', w: '9%', f: c => pcT(c.v) },
      { rot: 'Nº', w: '6%', f: c => c.itens.length },
      { rot: 'Composição', w: '42%', l: 1, cls: 'ativos', f: c => listaNomes(c.itens) },
    ], classes, ['TOTAL CONSOLIDADO', rsDG(total), '100,00%', L.length, `${contas.length} ${contas.length === 1 ? 'conta' : 'contas'} • ${insts.map(i => i === 'BTG' ? 'BTG Pactual' : i).join(', ')}`]);

    let corpoInt = `<div class="kpis-dg">${k}</div>` +
      bl('custodia', 'Onde o patrimônio está custodiado', true, `<div class="box-k bloco-dg">Onde o patrimônio está custodiado <span class="bk-x">instituição, conta, titular e data-base</span></div>${tabCustodia}`) +
      bl('classes', 'Alocação por classe estratégica (Donut e Tabela)', true, `<div class="box-k bloco-dg">Alocação por classe estratégica <span class="bk-x">visão consolidada com look-through</span></div><div class="dg-classe"><div class="dg-rosca">${rosca}</div><div>${tabClasses}</div></div>`);

    sec('Consolidação Patrimonial', 'Visão consolidada da carteira: onde o patrimônio está custodiado e alocação estratégica por classe.', corpoInt);
  }

  /* 02 — Alocação por classe estratégica */
  grupo('classes', 'Alocação por classe estratégica');
  {
    const positivas = classes.filter(c => c.v > 0);
    const somaPos = somaLista(positivas, c => c.v);
    const rosca = donutDG(positivas.map(c => ({ pct: divPrecisa(c.v, somaPos) * 100, cor: cor.get(c.k), rot: CLASSES_EST[c.k] })), multi ? 'Consolidado' : 'Carteira', brlCurto(total).replace(/ mi$/, ' MM'));
    const tabClasses = tabelaDG([
      { rot: 'Classe estratégica', w: '26%', l: 1, f: c => `${sw(c.k)}<span class="nm">${esc(CLASSES_EST[c.k])}</span>` },
      { rot: 'Valor (R$)', w: '17%', f: c => rsDG(c.v) }, { rot: '%', w: '9%', f: c => pcT(c.v) }, { rot: 'Nº', w: '6%', f: c => c.itens.length },
      { rot: 'Composição', w: '42%', l: 1, cls: 'ativos', f: c => listaNomes(c.itens) },
    ], classes, ['TOTAL CONSOLIDADO', rsDG(total), '100,00%', L.length, `${contas.length} ${contas.length === 1 ? 'conta' : 'contas'} • ${insts.map(i => i === 'BTG' ? 'BTG Pactual' : i).join(', ')}`]);
    let corpo = `<div class="dg-classe"><div class="dg-rosca">${rosca}</div><div>${tabClasses}</div></div>`;
    if (multi) {
      const cols: ColunaDG[] = [{ rot: 'Classe estratégica', w: '22%', l: 1, f: (c: any) => `${sw(c.k)}<span class="nm">${esc(CLASSES_EST[c.k])}</span>` }];
      const vT = (c: any, t: any) => somaLista(c.itens.filter((x: any) => titularDe(x) === t.k), (x: any) => x.v);
      for (const t of titulares) {
        cols.push({ rot: `${curto(t.k)} (R$)`, w: 'auto', f: c => vT(c, t) ? rsDG(vT(c, t)) : '—' });
        cols.push({ rot: '%', w: '7%', f: c => vT(c, t) ? pcDG(vT(c, t) / t.v) : '—' });
      }
      cols.push({ rot: 'Consolidado (R$)', w: 'auto', cls: 'tot', f: c => rsDG(c.v) }, { rot: '% cart.', w: '7%', cls: 'tot', f: c => pcT(c.v) });
      corpo += bl('titular', `Classe estratégica por ${porFamilia ? 'titular' : 'conta'}`, true, `<div class="box-k bloco-dg">Classe estratégica por ${porFamilia ? 'titular' : 'conta'} <span class="bk-x">% dentro da carteira de cada ${porFamilia ? 'titular' : 'conta'}</span></div>` +
        tabelaDG(cols, classes, ['TOTAL', ...titulares.flatMap(t => [rsDG(t.v), '100,00%']), rsDG(total), '100,00%']));
    }
    // Cada classe aberta pelos veículos que a compõem (fundos, título público, CDB, crédito privado, previdência…)
    {
      const linhas = [];
      for (const c of classes) {
        linhas.push({ _attr: 'class="grupo-v"', cab: true, c, v: c.v, n: c.itens.length });
        for (const g of agruparDG(c.itens, x => x.veiculo)) linhas.push({ c, g, v: g.v, n: g.itens.length });
      }
      corpo += bl('veiculo', 'Classe por veículo', false, `<div class="box-k bloco-dg">Classe estratégica por veículo <span class="bk-x">como o dinheiro de cada classe está aplicado</span></div>` + tabelaDG([
        { rot: 'Classe / veículo', w: '26%', l: 1, f: r => r.cab ? `${sw(r.c.k)}<span class="nm">${esc(CLASSES_EST[r.c.k])}</span>` : `<span class="veic">${esc(r.g.k)}</span>` },
        { rot: 'Composição', w: '38%', l: 1, cls: 'ativos', f: r => r.cab ? '' : listaNomes(r.g.itens, 3) },
        { rot: 'Valor (R$)', w: '14%', f: r => rsDG(r.v) }, { rot: '% classe', w: '8%', f: r => r.cab ? '' : pcDG(r.v / r.c.v) },
        { rot: '% cart.', w: '8%', f: r => pcT(r.v) }, { rot: 'Nº', w: '6%', f: r => r.n },
      ], linhas, ['TOTAL CONSOLIDADO', '', rsDG(total), '', '100,00%', L.length]));
    }
    const c0 = classes[0];
    const credito = somaLista(cps.filter(c => ['Corp', 'Estr'].includes(c.k)), c => c.v);
    const caixa = classes.find(c => c.k === 'Caixa')?.v || 0;
    const fator = classes.filter(c => ['Pos', 'Infl', 'Pre'].includes(c.k)).sort((a, b) => b.v - a.v)[0];
    const notaNeg = neg.length ? `${neg.map(x => esc(x.nome)).join(', ')} tem marcação negativa (${rsDG(somaLista(neg, x => x.v))}): entra na tabela, na classe do fator que carrega, mas não vira fatia da rosca.` : '';
    const textos = [
      `A maior classe é ${esc(CLASSES_EST[c0.k].toLowerCase())}, com ${rsDG(c0.v)} (${pcT(c0.v)}).${classes[1] ? ` Em seguida vem ${esc(CLASSES_EST[classes[1].k].toLowerCase())} (${pcT(classes[1].v)}).` : ''}`,
      fator && fator.v / total >= 0.7 ? `Carteira monofator: ${pcT(fator.v)} está atrelado a um único indexador (${esc(CLASSES_EST[fator.k])}).` : '',
      credito > 0 ? `O que efetivamente carrega risco de crédito privado soma ${rsDG(credito)} (${pcT(credito)}), entre crédito corporativo e estruturado. A base não traz rating desses papéis.` : '',
      caixa / total >= 0.1 ? `O caixa (${pcT(caixa)}) não é alocação: é dinheiro à espera de decisão.` : '',
      intl === 0 ? 'Não há exposição internacional: o patrimônio depende integralmente do ciclo econômico brasileiro.' : '',
      notaNeg,
    ];
    sec('Alocação por Classe Estratégica', 'A que cada real está de fato atrelado, após o look-through de fundos, FIPs, FIIs, ETFs e previdência.', corpo + obsDG(textos, 'Como a carteira se organiza', 4));
  }

  /* 02b — Alocação por Classe Estratégica Vs Política de Investimentos */
  grupo('politica_classes', 'Alocação vs. Política de Investimentos', true);
  {
    const pol = obterPoliticaDe(s);
    const polCl = pol.classes || {};
    const positivas = classes.filter(c => c.v > 0);
    const somaPos = somaLista(positivas, c => c.v);
    const rosca = donutDG(positivas.map(c => ({ pct: divPrecisa(c.v, somaPos) * 100, cor: cor.get(c.k), rot: CLASSES_EST[c.k] })), 'Alocação Atual', brlCurto(total).replace(/ mi$/, ' MM'));
    
    const tabClasses = tabelaDG([
      { rot: 'Classe estratégica', w: '35%', l: 1, f: c => `${sw(c.k)}<span class="nm">${esc(CLASSES_EST[c.k])}</span>` },
      { rot: 'Valor (R$)', w: '25%', f: c => rsDG(c.v) },
      { rot: '% carteira', w: '20%', f: c => pcT(c.v) },
      { rot: 'Nº ativos', w: '20%', f: c => c.itens.length },
    ], classes, ['TOTAL', rsDG(total), '100,00%', L.length]);

    const linhasPol = classes.map(c => {
      const pReg = polCl[c.k] || { min: 0, alvo: c.v / total, max: 1 };
      const pctAtual = c.v / total;
      let status = 'Enquadrado', statusCls = 'st-ok';
      if (pctAtual < pReg.min - 0.0001) { status = 'Abaixo do Mínimo'; statusCls = 'st-al'; }
      else if (pctAtual > pReg.max + 0.0001) { status = 'Acima do Máximo'; statusCls = 'st-er'; }
      return { c, pReg, pctAtual, status, statusCls };
    });

    const tabPolitica = tabelaDG([
      { rot: 'Classe', w: '28%', l: 1, f: r => `${sw(r.c.k)}<span class="nm">${esc(CLASSES_EST[r.c.k].split(' (')[0])}</span>` },
      { rot: 'Mínimo', w: '14%', f: r => pcDG(r.pReg.min) },
      { rot: 'Alvo', w: '14%', f: r => pcDG(r.pReg.alvo) },
      { rot: 'Máximo', w: '14%', f: r => pcDG(r.pReg.max) },
      { rot: 'Atual', w: '14%', f: r => pcDG(r.pctAtual) },
      { rot: 'Status', w: '16%', l: 1, f: r => `<span class="${r.statusCls}">${r.status}</span>` },
    ], linhasPol);

    const movsEnquadramento = [];
    for (const r of linhasPol) {
      const vAtual = r.c.v;
      const vMin = multPrecisa(r.pReg.min, total);
      const vMax = multPrecisa(r.pReg.max, total);
      const vAlvo = multPrecisa(r.pReg.alvo, total);
      if (r.pctAtual < r.pReg.min - 0.0001) {
        movsEnquadramento.push({
          c: r.c,
          tipo: 'Aplicar',
          motivo: `Abaixo do mínimo (${pcDG(r.pctAtual)} < ${pcDG(r.pReg.min)})`,
          deltaMin: subPrecisa(vMin, vAtual),
          deltaAlvo: subPrecisa(vAlvo, vAtual),
          cls: 'st-al'
        });
      } else if (r.pctAtual > r.pReg.max + 0.0001) {
        movsEnquadramento.push({
          c: r.c,
          tipo: 'Resgatar',
          motivo: `Acima do teto (${pcDG(r.pctAtual)} > ${pcDG(r.pReg.max)})`,
          deltaMin: subPrecisa(vAtual, vMax),
          deltaAlvo: subPrecisa(vAtual, vAlvo),
          cls: 'st-er'
        });
      }
    }

    const htmlMovs = movsEnquadramento.length ? tabelaDG([
      { rot: 'Ação Recomendada', w: '26%', l: 1, f: m => `<span class="${m.cls}"><b>${m.tipo}</b> em ${esc(CLASSES_EST[m.c.k].split(' (')[0])}</span>` },
      { rot: 'Diagnóstico do Range', w: '30%', l: 1, cls: 'ativos', f: m => m.motivo },
      { rot: 'Mov. p/ Enquadrar no Limite', w: '22%', f: m => `<b>${rsDG(m.deltaMin)}</b>` },
      { rot: 'Mov. p/ Chegar ao Alvo', w: '22%', f: m => rsDG(m.deltaAlvo) },
    ], movsEnquadramento) : '<p class="ok-txt" style="padding:10px 0;margin:0;">✔ <b>Carteira 100% enquadrada:</b> todas as classes estão dentro da banda de tolerância definida na política de investimentos.</p>';

    let corpo = `<div class="dg-classe"><div class="dg-rosca">${rosca}</div><div><div class="box-k">Alocação Atual por Classe</div>${tabClasses}</div></div>
      <div class="box-k bloco-dg">Política de Investimentos Definida <span class="bk-x">Parâmetros de Alocação e Faixas de Tolerância</span></div>${tabPolitica}
      <div class="box-k bloco-dg">Movimentações para Enquadramento na Política <span class="bk-x">Cálculo de Rebalanceamento respeitando a Banda de Tolerância</span></div>${htmlMovs}`;

    sec('Alocação por Classe Estratégica Vs Política de Investimentos', 'Comparativo da alocação real frente aos limites estipulados na política de investimentos e simulação de movimentos necessários para enquadramento.', corpo);
  }

  /* 02c — Visão de Risco de Crédito Vs Política de Investimentos */
  grupo('risco_credito', 'Visão de Risco de Crédito vs. Política', true);
  {
    const pol = obterPoliticaDe(s);
    const polCred = pol.credito || {};
    
    // Metade 1: Visão de Risco de Crédito Atual (com look-through)
    const tabRiscoAtual = tabelaDG([
      { rot: 'Risco de Crédito', w: '36%', l: 1, f: c => `<span class="nm">${esc(RISCO_CREDITO[c.k] || c.k)}</span>` },
      { rot: 'Ativos Principais', w: '34%', l: 1, cls: 'ativos', f: c => listaNomes(c.itens, 2) },
      { rot: 'Valor (R$)', w: '18%', f: c => rsDG(c.v) },
      { rot: '% cart.', w: '12%', f: c => pcT(c.v) },
    ], cps, ['TOTAL', `${cps.length} categorias`, rsDG(total), '100,00%']);

    // Metade 2: Política de Investimentos para Risco de Crédito
    const linhasPolCred = cps.map(c => {
      const pReg = polCred[c.k] || { min: 0, alvo: c.v / total, max: 0.25 };
      const pctAtual = c.v / total;
      let status = 'Enquadrado', statusCls = 'st-ok';
      if (pctAtual < pReg.min - 0.0001) { status = 'Abaixo do Mín'; statusCls = 'st-al'; }
      else if (pctAtual > pReg.max + 0.0001) { status = 'Acima do Máx'; statusCls = 'st-er'; }
      return { c, pReg, pctAtual, status, statusCls };
    });

    const tabPoliticaCred = tabelaDG([
      { rot: 'Categoria de Risco', w: '34%', l: 1, f: r => `<span class="nm">${esc((RISCO_CREDITO[r.c.k] || r.c.k).replace('Risco ', ''))}</span>` },
      { rot: 'Mín', w: '12%', f: r => pcDG(r.pReg.min) },
      { rot: 'Alvo', w: '12%', f: r => pcDG(r.pReg.alvo) },
      { rot: 'Máx', w: '12%', f: r => pcDG(r.pReg.max) },
      { rot: 'Atual', w: '14%', f: r => pcDG(r.pctAtual) },
      { rot: 'Status', w: '16%', l: 1, f: r => `<span class="${r.statusCls}">${r.status}</span>` },
    ], linhasPolCred);

    // Abaixo: Distância da Política considerando o Range de Atuação
    const gaps = linhasPolCred.map(r => {
      let gapPct = 0;
      let gapTipo = 'Enquadrado';
      let gapCls = 'st-ok';
      if (r.pctAtual > r.pReg.max + 0.0001) {
        gapPct = subPrecisa(r.pctAtual, r.pReg.max);
        gapTipo = 'Excesso de Risco';
        gapCls = 'st-er';
      } else if (r.pctAtual < r.pReg.min - 0.0001) {
        gapPct = subPrecisa(r.pctAtual, r.pReg.min);
        gapTipo = 'Déficit de Alocação';
        gapCls = 'st-al';
      }
      const gapValor = multPrecisa(gapPct, total);
      return { ...r, gapPct, gapValor, gapTipo, gapCls };
    });

    const tabGap = tabelaDG([
      { rot: 'Categoria de Risco', w: '30%', l: 1, f: g => `<span class="nm">${esc(RISCO_CREDITO[g.c.k] || g.c.k)}</span>` },
      { rot: 'Faixa Aceita (Min–Máx)', w: '22%', f: g => `${pcDG(g.pReg.min)} a ${pcDG(g.pReg.max)}` },
      { rot: 'Posição Atual', w: '16%', f: g => `${pcDG(g.pctAtual)} (${rsDG(g.c.v)})` },
      { rot: 'Distância da Banda', w: '18%', f: g => `<span class="${g.gapCls}"><b>${g.gapPct === 0 ? '0,0%' : (g.gapPct > 0 ? '+' : '') + pcDG(g.gapPct)}</b></span>` },
      { rot: 'Impacto Financeiro', w: '14%', f: g => g.gapValor === 0 ? '—' : rsDG(Math.abs(g.gapValor)) },
    ], gaps);

    let corpo = `<div class="dg-2col">
      <div><div class="box-k">Visão de Risco de Crédito (Look-Through) <span class="bk-x">De quem é o risco de fato</span></div>${tabRiscoAtual}</div>
      <div><div class="box-k">Política de Investimentos de Crédito <span class="bk-x">Limites e Alvos Estabelecidos</span></div>${tabPoliticaCred}</div>
    </div>
    <div class="box-k bloco-dg">Distância da Política (Range de Atuação) <span class="bk-x">Gap financeiro e percentual em relação aos limites aceitos</span></div>${tabGap}`;

    sec('Visão de Risco de Crédito vs. Política de Investimentos', 'Análise de risco de crédito com look-through em fundos (incluindo Ativos Reais: Tijolo e Participações Societárias), comparado à política de investimentos e distância das bandas.', corpo);
  }

  /* 03 — Detalhamento das classes */
  grupo('detalhe', 'Detalhamento das classes');
  {
    const blocoClasse = c => {
      const itens = [...c.itens].sort((a, b) => b.v - a.v);
      const cols = [
        { rot: 'Ativo', w: multi ? '33%' : '37%', l: 1, f: x => `<span class="nm">${esc(x.nome)}</span>` },
        { rot: 'Indexador / característica', w: multi ? '26%' : '28%', l: 1, cls: 'ativos', f: x => esc(x.carac) }, ...colTI,
        { rot: 'Valor (R$)', w: '17%', f: x => rsDG(x.v) }, { rot: '% cl.', w: '9%', f: x => pcDG(x.v / c.v) }, { rot: '% cart.', w: '9%', f: x => pcT(x.v) },
      ];
      return `<div class="cbloco"><div class="cb-head" style="background:${corLegivel(cor.get(c.k))}"><span class="cb-nome">${esc(CLASSES_EST[c.k])}</span><span class="cb-val">${rsDG(c.v)}</span><span class="cb-pct">${pcT(c.v)} da carteira • ${nAtivos(itens.length)}</span></div>${tabelaDG(cols, itens)}</div>`;
    };
    // Muitos ativos: duas páginas, equilibrando o número de linhas (como no relatório do escritório)
    const linhasDe = c => c.itens.length + 3;
    const grupos = [[], []], soma = [0, 0];
    if (somaLista(classes, c => linhasDe(c)) > 30) for (const c of classes) { const g = soma[0] <= soma[1] ? 0 : 1; grupos[g].push(c); soma[g] += linhasDe(c); }
    else grupos[0] = classes;
    const nomesCl = cs => { const n = cs.map(c => CLASSES_EST[c.k].split(' (')[0]); return n.length > 1 ? n.slice(0, -1).join(', ') + ' e ' + n.at(-1) : n[0]; };
    const textos = [];
    const subDet = `Cada classe com a lista completa dos ativos que a compõem${multi ? `, e de qual ${porFamilia ? 'titular' : 'conta'} é cada um` : ''}.`;
    const gs = grupos.filter(g => g.length);
    gs.forEach((g, i) => sec(gs.length > 1 ? `Detalhamento das Classes — ${nomesCl(g)}` : 'Detalhamento das Classes', subDet,
      `<div class="dg-blocos">${g.map(blocoClasse).join('')}</div>${i === gs.length - 1 ? obsDG(textos) : ''}`));
  }

  /* 04 — Casas gestoras e emissores diretos + FGC */
  grupo('gestoras', 'Casas gestoras, emissores e FGC');
  {
    const ges = agruparDG(L.filter(x => !x.direto), x => x.ge), emi = agruparDG(L.filter(x => x.direto), x => x.ge);
    const vG = somaLista(ges, g => g.v), vE = somaLista(emi, g => g.v);
    const tabG = ges.length ? tabelaDG([
      { rot: 'Casa gestora', w: '28%', l: 1, f: g => `<span class="nm">${esc(g.k)}</span>` }, { rot: 'Veículos', w: '38%', l: 1, cls: 'ativos', f: g => listaNomes(g.itens, 2) },
      { rot: 'Valor (R$)', w: '20%', f: g => rsDG(g.v) }, { rot: '% cart.', w: '14%', f: g => pcT(g.v) },
    ], ges, [`SUBTOTAL — ${ges.length} ${ges.length === 1 ? 'casa' : 'casas'}`, '', rsDG(vG), pcT(vG)]) : '<p class="muted">Sem veículos de terceiros.</p>';
    const tabE = emi.length ? tabelaDG([
      { rot: 'Emissor', w: '32%', l: 1, f: g => `<span class="nm">${esc(g.k)}</span>${g.v / total > 0.03 && g.k !== 'Tesouro Nacional' && g.itens.some(x => ['Corp', 'Banc'].includes(x.cp)) ? ' <span class="tag-dg" title="Emissor isolado acima de 3% da carteira (regra 4.9 do padrão)">&gt; 3%</span>' : ''}` },
      { rot: 'Setor / papel', w: '34%', l: 1, cls: 'ativos', f: g => esc([...new Set(g.itens.map(x => x.papel))].join(', ')) },
      { rot: 'Valor (R$)', w: '20%', f: g => rsDG(g.v) }, { rot: '% cart.', w: '14%', f: g => pcT(g.v) },
    ], emi, [`SUBTOTAL — ${emi.length} ${emi.length === 1 ? 'emissor' : 'emissores'}`, '', rsDG(vE), pcT(vE)]) : '<p class="muted">Sem papéis comprados diretamente.</p>';
    let corpo = `<div class="dg-2col"><div><div class="box-k">Casas gestoras — veículos de terceiros <span class="bk-x">${pcT(vG)}</span></div>${tabG}</div>
      <div><div class="box-k">Emissores diretos — devedor final <span class="bk-x">${pcT(vE)}</span></div>${tabE}</div></div>`;
    const fgc = agruparDG(L.filter(x => x.fgc && x.v > 0), x => `${x.ge}|${titularDe(x)}`);
    const textos = [];
    const grupos = ges.filter(g => emi.some(e => norm(e.k) === norm(g.k)));
    for (const g of grupos) {
      const e = emi.find(e => norm(e.k) === norm(g.k));
      const prevG = somaLista(g.itens.filter(x => x.prev && x.cp === 'Sob'), x => x.v);
      textos.push(`O grupo ${esc(g.k)} responde por ${rsDG(somaPrecisa(g.v, e.v))} (${pcT(somaPrecisa(g.v, e.v))}) quando se junta a gestão de veículos (${rsDG(g.v)}) ao risco de emissor (${rsDG(e.v)}).${prevG ? ` Desse valor, ${rsDG(prevG)} são previdência em Tesouro Selic, com risco soberano e não do banco.` : ''}`);
    }
    if (fgc.length) {
      const linhas = fgc.map(g => { const [em, tit] = g.k.split('|'); const cob = Math.min(g.v, 250000); return { em, tit, v: g.v, cob, acima: subPrecisa(g.v, cob) }; });
      const cobT = somaLista(linhas, l => l.cob), acimaT = somaLista(linhas, l => l.acima);
      corpo += `<div class="box-k bloco-dg">Cobertura do FGC <span class="bk-x">limite de R$ 250 mil por CPF/CNPJ e por instituição</span></div>` + tabelaDG([
        { rot: 'Emissor', w: '26%', l: 1, f: l => `<span class="nm">${esc(l.em)}</span>` }, { rot: 'Titular', w: '20%', l: 1, cls: 'ativos', f: l => esc(multi ? curto(l.tit) : '—') },
        { rot: 'Posição (R$)', w: '18%', f: l => rsDG(l.v) }, { rot: 'Coberto (R$)', w: '18%', f: l => rsDG(l.cob) },
        { rot: 'Acima do limite (R$)', w: '18%', f: l => l.acima > 0.004 ? `<span class="al">${rsDG(l.acima)}</span>` : '—' },
      ], linhas, ['TOTAL', '', rsDG(somaPrecisa(cobT, acimaT)), rsDG(cobT), acimaT > 0.004 ? rsDG(acimaT) : '—']);
      const acimaEm = linhas.filter(l => l.acima > 0.004);
      textos.push(acimaEm.length ? `${rsDG(acimaT)} (${pcT(acimaT)}) estão acima do limite do FGC: ${acimaEm.map(l => `${esc(l.em)} (${rsDG(l.acima)})`).join(', ')}. Esse valor carrega o risco de crédito do banco emissor.` : 'Todas as posições cobertas pelo FGC estão dentro do limite de R$ 250 mil por emissor e por titular.');
    }
    const acima3 = emi.filter(e => e.v / total > 0.03 && e.k !== 'Tesouro Nacional' && e.itens.some(x => ['Corp', 'Banc'].includes(x.cp)));
    if (acima3.length) textos.push(`Emissores com mais de 3% da carteira: ${acima3.map(e => `${esc(e.k)} (${pcT(e.v)})`).join(', ')}.`);
    const g0 = ges.find(g => !grupos.includes(g));
    if (g0 && g0.v / total > 0.05) textos.push(`Fora do custodiante, a maior casa gestora é ${esc(g0.k)}, com ${rsDG(g0.v)} (${pcT(g0.v)}).`);
    sec('Casas Gestoras e Emissores Diretos', 'Quem administra os veículos e quem é o devedor final de cada papel comprado diretamente.', corpo + obsDG(textos));
  }

  /* 05 — Horizonte de prazo: resumo, curto e médio lado a lado, matriz; longo prazo em página própria */
  grupo('horizonte', 'Horizonte de prazo', false);
  {
    const hs = ['C', 'M', 'L'].map(k => ({ k, itens: L.filter(x => x.prazo === k).sort((a, b) => b.v - a.v) })).map(h => ({ ...h, v: somaLista(h.itens, x => x.v) }));
    const resumo = tabelaDG([
      { rot: 'Horizonte', w: '22%', l: 1, f: h => `<span class="nm">${HORIZONTES[h.k][0]}</span>` }, { rot: 'Definição', w: '26%', l: 1, cls: 'ativos', f: h => HORIZONTES[h.k][1] },
      { rot: 'Valor (R$)', w: '22%', f: h => rsDG(h.v) }, { rot: '% carteira', w: '16%', f: h => pcT(h.v) }, { rot: 'Nº', w: '14%', f: h => h.itens.length },
    ], hs, ['TOTAL', '', rsDG(total), '100,00%', L.length]);
    const bloco = (h, i) => {
      const cols = [
        { rot: 'Ativo', w: '30%', l: 1, f: x => `<span class="nm">${esc(x.nome)}</span>` }, { rot: 'Característica', w: '24%', l: 1, cls: 'ativos', f: x => esc(x.carac) }, ...colTI,
        { rot: 'Classe', w: '12%', l: 1, cls: 'ativos', f: x => esc(CLASSES_EST[x.classe].split(' (')[0]) }, { rot: 'Valor (R$)', w: '14%', f: x => rsDG(x.v) },
        { rot: '% hor.', w: '7%', f: x => pcDG(x.v / h.v) }, { rot: '% cart.', w: '7%', f: x => pcT(x.v) },
      ];
      return `<div class="cbloco"><div class="cb-head" style="background:${['#0A1F44', '#1F4E87', '#2E6FB7'][i]}"><span class="cb-nome">${HORIZONTES[h.k][0]}</span><span class="cb-val">${rsDG(h.v)}</span><span class="cb-pct">${HORIZONTES[h.k][1]} • ${pcT(h.v)} da carteira • ${nAtivos(h.itens.length)}</span></div>${tabelaDG(cols, h.itens)}</div>`;
    };
    const curtoMedio = hs.slice(0, 2).map((h, i) => h.itens.length ? `<div>${bloco(h, i)}</div>` : '').join('');
    const vH = (c: any, k: any) => somaLista(c.itens.filter((x: any) => x.prazo === k), (x: any) => x.v);
    const matriz = tabelaDG([
      { rot: 'Classe estratégica', w: '22%', l: 1, f: c => `${sw(c.k)}<span class="nm">${esc(CLASSES_EST[c.k])}</span>` },
      ...['C', 'M', 'L'].flatMap(k => [
        { rot: `${HORIZONTES[k][0].split(' ')[0]} (R$)`, w: '13%', f: c => vH(c, k) ? rsDG(vH(c, k)) : '—' },
        { rot: '%', w: '8%', f: c => vH(c, k) ? pcDG(vH(c, k) / c.v) : '—' },
      ]),
      { rot: 'Total da classe', w: '15%', cls: 'tot', f: c => rsDG(c.v) },
    ], classes, ['TOTAL', ...hs.flatMap(h => [rsDG(h.v), pcT(h.v)]), rsDG(total)]);
    const hMax = [...hs].sort((a, b) => b.v - a.v)[0];
    const prox = L.filter(x => x.anos !== null && x.anos >= 0 && x.anos <= 1 && x.direto);
    const vProx = somaLista(prox, x => x.v);
    const textos = [
      `O ${HORIZONTES[hMax.k][0].toLowerCase()} é o maior bloco: ${rsDG(hMax.v)} (${pcT(hMax.v)}).`,
      vProx > 0 ? `Evento de realocação próximo: ${rsDG(vProx)} (${pcT(vProx)}) vencem nos próximos 12 meses (${[...new Set(prox.map(x => esc(x.nome)))].slice(0, 4).join(', ')}).` : '',
      'Horizonte é o prazo de investimento, não a janela de liquidez: um ETF de títulos públicos com liquidez D+2 pode ser médio prazo. A liquidez está na seção seguinte.',
    ];
    // Rosca do horizonte (mesmas cores dos quadros de curto, médio e longo prazo)
    const corH = { C: '#0A1F44', M: '#1F4E87', L: '#2E6FB7' };
    const roscaH = donutDG(hs.filter(h => h.v > 0).map(h => ({ pct: h.v / total * 100, cor: corH[h.k], rot: HORIZONTES[h.k][0] })), 'Horizonte', brlCurto(total).replace(/ mi$/, ' MM'));
    const legH = hs.filter(h => h.v > 0).map(h => `<span><i class="sw" style="background:${corH[h.k]}"></i>${HORIZONTES[h.k][0]}</span>`).join('');
    let corpo = `<div class="dg-classe dg-hz"><div class="dg-rosca">${roscaH}<div class="leg-hz">${legH}</div></div><div><div class="box-k">Resumo por horizonte</div>${resumo}</div></div>`;
    if (curtoMedio) corpo += `<div class="dg-2col bloco-dg">${curtoMedio}</div>`;
    // Valores futuros a receber (proventos, amortizações, liquidações), quando houver
    const aReceber = L.filter(x => x.p.receber).sort((a, b) => (a.p.vencimento || 0) - (b.p.vencimento || 0));
    if (aReceber.length) {
      const vR = somaLista(aReceber, x => x.v);
      corpo += `<div class="box-k bloco-dg">Valores futuros a receber <span class="bk-x">${rsDG(vR)} • ${pcT(vR)} da carteira</span></div>` + tabelaDG([
        { rot: 'Descrição', w: '46%', l: 1, f: x => `<span class="nm">${esc(x.p.nomeAtivo)}</span>` }, ...colTI,
        { rot: 'Previsão', w: '14%', f: x => x.p.vencimento ? dataBR(x.p.vencimento) : '—' }, { rot: 'Valor (R$)', w: '18%', f: x => rsDG(x.v) }, { rot: '% cart.', w: '10%', f: x => pcT(x.v) },
      ], aReceber, ['TOTAL A RECEBER', ...colTI.map(() => ''), '', rsDG(vR), pcT(vR)]);
    }
    corpo += `<div class="box-k bloco-dg">Classe estratégica por horizonte de prazo <span class="bk-x">% dentro de cada classe</span></div>${matriz}${obsDG(textos)}`;
    // Longo prazo: ativo a ativo; com muitos ativos, ganha uma seção (página) própria
    const longoSeparado = hs[2].itens.length > 8;
    if (hs[2].itens.length && !longoSeparado) corpo += `<div class="bloco-dg">${bloco(hs[2], 2)}</div>`;
    sec('Horizonte de Prazo', 'Em que janela cada real está comprometido: liquidez diária, até dois anos ou acima disso.', corpo);
    if (longoSeparado) sec('Horizonte de Prazo — Longo Prazo', 'Os ativos com horizonte acima de dois anos, abertos um a um, com o peso dentro do horizonte e na carteira.', bloco(hs[2], 0));
  }

  /* 06 — Liquidez e vencimentos */
  grupo('liquidez', 'Liquidez e vencimentos');
  {
    const formatarJanela = (k: string) => {
      if (JANELAS[k]) return JANELAS[k];
      const m = k.match(/^d(\d+)$/i);
      if (m) return `Resgate D+${m[1]}`;
      if (k === 'resg_esp') return 'Resgate sob regulamento';
      return k;
    };

    const ordemJanela = (k: string) => {
      if (k === 'dia') return 0;
      if (k === 'bolsa') return 2;
      const m = k.match(/^d(\d+)$/i);
      if (m) return 1000 + parseInt(m[1], 10);
      if (k === 'prev') return 5000;
      if (k === 'cot' || k === 'resg_esp') return 9000;
      if (k === 'venc') return 10000;
      return 8000;
    };

    const jan = agruparDG(L, x => x.janela).sort((a, b) => ordemJanela(a.k) - ordemJanela(b.k));
    let corpo = `<div class="box-k">Distribuição por janela de liquidez</div>` + tabelaDG([
      { rot: 'Janela', w: '24%', l: 1, f: j => `<span class="nm">${esc(formatarJanela(j.k))}</span>` }, { rot: 'Valor (R$)', w: '18%', f: j => rsDG(j.v) },
      { rot: '% carteira', w: '12%', f: j => pcT(j.v) }, { rot: 'Composição', w: '46%', l: 1, cls: 'ativos', f: j => listaNomes(j.itens) },
    ], jan, ['TOTAL', rsDG(total), '100,00%', '']);

    const venc = L.filter(x => x.direto && x.p.vencimento instanceof Date && x.classe !== 'Caixa' && x.janela !== 'dia').sort((a, b) => a.p.vencimento - b.p.vencimento);
    const vV = somaLista(venc, x => x.v);
    if (venc.length) {
      const anos = venc.map(x => x.p.vencimento.getFullYear());
      corpo += `<div class="box-k bloco-dg">Papéis com vencimento definido</div>` + tabelaDG([
        { rot: 'Papel', w: '34%', l: 1, f: x => `<span class="nm">${esc(x.nome)}</span>` }, ...colTit, { rot: 'Indexador', w: '26%', l: 1, cls: 'ativos', f: x => esc(x.carac) },
        { rot: 'Vencimento', w: '10%', f: x => x.p.vencimento.getFullYear() }, { rot: 'Valor (R$)', w: '16%', f: x => rsDG(x.v) }, { rot: '% cart.', w: '8%', f: x => pcT(x.v) },
      ], venc, ['COM VENCIMENTO DEFINIDO', ...(multi ? [''] : []), `${venc.length} ${venc.length === 1 ? 'papel' : 'papéis'}`, Math.min(...anos) === Math.max(...anos) ? Math.min(...anos) : `${Math.min(...anos)}–${Math.max(...anos)}`, rsDG(vV), pcT(vV)]);
    }

    const fundos = L.filter(x => !x.direto && x.classe !== 'Caixa' && x.janela !== 'dia').sort((a, b) => ordemJanela(a.janela) - ordemJanela(b.janela));
    const vF = somaLista(fundos, x => x.v);
    if (fundos.length) {
      corpo += `<div class="box-k bloco-dg">Fundos de investimento — Cronograma de resgate e liquidação</div>` + tabelaDG([
        { rot: 'Fundo', w: '36%', l: 1, f: x => `<span class="nm">${esc(x.nome)}</span>` },
        ...colTit,
        { rot: 'Gestora', w: '20%', l: 1, f: x => esc(x.ge) },
        { rot: 'Prazo de Resgate', w: '16%', f: x => {
            const tag = x.p.liquidez || formatarJanela(x.janela).replace('Resgate ', '');
            return `<span style="background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:4px;font-weight:600;font-size:10px;">${esc(tag)}</span>`;
          }
        },
        { rot: 'Valor (R$)', w: '16%', f: x => rsDG(x.v) },
        { rot: '% cart.', w: '12%', f: x => pcT(x.v) },
      ], fundos, ['TOTAL EM FUNDOS', ...(multi ? [''] : []), `${fundos.length} fundos`, '—', rsDG(vF), pcT(vF)]);
    }

    const vJ = ks => somaLista(jan.filter(j => ks.includes(j.k)), j => j.v);
    const dia = vJ(['dia']), bolsa = vJ(['bolsa']), prev = vJ(['prev']), cot = vJ(['cot', 'resg_esp']), ateV = vJ(['venc']);
    const fundosComPrazo = jan.filter(j => /^d\d+$/i.test(j.k));
    const vFundosPrazo = somaLista(fundosComPrazo, j => j.v);

    const temLiq = [
      `Somando liquidez diária e ativos listados em bolsa, ${rsDG(dia + bolsa)} (${pcT(dia + bolsa)}) viram caixa em até cinco dias úteis.`,
      vFundosPrazo ? `${rsDG(vFundosPrazo)} (${pcT(vFundosPrazo)}) estão em fundos com prazos de resgate conhecidos e mapeados pelo Fund Guide BTG (${fundosComPrazo.map(f => formatarJanela(f.k)).join(', ')}).` : '',
      prev ? `A previdência (${rsDG(prev)}, ${pcT(prev)}) se resgata em poucos dias, mas o resgate tem efeito tributário e de planejamento: não é liquidez de uso corrente.` : '',
      notaTransito,
    ];
    const semLiq = [
      cot ? `${rsDG(cot)} (${pcT(cot)}) estão em fundos com cotização sob regulamento fechado (FIPs ou veículos ilíquidos que devolvem apenas por amortização).` : '',
      ateV ? `Os papéis de renda fixa direta e COE somam ${rsDG(ateV)} (${pcT(ateV)}) e, sem mercado secundário garantido, são posições para carregar até o vencimento.` : '',
    ];
    corpo += `<div class="dg-2col bloco-dg"><div>${obsDG(temLiq, 'Prazos de resgate e liquidez')}</div><div>${obsDG(semLiq, 'Vencimento e carência')}</div></div>`;
    if (dia / total >= 0.1 && (cot + ateV) / total >= 0.25) corpo += obsDG([`A carteira tem dois extremos e pouco meio-termo: ${pcT(dia)} em liquidez imediata e ${pcT(cot + ateV)} em veículos com cotização própria ou vencimento.`]);
    sec('Liquidez e Vencimentos', 'Em quanto tempo cada real pode virar caixa: prazos de resgate de fundos e vencimento de títulos.', corpo);
  }

  /* Offshore (seção 4.10 do padrão): só quando houver ativos no exterior com valor em dólar */
  {
    const off = L.filter(x => x.classe === 'Intl' && x.p.usd);
    if (off.length) {
      grupo('offshore', 'Offshore', false);
      const vOff = somaLista(off, x => x.v), usdOff = somaLista(off, x => x.p.usd);
      const cambios = [...new Set(off.map(x => x.p.cambio).filter(Boolean))];
      const tipos = agruparDG(off, x => x.p.subclasse || 'Outros');
      const usdT = (g: any) => somaLista(g.itens, (x: any) => x.p.usd);
      const us$ = v => 'US$ ' + num(v);
      let corpo = `<div class="kpis-dg">${kpiDG('Offshore em dólar', us$(usdOff), `${off.length} ${off.length === 1 ? 'ativo' : 'ativos'} • ${[...new Set(off.map(x => x.p.instituicao))].join(', ')}`, 'main')}
        ${kpiDG('Offshore em reais', rsDG(vOff), cambios.length ? `câmbio R$ ${cambios.map(c => num(c, 4)).join(' / ')} por US$` : '')}
        ${kpiDG('Peso na carteira', pcT(vOff), 'do patrimônio consolidado', '', vOff / total)}
        ${kpiDG('Exposto ao estate tax', us$(usdOff), 'ativos domiciliados nos EUA (US-situs)')}</div>`;
      corpo += `<div class="dg-2col"><div><div class="box-k">Composição offshore por tipo</div>` + tabelaDG([
        { rot: 'Tipo', w: '24%', l: 1, f: g => `<span class="nm">${esc(g.k)}</span>` }, { rot: 'Ativos', w: '30%', l: 1, cls: 'ativos', f: g => esc(g.itens.map(x => x.p.ativo).join(', ')) },
        { rot: 'US$', w: '16%', f: g => num(usdT(g)) }, { rot: 'R$', w: '18%', f: g => rsDG(g.v) }, { rot: '% off.', w: '12%', f: g => pcDG(g.v / vOff) },
      ], tipos, ['TOTAL', `${off.length} ativos`, num(usdOff), rsDG(vOff), '100,00%']) + `</div>
        <div><div class="estate"><div class="leitura-k">Estate tax americano — atenção</div>
          <p>Não residentes têm isenção de apenas <b>US$ 60 mil</b>; o excedente pode ser tributado em até <b>40%</b> na sucessão.</p>
          <p>São US-situs as ações, ETFs e REITs domiciliados nos EUA (como os desta carteira). Fundos UCITS domiciliados na Irlanda não são.</p>
          <p>Sem tratado Brasil–EUA, há <b>30% de retenção</b> sobre dividendos.</p>
          <p>Exposição desta carteira: <b>${us$(usdOff)}</b> (${rsDG(vOff)})${usdOff > 60000 ? `, ou seja, ${us$(usdOff - 60000)} acima da isenção` : ', abaixo da isenção de US$ 60 mil'}.</p></div></div></div>`;
      const top = [...off].sort((a, b) => b.v - a.v)[0];
      corpo += obsDG([`A carteira no exterior soma ${us$(usdOff)} (${rsDG(vOff)}, ${pcT(vOff)} do patrimônio). A maior posição é ${esc(top.nome)} (${pcDG(top.v / vOff)} do offshore).`,
        'Os valores em reais usam o câmbio informado ao anexar o extrato; a carteira offshore oscila também com o dólar.']);
      sec('Offshore', 'A parcela do patrimônio no exterior, em dólar e em reais, e o risco sucessório americano.', corpo);
    }
  }

  S.rel = { nome: s.nome, tipo: s.tipo, total, base, contas, insts, nPos: brutos.length, nClasses: classes.length, titulares: titulares.map(t => rotTit(t.k)),
    porInst: agruparDG(L, x => x.p.instituicao).map(g => g.k) };
  alvo.innerHTML = `<div class="rel-topo"><span>Diagnóstico de Alocação Patrimonial • ${esc(s.nome)} • Data-base ${dataBR(base)}</span>
    <button class="btn btn-pri" data-acao="relatorio" title="Abre o relatório em A4 paisagem para salvar em PDF">Gerar relatório (PDF)</button></div>` +
    secoes.map((x, i) => secaoDG(String(i + 1).padStart(2, '0'), x.t, x.sub, x.corpo, x.grupo)).join('');
  // Caixas de texto (Leitura, "Como a carteira se organiza", estate tax…) também podem sair do relatório:
  // cada uma vira um quadro do grupo da seção, marcado por padrão
  for (const secEl of alvo.querySelectorAll('.rel-sec')) {
    const g = itensRel.find(x => x.id === (secEl as HTMLElement).dataset.grupo);
    if (!g) continue;
    for (const caixa of secEl.querySelectorAll('.leitura, .estate')) {
      if (caixa.parentElement.closest('.bl-rel')) continue;  // já faz parte de um quadro que sai inteiro
      const id = `texto${g.blocos.filter(b => b.id.startsWith('texto')).length + 1}`;
      const titulo = caixa.querySelector('.leitura-k')?.textContent.trim() || 'Leitura';
      caixa.classList.add('bl-rel'); (caixa as HTMLElement).dataset.bloco = id;
      g.blocos.push({ id, rot: `Texto: ${titulo.charAt(0) + titulo.slice(1).toLowerCase()}`, padrao: true });
    }
  }
  S.relItens = itensRel;
}

/* ---------- Relatório em PDF (A4 paisagem, seção 9 do padrão) ---------- */

// --- Geração de Relatórios e Impressão PDF ---
export function secoesRelatorio(sel: Set<string>): string {
  const caixa = document.createElement('div');
  caixa.innerHTML = [...$('#diag').querySelectorAll('.rel-sec')].filter(s => sel.has((s as HTMLElement).dataset.grupo || '')).map(s => s.outerHTML).join('');
  caixa.querySelectorAll('.rel-sec').forEach(s => { (s as HTMLElement).style.display = ''; });
  caixa.querySelectorAll('[data-bloco]').forEach(b => {
    const g = (b.closest('.rel-sec') as HTMLElement)?.dataset?.grupo;
    if (!sel.has(`${g}:${(b as HTMLElement).dataset.bloco}`)) b.remove();
  });
  caixa.querySelectorAll('.leitura').forEach(l => { if (!l.querySelector('p')) l.remove(); });
  caixa.querySelectorAll('.col-dg').forEach(d => { if (!d.children.length) d.remove(); });
  caixa.querySelectorAll('.dg-auto').forEach(d => { if (!d.children.length) d.remove(); });
  caixa.querySelectorAll('.rel-num').forEach((n, i) => { n.textContent = String(i + 1).padStart(2, '0'); });
  return caixa.innerHTML;
}

// Janela "Montar relatório": escolhe o que entra no PDF, com prévia ao lado
export function gerarRelatorio() {
  const r = S.rel, itens = S.relItens || [];
  if (!r || !$('#diag').querySelector('.rel-sec')) return;
  const dlg = $('#dlg-extrato') as HTMLDialogElement;
  const chave = (g: any, b?: any) => b ? `${g.id}:${b.id}` : g.id;
  const linhaItem = (g: any, b?: any) => {
    const it = b || g;
    return `<label><input type="checkbox" data-k="${chave(g, b)}" ${it.padrao ? 'checked' : ''}><span>${esc(it.rot)}</span>${it.padrao ? '' : '<span class="tag-op">opcional</span>'}</label>`;
  };

  const gSec1Classica = itens.find((x: any) => x.id === 'consolidacao');
  const gSec1Integrada = itens.find((x: any) => x.id === 'consolidacao_integrada');
  const outrosItens = itens.filter((x: any) => x.id !== 'consolidacao' && x.id !== 'consolidacao_integrada');

  dlg.innerHTML = `<form method="dialog" class="dlg dlg-rel">
    <div class="filtro">
      <h2>Montar relatório</h2>
      <p class="sec">Marque o que vai no PDF. Os itens padrão já vêm marcados; os opcionais podem ser incluídos.</p>
      <div class="filtro-lista">
        <div class="it-grupo it-sec1-choice" style="border: 1px solid #CBD6E3; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; background: #F8FAFD;">
          <div style="font-weight: 700; font-size: 11px; color: #0A1F44; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px;">Modelo da Seção 1 (Consolidação)</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer;">
              <input type="radio" name="sec1_tipo" value="consolidacao" checked style="margin-top: 2px;">
              <span><b>Modelo Clássico:</b> Custódia, Classes em barras e Maiores posições</span>
            </label>
            <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer;">
              <input type="radio" name="sec1_tipo" value="consolidacao_integrada" style="margin-top: 2px;">
              <span><b>Modelo Integrado:</b> Custódia, Rosca Donut &amp; Tabela de Classes <span class="tag-op" style="background:#0A1F44;color:#fff;margin-left:4px;">Novo</span></span>
            </label>
          </div>
          <div id="sub-sec1-classica" style="margin-top: 8px; padding-left: 12px; border-top: 1px solid #E2EAF4; padding-top: 6px;">
            ${gSec1Classica ? gSec1Classica.blocos.map((b: any) => `<div class="it-bloco">${linhaItem(gSec1Classica, b)}</div>`).join('') : ''}
          </div>
          <div id="sub-sec1-integrada" style="margin-top: 8px; padding-left: 12px; border-top: 1px solid #E2EAF4; padding-top: 6px;" hidden>
            ${gSec1Integrada ? gSec1Integrada.blocos.map((b: any) => `<div class="it-bloco">${linhaItem(gSec1Integrada, b)}</div>`).join('') : ''}
          </div>
          <input type="checkbox" data-k="consolidacao" checked hidden>
          <input type="checkbox" data-k="consolidacao_integrada" hidden>
        </div>
        ${outrosItens.map((g: any) => `<div class="it-grupo">${linhaItem(g)}${g.blocos.map((b: any) => `<div class="it-bloco">${linhaItem(g, b)}</div>`).join('')}</div>`).join('')}
      </div>
      <div class="paginas" id="rel-paginas"></div>
      <div class="dlg-botoes" style="flex-wrap:wrap">
        <button type="button" class="btn" id="rel-padrao">Restaurar padrão</button>
        <button type="button" class="btn" value="cancelar" id="rel-cancelar">Cancelar</button>
        <button type="button" class="btn btn-pri" id="rel-gerar">Gerar PDF</button>
      </div>
    </div>
    <div class="previa"><iframe title="Prévia do relatório"></iframe></div>
  </form>`;
  const ifr = dlg.querySelector('iframe') as HTMLIFrameElement, previa = dlg.querySelector('.previa') as HTMLElement;
  const marcados = () => {
    const s = new Set(['']);
    dlg.querySelectorAll('input[data-k]:checked').forEach(c => s.add((c as HTMLElement).dataset.k || ''));
    return s;
  };
  const LARG = 1100;
  const ajustar = () => {
    const k = previa.clientWidth / LARG;
    ifr.style.width = LARG + 'px'; ifr.style.height = (previa.clientHeight / k) + 'px'; ifr.style.transform = `scale(${k})`;
  };
  let pos = 0;
  const atualizar = () => {
    dlg.querySelectorAll('.it-grupo:not(.it-sec1-choice)').forEach(g => {
      const on = (g.querySelector(':scope > label input') as HTMLInputElement)?.checked;
      g.querySelectorAll('.it-bloco input').forEach(c => { (c as HTMLInputElement).disabled = !on; });
    });
    try { pos = ifr.contentWindow?.scrollY || 0; } catch { pos = 0; }
    ifr.srcdoc = htmlRelatorio(secoesRelatorio(marcados()), true);
  };
  ifr.addEventListener('load', () => {
    try {
      ifr.contentWindow?.scrollTo(0, pos);
      const n = (ifr.contentWindow as any)?.contarPaginas?.();
      const pagEl = $('#rel-paginas');
      if (pagEl) pagEl.textContent = n ? `Aproximadamente ${n} páginas, com a capa.` : '';
    } catch { /* prévia sem acesso: segue sem a contagem */ }
  });
  dlg.querySelector('.filtro-lista')?.addEventListener('change', atualizar);

  const radsSec1 = dlg.querySelectorAll('input[name="sec1_tipo"]');
  radsSec1.forEach(rInput => {
    rInput.addEventListener('change', (e: Event) => {
      const v = (e.target as HTMLInputElement).value;
      const chkClassica = dlg.querySelector('input[data-k="consolidacao"]') as HTMLInputElement;
      const chkIntegrada = dlg.querySelector('input[data-k="consolidacao_integrada"]') as HTMLInputElement;
      const chkClasses = dlg.querySelector('input[data-k="classes"]') as HTMLInputElement;
      const subClassica = dlg.querySelector('#sub-sec1-classica') as HTMLElement;
      const subIntegrada = dlg.querySelector('#sub-sec1-integrada') as HTMLElement;

      if (v === 'consolidacao_integrada') {
        if (chkClassica) chkClassica.checked = false;
        if (chkIntegrada) chkIntegrada.checked = true;
        if (chkClasses) chkClasses.checked = false; // Donut e Classes já estão na Seção 1 Integrada
        if (subClassica) subClassica.hidden = true;
        if (subIntegrada) subIntegrada.hidden = false;
      } else {
        if (chkClassica) chkClassica.checked = true;
        if (chkIntegrada) chkIntegrada.checked = false;
        if (chkClasses) chkClasses.checked = true;
        if (subClassica) subClassica.hidden = false;
        if (subIntegrada) subIntegrada.hidden = true;
      }
      atualizar();
    });
  });

  const aoX = (e: MessageEvent) => {
    if (e.source !== ifr.contentWindow || !e.data?.tirarRel) return;
    const c = dlg.querySelector(`input[data-k="${CSS.escape(e.data.tirarRel)}"]`) as HTMLInputElement;
    if (c) { c.checked = false; atualizar(); }
  };
  window.addEventListener('message', aoX);
  dlg.addEventListener('close', () => window.removeEventListener('message', aoX), { once: true });
  const padraoBtn = $('#rel-padrao') as HTMLElement;
  if (padraoBtn) {
    padraoBtn.onclick = () => {
      const radClassica = dlg.querySelector('input[name="sec1_tipo"][value="consolidacao"]') as HTMLInputElement;
      if (radClassica) radClassica.checked = true;
      const chkClassica = dlg.querySelector('input[data-k="consolidacao"]') as HTMLInputElement;
      if (chkClassica) chkClassica.checked = true;
      const chkIntegrada = dlg.querySelector('input[data-k="consolidacao_integrada"]') as HTMLInputElement;
      if (chkIntegrada) chkIntegrada.checked = false;
      const subClassica = dlg.querySelector('#sub-sec1-classica') as HTMLElement;
      const subIntegrada = dlg.querySelector('#sub-sec1-integrada') as HTMLElement;
      if (subClassica) subClassica.hidden = false;
      if (subIntegrada) subIntegrada.hidden = true;

      dlg.querySelectorAll('input[data-k]').forEach(c => {
        const input = c as HTMLInputElement;
        const [g, b] = (input.dataset.k || '').split(':'), gr = itens.find((x: any) => x.id === g);
        if (g === 'consolidacao') input.checked = b ? gr?.blocos.find((x: any) => x.id === b)?.padrao : true;
        else if (g === 'consolidacao_integrada') input.checked = b ? gr?.blocos.find((x: any) => x.id === b)?.padrao : false;
        else input.checked = b ? gr?.blocos.find((x: any) => x.id === b)?.padrao : gr?.padrao;
      });
      atualizar();
    };
  }
  const cancBtn = $('#rel-cancelar') as HTMLElement;
  if (cancBtn) cancBtn.onclick = () => dlg.close();
  const gerBtn = $('#rel-gerar') as HTMLElement;
  if (gerBtn) {
    gerBtn.onclick = () => {
      registrar('Relatório gerado', `${r.nome} · ${dlg.querySelectorAll('input[data-k]:checked').length} itens marcados`);
      const html = htmlRelatorio(secoesRelatorio(marcados()), false);
      const w = window.open('', '_blank');
      if (!w) { alert('O navegador bloqueou a janela do relatório. Permita pop-ups para este arquivo e tente de novo.'); return; }
      w.document.open(); w.document.write(html); w.document.close();
      dlg.close();
    };
  }
  dlg.showModal();
  ajustar(); atualizar();
  new ResizeObserver(ajustar).observe(previa);
}

// HTML completo do relatório (capa + seções escolhidas). previa = sem impressão automática, com as páginas separadas na tela
export function htmlRelatorio(secoes, previa) {
  const r = S.rel;
  const logo = (document.querySelector('.logo') as HTMLImageElement)?.src || IMG_LOGO_PADRAO;
  const data = dataBR(r.base);
  const titulo = r.tipo === 'familia' ? `Família ${r.nome}`.replace(/^Família Família/i, 'Família') : r.nome;
  const para = r.tipo === 'familia' ? `${titulo} — ${r.titulares.map(t => t.split(' ')[0]).join(', ')}` : r.nome;
  // Cada seção começa numa página nova (como no relatório do escritório); dentro dela o conteúdo flui sem deixar buracos
  const meta = (k, v) => `<div><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`;
  const nomeInst = i => ({ BTG: 'BTG Pactual', XP: 'XP Investimentos', Nomad: 'Nomad', Rhino: 'Rhino Securitizadora', Safra: 'Safra' }[i] || i);
  const juntarE = l => l.length > 1 ? l.slice(0, -1).join(', ') + ' e ' + l.at(-1) : (l[0] || '');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Diagnostico_Alocacao_${esc(r.nome.replace(/\s+/g, '_'))}_${data.replace(/\//g, '-')}</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
${DIAG_REPORT_CSS}
@page { size: A4 landscape; margin: 9mm 11mm; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; color: #1B2432; font-family: "Manrope", "Segoe UI", Arial, sans-serif; font-variant-numeric: tabular-nums lining-nums; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.barra { position: sticky; top: 0; background: #0A1F44; color: #fff; padding: 10px 16px; display: flex; gap: 12px; align-items: center; font-size: 13px; z-index: 5; }
.barra button { background: #fff; color: #0A1F44; border: 0; border-radius: 6px; padding: 7px 14px; font-weight: 700; cursor: pointer; }
.folha { width: 275mm; margin: 0 auto; }
.capa { position: relative; overflow: hidden; height: 190mm; background: #0B1F45; color: #fff; padding: 17mm 18mm 13mm; display: flex; flex-direction: column; break-after: page; }
.capa .marca-p { position: absolute; right: -10mm; top: -12mm; height: 222mm; opacity: .09; pointer-events: none; }
.capa > * { position: relative; }
.capa .logo-capa { height: 26mm; align-self: flex-start; }
.capa .regua { width: 25mm; height: 3px; background: #5A9BD8; margin: 12mm 0 7mm; }
.capa .mfo { font-size: 9.5px; letter-spacing: .3em; text-transform: uppercase; color: #9FC3EA; }
.capa h1 { font-size: 40px; line-height: 1.12; margin: 6mm 0 4mm; font-weight: 800; letter-spacing: -.02em; }
.capa h1 span { color: #8DB8E8; }
.capa .sub { font-size: 14px; color: rgba(255,255,255,.85); }
.capa .meta { display: grid; grid-template-columns: repeat(4, 1fr); margin-top: auto; border-top: 1px solid rgba(255,255,255,.22); border-bottom: 1px solid rgba(255,255,255,.22); }
.capa .meta > div { padding: 6mm 6mm 8mm 0; }
.capa .meta > div + div { border-left: 1px solid rgba(255,255,255,.22); padding-left: 8mm; }
.capa .meta .k { font-size: 8.5px; letter-spacing: .2em; text-transform: uppercase; color: rgba(255,255,255,.62); margin-bottom: 3mm; }
.capa .meta .v { font-size: 13px; font-weight: 700; line-height: 1.45; }
.capa .rodape { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 8mm; }
.capa .rodape .k { font-size: 8.5px; letter-spacing: .2em; text-transform: uppercase; color: rgba(255,255,255,.62); margin-bottom: 3mm; }
.capa .rodape .cust-img { height: 11mm; }
.capa .rodape .cust-txt { font-size: 15px; font-weight: 700; }
.capa .conf { font-size: 9.5px; color: rgba(255,255,255,.7); text-align: right; line-height: 1.6; }
table.pag { width: 100%; border-collapse: collapse; }
table.pag > thead > tr > td, table.pag > tfoot > tr > td, table.pag > tbody > tr > td { padding: 0; }
.cab-pag { display: flex; align-items: center; justify-content: space-between; background: #0A1F44; color: #fff; padding: 2.5mm 5mm; margin-bottom: 5mm; font-size: 8.5px; letter-spacing: .16em; text-transform: uppercase; }
.cab-pag img { height: 8mm; }
.rod-pag { display: flex; justify-content: space-between; font-size: 8.5px; color: #7A889C; border-top: 1px solid #E3E9F0; padding-top: 2mm; margin-top: 4mm; }
/* Impressão compacta: só itens pequenos são indivisíveis; blocos grandes podem continuar na página seguinte,
   para nunca empurrar um bloco inteiro e deixar a página quase vazia */
#diag { zoom: .72; }
#diag .rel-sec { border: 0; border-radius: 0; padding: 0; margin: 0; box-shadow: none; break-before: page; }
#diag .rel-sec:first-child { break-before: auto; }
#diag .cbloco, #diag .dg-classe, #diag .dg-2col, #diag .dg-blocos, #diag .bloco-dg { break-inside: auto; }
#diag tr, #diag .kpi-dg, #diag .leitura, #diag .empilhada, #diag .empilhada-leg { break-inside: avoid; }
#diag .rel-cab, #diag .box-k, #diag .cb-head { break-after: avoid; }
#diag .quebra-antes { break-before: page; }
#diag .rel-cab { margin-bottom: 10px; padding-bottom: 8px; }
#diag .kpis-dg { margin-bottom: 12px; }
#diag .bloco-dg { margin-top: 14px; }
#diag .leitura { margin-top: 10px; padding: 8px 12px; }
#diag table.dt tbody td { padding: 4px 7px; }
#diag table.dt thead th { padding: 5px 7px; }
#diag .dg-blocos { columns: 2; column-gap: 14px; }
#diag .dg-blocos .cbloco { margin-bottom: 10px; }
#diag .donut { max-width: 280px; }
#diag [data-acao] { display: none; }
#diag .dg-2col { grid-template-columns: 1fr 1fr !important; }
#diag .dg-classe { grid-template-columns: 300px 1fr !important; }
#diag .dg-hz { grid-template-columns: 230px 1fr !important; }
@media print { .barra { display: none; } .folha { max-width: none; } }
${previa ? `/* Prévia: cada página como uma folha */
body { background: #E9EDF2; padding: 14px 0; }
.barra { display: none; }
.capa, #diag .rel-sec { box-shadow: 0 2px 10px rgba(10,31,68,.18); }
.capa { margin-bottom: 14px; }
table.pag, table.pag > tbody > tr > td { display: block; }
table.pag > thead, table.pag > tfoot { display: none; }
#diag .rel-sec { background: #fff; padding: 9mm 11mm !important; margin: 0 0 14px !important; min-height: 190mm; position: relative; }
#diag .bl-rel { position: relative; }
#diag .bl-rel:hover { outline: 2px dashed #5A9BD8; outline-offset: 4px; }
#diag .rel-cab { position: relative; }
.x-rel { display: none; position: absolute; top: -6px; right: -6px; z-index: 3; width: 26px; height: 26px; border-radius: 50%; border: 0; background: #0A1F44; color: #fff; font: 700 15px/26px Manrope, sans-serif; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,.25); }
.x-rel:hover { background: #A32E2E; }
#diag .bl-rel:hover > .x-rel, #diag .rel-cab:hover > .x-rel { display: block; }
#diag .rel-cab > .x-rel { top: 0; right: 0; }` : ''}
</style></head><body>
<div class="barra"><span>Relatório pronto. Na janela de impressão: destino <b>Salvar como PDF</b>, layout <b>Paisagem</b> e, em <b>Mais configurações</b>, desmarque <b>Cabeçalhos e rodapés</b> e marque <b>Gráficos de plano de fundo</b>.</span><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
<div class="folha">
  <section class="capa">
    <img class="marca-p" src="${IMG_P_CAPA}" alt="">
    <img class="logo-capa" src="${logo}" alt="Propósito Capital">
    <div class="regua"></div>
    <div class="mfo">Multi Family Office</div>
    <h1>Diagnóstico Patrimonial<br><span>&amp; Estratégia de Alocação</span></h1>
    <div class="sub">${esc(r.insts.length > 1 ? `Carteira consolidada — ${juntarE(r.porInst.map(nomeInst))}` : `Carteira custodiada no ${nomeInst(r.insts[0])}`)} • Data-base ${data}</div>
    <div class="meta">
      ${meta(r.tipo === 'familia' ? 'Titulares' : 'Titular', esc(r.tipo === 'familia' ? juntarE(r.titulares) : r.nome))}
      ${meta('Patrimônio consolidado', brl(r.total))}
      ${meta('Instituições', `${r.insts.length} ${r.insts.length === 1 ? 'custodiante' : 'custodiantes'}<br>${r.contas.length} ${r.contas.length === 1 ? 'conta' : 'contas'}`)}
      ${meta('Posições', `${r.nPos} ${r.nPos === 1 ? 'posição' : 'posições'}<br>em ${r.nClasses} ${r.nClasses === 1 ? 'classe' : 'classes'}`)}
    </div>
    <div class="rodape">
      <div><div class="k">${r.insts.length > 1 ? 'Principal custodiante' : 'Custodiante'}</div>${r.porInst[0] === 'BTG' ? `<img class="cust-img" src="${IMG_BTG_CAPA}" alt="BTG Pactual">` : `<div class="cust-txt">${esc(nomeInst(r.porInst[0]))}</div>`}</div>
      <div class="conf">Confidencial e de uso exclusivo ${r.tipo === 'familia' ? 'dos titulares' : 'do titular'}.<br>Documento preparado para reunião de alocação.</div>
    </div>
  </section>
  <table class="pag">
    <thead><tr><td><div class="cab-pag"><img src="${logo}" alt=""><span>Diagnóstico de Alocação Patrimonial</span><span>${esc(r.insts.map(i => i === 'BTG' ? 'BTG Pactual' : i).join(' • '))}</span></div></td></tr></thead>
    <tfoot><tr><td><div class="rod-pag"><span>Confidencial • Preparado para ${esc(para)} • Data-base ${data}</span><span>Propósito Capital</span></div></td></tr></tfoot>
    <tbody><tr><td><div id="diag">${secoes}</div></td></tr></tbody>
  </table>
</div>
<script>
// Encaixa cada seção numa página: se passar até 40% da altura útil, reduz para caber; se for bem maior, deixa continuar
function encaixar() {
  const mm = 96 / 25.4, util = (210 - 18) * mm;
  const cab = document.querySelector('.cab-pag'), rod = document.querySelector('.rod-pag');
  const livre = util - (cab ? cab.getBoundingClientRect().height + 19 : 0) - (rod ? rod.getBoundingClientRect().height + 15 : 0) - 45;  // margem: a impressão arredonda um pouco diferente da tela
  for (const s of document.querySelectorAll('#diag .rel-sec')) {
    s.style.zoom = '';
    const h = s.getBoundingClientRect().height;
    if (h > livre && h <= livre * 1.4) s.style.zoom = (livre / h).toFixed(3);
  }
}
// Roda já (a página é escrita por código e o evento load nem sempre dispara), de novo antes de imprimir, e abre a impressão
encaixar();
window.addEventListener('beforeprint', encaixar);
// Prévia: X em cada quadro opcional e no título de cada seção (tira do relatório)
if (${previa ? 'true' : 'false'}) {
  for (const s of document.querySelectorAll('#diag .rel-sec')) {
    const g = s.dataset.grupo || '';
    const cab = s.querySelector('.rel-cab');
    if (cab) cab.insertAdjacentHTML('beforeend', '<button class="x-rel" data-k="' + g + '" title="Tirar esta seção do relatório">×</button>');
    for (const b of s.querySelectorAll('.bl-rel')) b.insertAdjacentHTML('beforeend', '<button class="x-rel" data-k="' + g + ':' + b.dataset.bloco + '" title="Tirar este quadro do relatório">×</button>');
  }
  document.addEventListener('click', e => { const x = e.target.closest('.x-rel'); if (x) parent.postMessage({ tirarRel: x.dataset.k }, '*'); });
}
// Estimativa de páginas para a prévia: capa + cada seção (reduzida até 40%) ocupa uma ou mais folhas
function contarPaginas() {
  const mm = 96 / 25.4, livre = (210 - 18) * mm - 60;
  let n = 1;
  for (const s of document.querySelectorAll('#diag .rel-sec')) n += Math.max(1, Math.ceil((s.getBoundingClientRect().height - 18 * mm * 0.72) / livre - 0.02));
  return n;
}
// A fonte (Manrope) muda a altura do texto: encaixa de novo quando ela terminar de carregar
document.fonts && document.fonts.ready.then(encaixar);
${previa ? '' : 'Promise.race([document.fonts ? document.fonts.ready : null, new Promise(r => setTimeout(r, 2500))]).then(() => setTimeout(() => { encaixar(); window.print(); }, 300));'}
<\/script>
</body></html>`;
  return html;
}

