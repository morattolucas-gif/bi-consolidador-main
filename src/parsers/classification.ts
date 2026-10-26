import { norm, palavras } from '../components/formatters';
import { buscarFundoGuia, FundoGuideItem } from './fund-guide';

export function estrategiaIndexador(ix: string): string | null {
  const i = ' ' + norm(ix).replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  if (/ (ipca|ipc a|igpm|igp m|inflacao) /.test(i)) return 'Inflação';
  if (/ (pre|prefixado|prefixed) /.test(i)) return 'Pré-fixado';
  if (/ (cdi|selic|di|pos|di1) /.test(i)) return 'Pós-fixado';
  return null;
}

export function estrategiaFundo(w: string, dica: string = ''): string {
  if (/ fidc /.test(w)) return 'Alternativo';
  const d = ' ' + norm(dica).replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  if (/ multimercado/.test(d)) return 'Retorno Absoluto (MM)';
  if (/ (acoes|renda variavel) /.test(d)) return 'Renda Variável';
  const porDica = estrategiaIndexador(dica);
  if (porDica) return porDica;
  if (/ (fia|acoes|acao) /.test(w)) return 'Renda Variável';
  if (/ (fim|mult|multimercado|macro) /.test(w)) return 'Retorno Absoluto (MM)';
  if (/ (ntnb|ntn b|ipca|inflacao|imab|ima b) /.test(w)) return 'Inflação';
  if (/ (rf|firf|firfrefdi|refdi|di|selic|referen|referenciado|renda fixa|simples|cp|credito) /.test(w)) return 'Pós-fixado';
  return 'Sem classificação';
}

export function classificar(
  nome: string,
  {
    categoria = '',
    indexador = '',
    dica = '',
    cnpj = ''
  }: { categoria?: string; indexador?: string; dica?: string; cnpj?: string } = {}
) {
  const w = (' ' + norm(nome).replace(/[^a-z0-9]+/g, ' ').trim() + ' ').replace(/ fic(fidc|fim|fia|fip|firf) /g, ' fic $1 ');
  const c = ' ' + norm(categoria).replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  const estrIx = estrategiaIndexador(indexador);

  // 1. Consulta prioritária na Base Oficial do Fund Guide BTG (pelo CNPJ ou Nome do fundo)
  // Só não prioriza se for explicitamente um título de renda fixa bancária/pública/privada declarada
  const ehFundoDeclarado = / (fic|fi|fia|fim|firf|firfrefdi|refdi|fundo|fundos|referenciado) /.test(w) || / fundo/.test(c) || /previd/.test(c);
  const guia = (cnpj || ehFundoDeclarado || !/ (cdb|lca|lci|cri|cra|debent|tesouro|ntn|ltn|lft) /.test(w))
    ? buscarFundoGuia(nome, cnpj)
    : null;

  if (guia) {
    const isPrev = / (previdencia|pgbl|vgbl) /.test(w) || / previdencia /.test(c) || guia.classe === 'Previdência';
    return {
      classe: isPrev ? 'Previdência' : guia.classe,
      sub: isPrev ? 'PP' : guia.sub,
      estr: guia.estrategia,
      tipo: guia.categoriaBtg,
      riscoCredito: guia.riscoCredito || 'Corp',
      contraparte: guia.riscoCredito || 'Corp',
      guia
    };
  }

  // 2. Classificação heurística padrão para os demais ativos
  if (/ fii /.test(w) || / fundo imobiliario /.test(w)) {
    const ehPapel = / (recebiveis|cri|cra|credito|debentures|infra) /.test(w);
    return { classe: 'Renda Variável', sub: 'FII', estr: 'Alternativo', riscoCredito: ehPapel ? 'Estr' : 'Imob', contraparte: ehPapel ? 'Estr' : 'Imob' };
  }
  if (/ (swap|termo|ndf|opcao|opcoes|derivativo|derivativos) /.test(w) || / (derivativos|opcoes) /.test(c)) {
    return { classe: 'Derivativos', sub: 'Derivativos', estr: 'Derivativos', riscoCredito: 'Deriv', contraparte: 'Deriv' };
  }
  if (/ (previdencia|pgbl|vgbl) /.test(w) || / previdencia /.test(c)) {
    return { classe: 'Previdência', sub: 'PP', estr: estrategiaFundo(w, dica), riscoCredito: 'Corp', contraparte: 'Corp' };
  }
  if (/ (fidc|fip) /.test(w)) {
    return { classe: 'Fundos', sub: 'FN', estr: 'Alternativo', riscoCredito: 'Estr', contraparte: 'Estr' };
  }

  const fundoNome = / (fi|fic|fia|fim|firf|firfrefdi|refdi|fundo|fundos|referenciado) /.test(w);
  if (/ (ntn|ntnb|ltn|lft|ntnf) /.test(w) || (/ tesouro /.test(w) && !fundoNome)) {
    const tipo = / ltn /.test(w) ? 'LTN' : / (lft|selic) /.test(w) ? 'LFT' : / (ntn f|ntnf) /.test(w) ? 'NTN-F' : 'NTN-B';
    return {
      classe: 'Renda Fixa',
      sub: 'TITULO PUBLICO',
      estr: estrIx || ({ LTN: 'Pré-fixado', 'NTN-F': 'Pré-fixado', LFT: 'Pós-fixado' } as any)[tipo] || 'Inflação',
      tipo,
      riscoCredito: 'Sob',
      contraparte: 'Sob'
    };
  }

  const priv = w.match(/ (cri|cra|crapre|debent|debenture|debentures) /);
  if (priv) {
    const isEstr = priv[1].startsWith('cri') || priv[1].startsWith('cra');
    return {
      classe: 'Renda Fixa',
      sub: 'PRIVADO',
      estr: estrIx || 'Sem classificação',
      tipo: isEstr ? (priv[1].startsWith('cri') ? 'CRI' : 'CRA') : 'Debênture',
      riscoCredito: isEstr ? 'Estr' : 'Corp',
      contraparte: isEstr ? 'Estr' : 'Corp'
    };
  }

  const banc = w.match(/ (cdb|lca|lci|lf|lig|rdb|lc) /);
  if (banc) {
    return {
      classe: 'Renda Fixa',
      sub: 'BANCARIO',
      estr: estrIx || 'Pós-fixado',
      tipo: banc[1].toUpperCase(),
      riscoCredito: 'Banc',
      contraparte: 'Banc'
    };
  }

  if (/ coe /.test(w)) return { classe: 'COE', sub: 'COE', estr: 'Alternativo', tipo: 'COE', riscoCredito: 'Banc', contraparte: 'Banc' };
  if (/ (fic|fi|fia|fim|firf|fundo|fundos|referenciado) /.test(w) || / fundo/.test(c)) {
    const isBanc = / (mag cash|zupo|bancario|pos fixado|di simples|referenciado di|tesouraria) /.test(w);
    const isEstr = / (mca|fidc|estruturado) /.test(w);
    const rc = isEstr ? 'Estr' : isBanc ? 'Banc' : 'Corp';
    return { classe: 'Fundos', sub: 'FN', estr: estrategiaFundo(w, dica), riscoCredito: rc, contraparte: rc };
  }
  if (/ (acoes|acao|renda variavel) /.test(c)) return { classe: 'Renda Variável', sub: 'ACAO', estr: 'Renda Variável', riscoCredito: 'Acoes', contraparte: 'Acoes' };
  if (/ renda fixa /.test(c)) return { classe: 'Renda Fixa', sub: 'OUTROS', estr: estrIx || 'Sem classificação', riscoCredito: 'Corp', contraparte: 'Corp' };

  return { classe: 'Outros', sub: 'Outros', estr: estrIx || 'Sem classificação', riscoCredito: 'Outros', contraparte: 'Outros' };
}

export const registroFundo = (nome: string, cls: any, extra: any = {}) => ({
  mercado: cls.classe,
  sub: cls.sub,
  ativo: nome,
  produto: nome,
  estrategia: cls.estr,
  riscoCredito: cls.riscoCredito || cls.guia?.riscoCredito || extra.riscoCredito,
  contraparte: cls.contraparte || cls.guia?.riscoCredito || extra.contraparte || cls.riscoCredito,
  cnpj: cls.guia?.cnpjFormatado || extra.cnpj,
  gestor: cls.guia?.gestor || extra.gestor,
  benchmark: cls.guia?.benchmark || extra.benchmark,
  categoriaBtg: cls.guia?.categoriaBtg,
  subcategoriaBtg: cls.guia?.subcategoriaBtg,
  ...extra
});
