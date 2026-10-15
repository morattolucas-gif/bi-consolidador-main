import { somaLista, subPrecisa } from '../domain/precision';
import { brl } from '../components/formatters';

export function reconciliar(ext: any) {
  const soma = somaLista(ext.regs, (r: any) => r.bruto);
  if (ext.total !== null && ext.total !== undefined && Math.abs(soma - ext.total) > 1) {
    const dif = subPrecisa(ext.total, soma);
    ext.avisos.unshift(
      `A soma das posições lidas (${brl(soma)}) difere do total do extrato (${brl(ext.total)}). A diferença de ${brl(dif)} entrou como "Outros (não detalhado)".`
    );
    ext.regs.push({
      mercado: 'Outros',
      sub: 'Outros',
      ativo: 'Outros (não detalhado)',
      produto: 'Outros (não detalhado)',
      estrategia: 'Sem classificação',
      bruto: dif,
      liquido: dif
    });
  }
  ext.soma = somaLista(ext.regs, (r: any) => r.bruto);
  return ext;
}

export function gerarExemplo(): any[] {
  let semente = 42;
  const rnd = () => {
    semente |= 0;
    semente = (semente + 0x6d2b79f5) | 0;
    let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());

  const catalogo: [string, string, string | null, string, string | null, string | null, string | null, number?][] = [
    ['Renda Variável', 'FII', 'APXM11', 'APXM11', null, null, 'Alternativo'],
    ['Renda Variável', 'FII', 'KNCR11', 'KNCR11', null, null, 'Alternativo'],
    ['Renda Variável', 'FII', 'HGLG11', 'HGLG11', null, null, 'Alternativo'],
    ['Renda Variável', 'FII', 'JGPX11', 'JGPX11', null, null, 'Alternativo'],
    ['Renda Variável', 'ACAO', 'BOVA11', 'BOVA11', null, null, 'Renda Variável'],
    ['Renda Variável', 'ACAO', 'ITUB4', 'ITUB4', null, null, 'Renda Variável'],
    ['Renda Variável', 'ACAO', 'VALE3', 'VALE3', null, null, 'Renda Variável'],
    ['Fundos', 'FN', null, 'FUNDO EXEMPLO CREDITO PRIVADO FIC FIRF', null, null, 'Pós-fixado'],
    ['Fundos', 'FN', null, 'FUNDO EXEMPLO MACRO FIC FIM', null, null, 'Retorno Absoluto (MM)'],
    ['Fundos', 'FN', null, 'FUNDO EXEMPLO ACOES FIA', null, null, 'Renda Variável'],
    ['Renda Fixa', 'BANCARIO', 'CDB-EXEMPLO001', 'CDB', 'BANCO EXEMPLO S A', '2028-01-13', 'Pós-fixado', 100],
    ['Renda Fixa', 'BANCARIO', 'LCA-EXEMPLO002', 'LCA', 'BANCO EXEMPLO S A', '2027-06-10', 'Pós-fixado', 94],
    ['Renda Fixa', 'PRIVADO', 'CRA-EXEMPLO003', 'CRA', 'AGRO EXEMPLO', '2030-06-17', 'Inflação', 7.3],
    ['Renda Fixa', 'PRIVADO', 'DEB-EXEMPLO004', 'DEBENTURE', 'ENERGIA EXEMPLO', '2032-07-15', 'Pré-fixado', 14.9],
    ['Renda Fixa', 'TITULO PUBLICO', 'NTNB', 'NTN-B', 'BACEN', '2033-05-15', 'Inflação', 7.8],
    ['Renda Fixa', 'TITULO PUBLICO', 'LTN', 'LTN', 'BACEN', '2032-01-01', 'Pré-fixado', 13.9],
    ['Previdência', 'PP', 'Certificado Prev 000001', 'PREV EXEMPLO TESOURO SELIC FI RF', null, null, 'Pós-fixado'],
    ['Previdência', 'PP', 'Certificado Prev 000002', 'PREV EXEMPLO MULTIMERCADO FIM', null, null, 'Retorno Absoluto (MM)'],
    ['COE', 'COE', 'COE-EXEMPLO005', 'Bolsa Americana - Retorno Garantido', 'BANCO EXEMPLO S A', '2027-03-01', 'Alternativo'],
    ['Criptoativos', 'CRY', 'XBT BITCOIN (XBT)', 'XBT BITCOIN (XBT)', null, null, null]
  ];

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const regs: any[] = [];
  for (let i = 1; i <= 18; i++) {
    const n = i > 15 ? i - 15 : i;
    const nome = `CLIENTE EXEMPLO ${String(n).padStart(2, '0')}`;
    const grupo = n === 4 || n === 5 ? 'Família Exemplo 04 e 05' : `Cliente ${String(n).padStart(2, '0')}`;
    const cc = String(900000 + i).padStart(9, '0');
    const patrimonio = Math.exp(14.2 + 0.8 * normal());
    const idx = catalogo
      .map((_, k) => k)
      .sort(() => rnd() - 0.5)
      .slice(0, 4 + Math.floor(rnd() * 6));
    const pesos = idx.map(() => -Math.log(1 - rnd())).concat([-Math.log(1 - rnd()) * 0.5]);
    const soma = somaLista(pesos);
    idx.forEach((k, j) => {
      const [mercado, sub, ativo, produto, emissor, venc, estrategia, taxa] = catalogo[k];
      const bruto = Math.round((patrimonio * pesos[j]) / soma * 100) / 100;
      regs.push({
        conta: cc,
        nome,
        grupo,
        mercado,
        sub,
        ativo,
        produto,
        emissor,
        vencimento: venc ? new Date(venc) : null,
        estrategia,
        taxaCompra: taxa ?? null,
        quantidade: Math.round(bruto / 100),
        bruto,
        liquido: Math.round(bruto * 0.99 * 100) / 100,
        data: hoje
      });
    });
    const cx = Math.round((patrimonio * pesos.at(-1)!) / soma * 100) / 100;
    regs.push({
      conta: cc,
      nome,
      grupo,
      mercado: 'Conta Corrente',
      sub: 'CC',
      produto: 'Conta Corrente',
      bruto: cx,
      liquido: cx,
      data: hoje
    });
  }
  return regs;
}

