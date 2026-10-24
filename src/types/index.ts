export interface Posicao {
  conta: string;
  nome: string;
  clienteNome?: string;
  clienteId?: string;
  familiaNome?: string | null;
  instituicao?: string;
  mercado?: string;
  classe?: string;
  subclasse?: string;
  estrategia?: string;
  nomeAtivo?: string;
  ativo?: string;
  produto?: string;
  emissor?: string;
  vencimento?: Date | null;
  taxaCompra?: string | number | null;
  taxaEmissao?: string | number | null;
  taxaTexto?: string;
  quantidade?: number;
  bruto?: number;
  liquido?: number;
  data?: Date | null;
  caixa?: boolean;
  transito?: boolean;
  receber?: boolean;
  intl?: boolean;
  prev?: boolean;
  tipoPlano?: string;
  usd?: number;
  cambio?: number;
  cambioData?: string | null;
  moeda?: string;
  sim?: boolean;
  mov?: any;
  cnpj?: string;
  dataCompra?: Date | null;
  ir?: number;
  iof?: number;
  grupo?: string;
  titular?: string | null;  // titular como veio no extrato (ex.: a PJ do cliente)
}

export interface FonteExtrato {
  id: string;
  inst: string;
  rotulo?: string;
  arquivo?: string;
  dataRef?: string;
  enviadoEm?: string;
  enviadoPor?: string;
  total?: number;
  registros: Posicao[];
  contaBTG?: string;
  combinado?: boolean;
  modelo?: string;
}

export interface Cliente {
  id: string;
  nome: string;
  contas: string[];
  familiaNome?: string | null;
  familiaId?: string | null;
  pl?: number;
  caixa?: number;
}

export interface Familia {
  id: string;
  nome: string;
  clientes: string[];
  contas: string[];
  pl?: number;
  caixa?: number;
}

export interface Unidade {
  key: string;
  tipo: 'cliente' | 'familia';
  nome: string;
  sub: string;
  contas: string[];
  pl: number;
  caixa: number;
}

export interface PoliticaFaixa {
  min: number;
  alvo: number;
  max: number;
}

export interface PoliticaInvestimento {
  nome?: string;
  conta?: string;
  perfil?: string;
  classes?: Record<string, PoliticaFaixa>;
  credito?: Record<string, PoliticaFaixa>;
}

export interface MovimentoSimulado {
  ativo: string;
  conta: string;
  classe: string;
  subclasse: string;
  estrategia: string;
  v: number;
  origem: 'caixa' | 'aporte';
  novo?: boolean;
  i?: number;
}

export interface EstadoGlobal {
  posicoes: Posicao[];
  fontes: Map<string, FonteExtrato>;
  clientes: Map<string, Cliente>;
  familias: Map<string, Familia>;
  clientePorConta: Map<string, Cliente>;
  descConta: Map<string, string>;
  cadExtra: Map<string, { conta: string; cliente: string; familia?: string; descricao?: string }>;
  politicasPorConta: Map<string, PoliticaInvestimento>;
  aba: string;
  dim: 'classe' | 'subclasse' | 'estrategia' | 'instituicao';
  campoValor: 'bruto' | 'liquido';
  topN: number;
  raioX: string;
  abertas: Set<string>;
  ordem: Record<string, { k: string; dir: number }>;
  mapa: {
    nivel: 'cliente' | 'familia';
    cols: 'classe' | 'subclasse' | 'estrategia' | 'ativo';
    metrica: 'brl' | 'pctConta';
    filtro: string;
    busca: string;
  };
  sel: string;
  busca?: string;
  buscaConta: string;
  ativo: string;
  ativoModo: 'um' | 'varios';
  ativosSel: string[];
  alvo: number;
  minimo: number;
  publico: 'todos' | 'tem' | 'naotem';
  exemplo: boolean;
  movs: Map<string, MovimentoSimulado[]>;
  fm: {
    ativo: string;
    conta: string;
    acao: 'aplicar' | 'resgatar' | 'alvo';
    nivel: 'ativo' | 'subclasse' | 'classe';
    modo: string;
    valor: string;
    origem: 'caixa' | 'aporte';
    novo: {
      nome: string;
      classe: string;
      subclasse: string;
      estrategia: string;
    };
  };
  rel?: any;
  relItens?: any;
  baseBtg: BaseBtgConta[];
  faixasBase: FaixaPLConfig[];
  filtroBase: {
    modo: 'conta' | 'cliente';
    assessor: string;
    status: string;
    tipoInvestidor: string;
    busca: string;
    faixaSel: string | null;
    tipoSel: string | null;
  };
  simuladorPlano: SimuladorPlanoConfig;
}

export interface SimuladorPlanoConfig {
  prazoMeses: number;
  taxaPfAa: number;
  taxaPjAa: number;
  faixasSelecionadas: string[];
  excluirEstrangeiros: boolean;
  assessorSel: string;
  subAba: 'evolucao' | 'assessores' | 'contas';
}

export interface BaseBtgConta {
  conta: string;
  nome: string;
  tipo: 'PF' | 'PJ' | 'Estrangeiro' | 'Outro';
  plTotal: number;
  assessor: string;
  status: string;
  tipoInvestidor: string;
  idCliente?: string;
  faixaBtg?: string;
  cidade?: string;
  estado?: string;
  dataAbertura?: string;
}

export interface FaixaPLConfig {
  rotulo: string;
  min: number;
  max: number;
}

export type ExtratoLido = any;
export type ExtratoRegistro = any;

