// Traduz mensagens técnicas para português simples
const traducoes: [RegExp, string][] = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/email not confirmed/i, 'Este e-mail ainda não foi confirmado. Abra o convite que chegou no seu e-mail.'],
  [/user is banned/i, 'Este acesso foi desativado. Fale com um administrador.'],
  [/rate limit|too many requests|for security purposes/i, 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'],
  [/password should be at least/i, 'A senha precisa ter pelo menos 8 caracteres.'],
  [/new password should be different/i, 'A nova senha precisa ser diferente da anterior.'],
  [/weak password|password is known to be weak|should contain at least one character/i, 'Senha fraca. Use pelo menos 8 caracteres, com letra minúscula, MAIÚSCULA e número.'],
  [/already been registered|already registered/i, 'Já existe um usuário com este e-mail.'],
  [/failed to fetch|network/i, 'Sem conexão com a internet. Verifique e tente de novo.'],
  [/jwt expired|session.*(missing|expired)/i, 'Sua sessão expirou. Entre novamente.'],
];

export function mensagemDeErro(erro: unknown): string {
  const texto =
    typeof erro === 'string' ? erro : erro && typeof erro === 'object' && 'message' in erro ? String(erro.message) : '';
  for (const [padrao, traducao] of traducoes) {
    if (padrao.test(texto)) return traducao;
  }
  // As mensagens das regras do banco já estão em português
  return texto || 'Algo deu errado. Tente de novo.';
}
