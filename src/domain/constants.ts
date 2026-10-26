export const CLASSES_EST: Record<string, string> = {
  Pos: 'Pós-fixado (CDI)',
  Infl: 'Inflação (IPCA+)',
  Pre: 'Pré-fixado',
  Acoes: 'Ações Brasil',
  FII: 'FIIs e Fiagro',
  Alt: 'Alternativos (FIP / PE)',
  MM: 'Multimercado',
  Intl: 'Internacional',
  Cripto: 'Criptoativos',
  Caixa: 'Caixa e liquidez',
  Outros: 'Não identificado'
};

export const RISCO_CREDITO: Record<string, string> = {
  Sob: 'Risco Soberano',
  Banc: 'Crédito Bancário',
  Corp: 'Crédito Privado Corporativo',
  Estr: 'Crédito Estruturado',
  ReaisTijolo: 'Ativos Reais — Tijolo',
  ReaisSoc: 'Ativos Reais — Participações Societárias',
  FRF: 'Fundos de Renda Fixa',
  Acoes: 'Ações (Risco de Mercado)',
  Alt: 'Alternativos',
  Imob: 'Imobiliário (FIIs)',
  MM: 'Fundos Multimercado',
  Intl: 'Internacional',
  Cripto: 'Criptoativos',
  Caixa: 'Caixa / Liquidez',
  Deriv: 'Derivativo',
  Outros: 'Não identificado'
};

export const CONTRAPARTES = RISCO_CREDITO;

export const POLITICA_PADRAO = {
  nome: 'Política de Investimentos Padrão (Range Operacional)',
  classes: {
    Pos:   { min: 0.10, alvo: 0.20, max: 0.35 },
    Infl:  { min: 0.15, alvo: 0.25, max: 0.40 },
    Pre:   { min: 0.00, alvo: 0.05, max: 0.10 },
    Acoes: { min: 0.05, alvo: 0.10, max: 0.15 },
    FII:   { min: 0.05, alvo: 0.10, max: 0.15 },
    Alt:   { min: 0.00, alvo: 0.05, max: 0.10 },
    Intl:  { min: 0.05, alvo: 0.10, max: 0.15 },
    Caixa: { min: 0.02, alvo: 0.05, max: 0.10 }
  },
  credito: {
    Sob:         { min: 0.20, alvo: 0.35, max: 0.50 },
    Banc:        { min: 0.10, alvo: 0.20, max: 0.30 },
    Corp:        { min: 0.05, alvo: 0.15, max: 0.25 },
    Estr:        { min: 0.00, alvo: 0.05, max: 0.10 },
    ReaisTijolo: { min: 0.05, alvo: 0.10, max: 0.20 },
    ReaisSoc:    { min: 0.00, alvo: 0.05, max: 0.10 },
    Acoes:       { min: 0.05, alvo: 0.10, max: 0.15 },
    MM:          { min: 0.00, alvo: 0.05, max: 0.10 },
    Intl:        { min: 0.05, alvo: 0.10, max: 0.15 },
    Caixa:       { min: 0.02, alvo: 0.05, max: 0.10 }
  }
};

export const HORIZONTES: Record<string, [string, string]> = {
  C: ['Curto prazo', 'Liquidez diária'],
  M: ['Médio prazo', 'Até 2 anos'],
  L: ['Longo prazo', 'Acima de 2 anos']
};

export const JANELAS: Record<string, string> = {
  dia: 'Diária (D+0 / D+1)',
  prev: 'Previdência (resgate em dias)',
  bolsa: 'Bolsa (D+2)',
  cot: 'Fundos com cotização',
  venc: 'Até o vencimento'
};

export const NOME_INST: Record<string, string> = {
  BTG: 'BTG Pactual',
  XP: 'XP Investimentos',
  Safra: 'Banco Safra',
  Caixa: 'Caixa Econômica Federal',
  Nomad: 'Nomad Global (USD)',
  Rhino: 'Rhino Securitizadora'
};

export const TIPOS: Record<string, string> = {
  EQ: 'Ações / Stocks',
  ETF: 'ETFs',
  REIT: 'Real Estate (REITs)',
  BOND: 'Bonds (Renda Fixa USD)',
  CASH: 'Saldo em Dólar'
};

export const PALETA_DG = ['#0A1F44', '#1F4E87', '#2E6FB7', '#4A86C5', '#7FA6D3', '#3C4A5E', '#5C6B80', '#8995A8', '#A9C3E2', '#B9C4D2'];

export const RAMPA = ['#cfe0f5', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0A1F44'];

export const CHAVE_FONTES = 'bi-base-clientes:fontes';
export const CHAVE_CAD = 'bi-base-clientes:cadastro-extra';
export const CHAVE_HIST = 'bi-base-clientes:historico';
export const CHAVE_PASTA = 'bi-base-clientes:pasta-dono';
export const CHAVE_CAD_ARQ = 'bi-base-clientes:cadastro-arquivo';
export const CHAVE_USUARIO = 'bi-base-clientes:usuario';
export const CHAVE_VERSAO = 'bi-base-clientes:versao-vista';
export const CHAVE_POLITICAS = 'bi-base-clientes:politicas-investimento';
export const CHAVE_BASE_BTG = 'bi-base-clientes:base-btg';
export const CHAVE_FAIXAS_BASE = 'bi-base-clientes:faixas-base';
export const CHAVE_FUND_GUIDE = 'bi-base-clientes:fund-guide';

export const FAIXAS_PADRAO_BASE = [
  { rotulo: 'Sem patrimônio', min: -Infinity, max: 0.01 },
  { rotulo: 'Até 100 mil', min: 0.01, max: 100000 },
  { rotulo: '100 a 500 mil', min: 100000, max: 500000 },
  { rotulo: '500 mil a 1 mi', min: 500000, max: 1000000 },
  { rotulo: '1 a 5 mi', min: 1000000, max: 5000000 },
  { rotulo: 'Acima de 5 mi', min: 5000000, max: Infinity }
];

export const VERSOES_BI = [
  { versao: '2026.10.26', data: '2026-10-26', autor: 'Lucas + IA', mudancas: [
    'Integração oficial da Base Fund Guide BTG (1.029 fundos mapeados por estratégia): classificação fidedigna por CNPJ e Nome, identificação automática de estratégias oficiais (Pós-fixado, Inflação, Retorno Absoluto MM, Renda Variável, Internacional, Alternativo) e suporte a upload dinâmico de planilhas FundGuide_*.xlsx.',
  ] },
  { versao: '2026.10.23', data: '2026-10-23', autor: 'Lucas + IA', mudancas: [
    'Nova visão Base de Clientes (CRM / Plano de Negócio): leitura da Base BTG com segmentação por faixas de PL editáveis, PF vs PJ e exportação em Excel.',
  ] },
  { versao: '2026.10.22', data: '2026-10-22', autor: 'Lucas + IA', mudancas: [
    'Casas gestoras: Contea, Carbyne, BRM, Apex, Eluja e Pignola consolidadas numa única gestora ("Contea / Carbyne / Apex / Pignola").',
    'Emissores diretos: "Boa Safra" (CRA Boa Safra Sementes) não aparece mais como "Banco Safra".',
    'Contea Valadier (FIC FIM em cota júnior de FIDC): classe Alternativos, risco Crédito Estruturado, liquidez por cotização.',
  ] },
  { versao: '2026.10.19', data: '2026-10-19', autor: 'Vinicius + Claude', mudancas: [
    'Casas gestoras: Carbyne, BRM e Apex aparecem juntas numa linha só ("Carbyne / BRM / Apex").',
  ] },
  { versao: '2026.10.15c', data: '2026-10-15', autor: 'Vinicius + Claude', mudancas: [
    'Versão unificada no repositório bi-consolidador-main: as melhorias de 14 e 15/10 entram na estrutura Vite + TypeScript.',
    'A barra acima das abas voltou: planilha do BTG carregada (arquivo, posição, lida em) com Extratos, Políticas, Atualizar com a pasta e + Anexar extrato.',
    'Vários arquivos anexados de uma vez: a planilha diária do BTG é lida primeiro, depois os extratos (assim o cliente já aparece como existente na conferência). O tipo de cada arquivo vem da extensão.',
    'Extratos: "Substituir" e "Remover" (inclusive da planilha do BTG) funcionam a partir da janela Extratos.',
    'Clientes com o mesmo primeiro nome não se misturam (conta ao lado do nome; nome completo pedido ao anexar); aviso com "Carregar grupos.js" quando faltam os nomes completos.',
    'Diagnóstico: quadro "Posição por conta e instituição" com o titular de cada conta (PF/PJ); coluna "Titular da conta" no Editar cadastro.',
    'PF e PJ no mesmo banco não se substituem; leitor do PDF "Detalhes das Debêntures"; "Saldo em conta" em primeiro lugar em Ativo e alocação.',
  ] },
  { versao: '2026.10.15', data: '2026-10-15', autor: 'Gestão de Engenharia + Analista', mudancas: [
    'Fase 2 (Vite + TypeScript): Decomposição integral do monólito em módulos limpos (/domain, /parsers, /components, /styles).',
    'Separação das regras de negócios fiduciárias da manipulação de interface DOM.',
    'Testes automatizados com Vitest para cálculos de precisão e leitores de extratos.',
  ] },
  { versao: '2026.10.14', data: '2026-10-14', autor: 'Gestão de Engenharia + Analista', mudancas: [
    'Precisão Numérica Financeira Total (BigNumber): Extensão da precisão aritmética matemática para todas as rotinas do sistema (cálculos de tabelas do PDF, horizontes de prazo C/M/L, agregação de contas/clientes/famílias, fatias de roscas e rebalanceamento), eliminando completamente resíduos de ponto flutuante IEEE-754.',
  ] },
  { versao: '2026.10.10b', data: '2026-10-10', autor: 'Gestão de Engenharia + Analista', mudancas: [
    'Blindagem de Segurança (SRI): Hashes de integridade SHA-384 em scripts de CDN (xlsx, bignumber, pdf.js, tesseract) para neutralizar risco de adulteração de código.',
    'Precisão Numérica Financeira: Integração da biblioteca bignumber.js eliminando resíduos de ponto flutuante IEEE-754 em somas de patrimônio e conversão cambial PTAX.',
    'Persistência Robusta: Migração do armazenamento de extratos, posições e cadastros para IndexedDB, eliminando o erro de cota cheia de 5 MB do localStorage.',
  ] }
];

export const VERSAO_BI = VERSOES_BI[0].versao;

// "Ativo" que junta a conta corrente de cada conta (Ativo e alocação), como no print de saldos do BTG
export const SALDO_CONTA = 'Saldo em conta';
