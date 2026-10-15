import { describe, it, expect } from 'vitest';
import { classificar } from '../src/parsers/classification';
import { reconciliar } from '../src/parsers/reconciliar';
import { interpretarCadastro } from '../src/parsers/pasta';
import { chaveConta } from '../src/components/formatters';

describe('Camada de Parsers e Classificação de Ativos', () => {
  it('classifica corretamente Títulos Públicos (Tesouro Direto / NTN-B / LFT / LTN)', () => {
    const ntnb = classificar('TESOURO IPCA+ 2035 (NTN-B)');
    expect(ntnb.classe).toBe('Renda Fixa');
    expect(ntnb.sub).toBe('TITULO PUBLICO');
    expect(ntnb.estr).toBe('Inflação');

    const lft = classificar('TESOURO SELIC 2029 (LFT)');
    expect(lft.classe).toBe('Renda Fixa');
    expect(lft.sub).toBe('TITULO PUBLICO');
    expect(lft.estr).toBe('Pós-fixado');

    const ltn = classificar('TESOURO PREFIXADO 2028 (LTN)');
    expect(ltn.classe).toBe('Renda Fixa');
    expect(ltn.sub).toBe('TITULO PUBLICO');
    expect(ltn.estr).toBe('Pré-fixado');
  });

  it('classifica Renda Fixa Bancária (CDB, LCA, LCI, LF)', () => {
    const cdb = classificar('CDB BANCO ITAU BMG S.A. 102% CDI');
    expect(cdb.classe).toBe('Renda Fixa');
    expect(cdb.sub).toBe('BANCARIO');
    expect(cdb.tipo).toBe('CDB');

    const lca = classificar('LCA BANCO DO BRASIL 94% CDI');
    expect(lca.classe).toBe('Renda Fixa');
    expect(lca.sub).toBe('BANCARIO');
    expect(lca.tipo).toBe('LCA');
  });

  it('classifica Crédito Privado (CRI, CRA, Debêntures)', () => {
    const deb = classificar('DEBENTURES DA VALE S.A. 2030', { indexador: 'IPCA' });
    expect(deb.classe).toBe('Renda Fixa');
    expect(deb.sub).toBe('PRIVADO');
    expect(deb.estr).toBe('Inflação');

    const cri = classificar('CRI HELBOR EMPREENDIMENTOS');
    expect(cri.classe).toBe('Renda Fixa');
    expect(cri.sub).toBe('PRIVADO');
    expect(cri.tipo).toBe('CRI');
  });

  it('classifica Fundos de Investimento por categoria e siglas (FIA, FIM, FIRF)', () => {
    const fia = classificar('ITAU IBOVESPA ATIVO FIC FIA');
    expect(fia.classe).toBe('Fundos');
    expect(fia.sub).toBe('FN');
    expect(fia.estr).toBe('Renda Variável');

    const fim = classificar('KAPITALO KAPPA MASTER FIC FIM');
    expect(fim.classe).toBe('Fundos');
    expect(fim.sub).toBe('FN');
    expect(fim.estr).toBe('Retorno Absoluto (MM)');

    const fii = classificar('CSHG LOGISTICA FII HGLG11');
    expect(fii.classe).toBe('Renda Variável');
    expect(fii.sub).toBe('FII');
    expect(fii.estr).toBe('Alternativo');
  });

  it('normaliza chaves de conta bancária sem zeros à esquerda', () => {
    expect(chaveConta('00012345-6')).toBe('12345-6');
    expect(chaveConta('  0098765 ')).toBe('98765');
    expect(chaveConta('100456')).toBe('100456');
  });

  it('reconciliação audita divergências e cria item de ajuste fiduciário', () => {
    const extrato = {
      inst: 'Safra',
      total: 100000,
      regs: [
        { bruto: 60000 },
        { bruto: 39000 }
      ],
      avisos: []
    };
    const reconciliado = reconciliar(extrato);
    expect(reconciliado.regs.length).toBe(3);
    expect(reconciliado.regs[2].produto).toBe('Outros (não detalhado)');
    expect(reconciliado.regs[2].bruto).toBe(1000);
    expect(reconciliado.soma).toBe(100000);
    expect(reconciliado.avisos.length).toBe(1);
  });

  it('interpreta arquivo grupos.js em formato JavaScript / JSON sem falhas', () => {
    const mockGruposJs = `
      // Cadastro de clientes do escritório
      window.CADASTRO_CLIENTES = [
        { conta: '12345', cliente: 'Carlos Alberto Silva', familia: 'Familia Silva' },
        { conta: '67890', cliente: 'Mariana Silva', familia: 'Familia Silva' }
      ];
      window.APELIDOS_CLIENTES = [
        ['Carlos Alberto Silva', 'Carlos']
      ];
    `;
    const res = interpretarCadastro(mockGruposJs);
    expect(res.clientes.length).toBe(2);
    expect(res.clientes[0].cliente).toBe('Carlos Alberto Silva');
    expect(res.clientes[0].familia).toBe('Familia Silva');
    expect(res.apelidos.length).toBe(1);
    expect(res.apelidos[0][1]).toBe('Carlos');
  });
});
