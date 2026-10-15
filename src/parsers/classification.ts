import { norm, palavras } from '../components/formatters';

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

export function classificar(nome: string, { categoria = '', indexador = '', dica = '' }: { categoria?: string; indexador?: string; dica?: string } = {}) {
  const w = (' ' + norm(nome).replace(/[^a-z0-9]+/g, ' ').trim() + ' ').replace(/ fic(fidc|fim|fia|fip|firf) /g, ' fic $1 ');
  const c = ' ' + norm(categoria).replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  const estrIx = estrategiaIndexador(indexador);

  if (/ fii /.test(w) || / fundo imobiliario /.test(w)) return { classe: 'Renda Variável', sub: 'FII', estr: 'Alternativo' };
  if (/ (swap|termo|ndf|opcao|opcoes|derivativo|derivativos) /.test(w) || / (derivativos|opcoes) /.test(c)) return { classe: 'Derivativos', sub: 'Derivativos', estr: 'Derivativos' };
  if (/ (previdencia|pgbl|vgbl) /.test(w) || / previdencia /.test(c)) return { classe: 'Previdência', sub: 'PP', estr: estrategiaFundo(w, dica) };
  if (/ (fidc|fip) /.test(w)) return { classe: 'Fundos', sub: 'FN', estr: 'Alternativo' };

  const fundoNome = / (fi|fic|fia|fim|firf|firfrefdi|refdi|fundo|fundos|referenciado) /.test(w);
  if (/ (ntn|ntnb|ltn|lft|ntnf) /.test(w) || (/ tesouro /.test(w) && !fundoNome)) {
    const tipo = / ltn /.test(w) ? 'LTN' : / (lft|selic) /.test(w) ? 'LFT' : / (ntn f|ntnf) /.test(w) ? 'NTN-F' : 'NTN-B';
    return { classe: 'Renda Fixa', sub: 'TITULO PUBLICO', estr: estrIx || ({ LTN: 'Pré-fixado', 'NTN-F': 'Pré-fixado', LFT: 'Pós-fixado' } as any)[tipo] || 'Inflação', tipo };
  }

  const priv = w.match(/ (cri|cra|crapre|debent|debenture|debentures) /);
  if (priv) return { classe: 'Renda Fixa', sub: 'PRIVADO', estr: estrIx || 'Sem classificação', tipo: priv[1].startsWith('cri') ? 'CRI' : priv[1].startsWith('cra') ? 'CRA' : 'Debênture' };

  const banc = w.match(/ (cdb|lca|lci|lf|lig|rdb|lc) /);
  if (banc) return { classe: 'Renda Fixa', sub: 'BANCARIO', estr: estrIx || 'Pós-fixado', tipo: banc[1].toUpperCase() };

  if (/ coe /.test(w)) return { classe: 'COE', sub: 'COE', estr: 'Alternativo', tipo: 'COE' };
  if (/ (fic|fi|fia|fim|firf|fundo|fundos|referenciado) /.test(w) || / fundo/.test(c)) return { classe: 'Fundos', sub: 'FN', estr: estrategiaFundo(w, dica) };
  if (/ (acoes|acao|renda variavel) /.test(c)) return { classe: 'Renda Variável', sub: 'ACAO', estr: 'Renda Variável' };
  if (/ renda fixa /.test(c)) return { classe: 'Renda Fixa', sub: 'OUTROS', estr: estrIx || 'Sem classificação' };

  return { classe: 'Outros', sub: 'Outros', estr: estrIx || 'Sem classificação' };
}

export const registroFundo = (nome: string, cls: any, extra: any = {}) => ({
  mercado: cls.classe,
  sub: cls.sub,
  ativo: nome,
  produto: nome,
  estrategia: cls.estr,
  ...extra
});
