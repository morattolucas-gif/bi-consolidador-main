import { EstadoGlobal } from '../types';

export const S: EstadoGlobal = {
  posicoes: [],
  fontes: new Map(),
  clientes: new Map(),
  familias: new Map(),
  clientePorConta: new Map(),
  descConta: new Map(),
  cadExtra: new Map(),
  politicasPorConta: new Map(),
  aba: 'carteira',
  dim: 'classe',
  campoValor: 'bruto',
  topN: 10,
  raioX: '',
  abertas: new Set(),
  ordem: {},
  mapa: { nivel: 'cliente', cols: 'classe', metrica: 'brl', filtro: '', busca: '' },
  sel: '',
  buscaConta: '',
  ativo: '',
  ativoModo: 'um',
  ativosSel: [],
  alvo: 0.05,
  minimo: 10000,
  publico: 'todos',
  exemplo: false,
  movs: new Map(),
  fm: {
    ativo: '',
    conta: '',
    acao: 'aplicar',
    nivel: 'ativo',
    modo: 'valor',
    valor: '',
    origem: 'caixa',
    novo: { nome: '', classe: '', subclasse: '', estrategia: '' }
  },
  baseBtg: [],
  faixasBase: [
    { rotulo: 'Sem patrimônio', min: -Infinity, max: 0.01 },
    { rotulo: 'Até 100 mil', min: 0.01, max: 100000 },
    { rotulo: '100 a 500 mil', min: 100000, max: 500000 },
    { rotulo: '500 mil a 1 mi', min: 500000, max: 1000000 },
    { rotulo: '1 a 5 mi', min: 1000000, max: 5000000 },
    { rotulo: 'Acima de 5 mi', min: 5000000, max: Infinity }
  ],
  filtroBase: {
    modo: 'conta',
    assessor: '',
    status: '',
    tipoInvestidor: '',
    busca: '',
    faixaSel: null,
    tipoSel: null
  },
  simuladorPlano: {
    prazoMeses: 6,
    taxaPfAa: 0.75,
    taxaPjAa: 0.30,
    faixasSelecionadas: ['100 a 500 mil'],
    excluirEstrangeiros: true,
    assessorSel: '',
    subAba: 'evolucao'
  }
};
