// Nome e opções vêm de marca.json: o da raiz do projeto ou o de instalacoes/<nome> (ver vite.config.ts)
declare const __MARCA__: {
  nome: string;
  cadastroSimples?: boolean;
  empresaNaCobranca?: boolean;
  privacidadeNaEntrada?: boolean;
};

export const NOME_EMPRESA = __MARCA__.nome;

// Cadastro simples de clientes: só nome e WhatsApp obrigatórios
export const CADASTRO_SIMPLES = __MARCA__.cadastroSimples === true;

// Nome que aparece na mensagem de cobrança (null: a mensagem não cita nome)
export const EMPRESA_NA_COBRANCA = __MARCA__.empresaNaCobranca === false ? null : __MARCA__.nome;

// Link da política de privacidade na tela de login
export const PRIVACIDADE_NA_ENTRADA = __MARCA__.privacidadeNaEntrada !== false;
