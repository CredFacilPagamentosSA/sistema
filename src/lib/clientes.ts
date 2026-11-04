// Cadastro de clientes: tipos, validação de CPF e busca de endereço pelo CEP
export type Cliente = {
  id: string;
  nome: string;
  whatsapp: string;
  cpf: string | null;
  data_nascimento: string | null;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  observacoes: string | null;
  indicacao: string | null;
  criado_em: string;
  atualizado_em: string | null;
  arquivado_em: string | null;
};

// Campos do formulário (tudo texto, como digitado)
export type DadosCliente = {
  nome: string;
  whatsapp: string;
  cpf: string;
  data_nascimento: string;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  observacoes: string;
  indicacao: string;
};

export const clienteVazio: DadosCliente = {
  nome: '',
  whatsapp: '',
  cpf: '',
  data_nascimento: '',
  email: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  observacoes: '',
  indicacao: '',
};

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export function soNumeros(texto: string): string {
  return texto.replace(/\D/g, '');
}

// Mesma regra do banco: dígitos verificadores do CPF
export function cpfValido(texto: string): boolean {
  const cpf = soNumeros(texto);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(cpf[i]) * (ate + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

export function formatarCpf(cpf: string | null): string {
  const n = soNumeros(cpf ?? '');
  return n.length === 11 ? `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}` : cpf ?? '';
}

export function formatarCep(cep: string | null): string {
  const n = soNumeros(cep ?? '');
  return n.length === 8 ? `${n.slice(0, 5)}-${n.slice(5)}` : cep ?? '';
}

export function enderecoEmUmaLinha(c: Cliente): string {
  const partes = [
    [c.logradouro, c.numero].filter(Boolean).join(', '),
    c.complemento,
    c.bairro,
    [c.cidade, c.uf].filter(Boolean).join('/'),
    c.cep ? `CEP ${formatarCep(c.cep)}` : null,
  ].filter(Boolean);
  return partes.join(' · ');
}

export function cadastroIncompleto(c: Pick<Cliente, 'cpf' | 'cep' | 'logradouro' | 'numero' | 'cidade'>): boolean {
  return !c.cpf || !c.cep || !c.logradouro || !c.numero || !c.cidade;
}

export function dadosDoCliente(c: Cliente): DadosCliente {
  return {
    nome: c.nome,
    whatsapp: c.whatsapp.startsWith('55') ? c.whatsapp.slice(2) : c.whatsapp,
    cpf: formatarCpf(c.cpf),
    data_nascimento: c.data_nascimento ?? '',
    email: c.email ?? '',
    cep: formatarCep(c.cep),
    logradouro: c.logradouro ?? '',
    numero: c.numero ?? '',
    complemento: c.complemento ?? '',
    bairro: c.bairro ?? '',
    cidade: c.cidade ?? '',
    uf: c.uf ?? '',
    observacoes: c.observacoes ?? '',
    indicacao: c.indicacao ?? '',
  };
}

// Campos que o app exige. No cadastro simples, só nome e WhatsApp; o que for preenchido a mais ainda é conferido.
export function problemaNoCadastro(d: DadosCliente, simples: boolean): string | null {
  if (!d.nome.trim()) return 'Informe o nome do cliente.';
  const tel = soNumeros(d.whatsapp);
  if (!(tel.length === 10 || tel.length === 11 || ((tel.length === 12 || tel.length === 13) && tel.startsWith('55')))) {
    return 'WhatsApp inválido: informe DDD + número, por exemplo (11) 91234-5678.';
  }
  if (!simples && !d.cpf.trim()) return 'Informe o CPF do cliente.';
  if (d.cpf.trim() && !cpfValido(d.cpf)) return 'CPF inválido: confira os números.';
  if (d.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) return 'E-mail inválido.';
  if ((!simples || d.cep.trim()) && soNumeros(d.cep).length !== 8) return 'Informe o CEP (8 números).';
  if (simples) return null;
  if (!d.logradouro.trim()) return 'Informe a rua / avenida do endereço.';
  if (!d.numero.trim()) return 'Informe o número do endereço (ou "s/n").';
  if (!d.bairro.trim()) return 'Informe o bairro.';
  if (!d.cidade.trim()) return 'Informe a cidade.';
  if (!d.uf) return 'Informe o estado (UF).';
  return null;
}

// Busca o endereço pelo CEP no ViaCEP (serviço público e gratuito; só o CEP é enviado)
export async function buscarCep(cep: string): Promise<Partial<DadosCliente> | null> {
  const n = soNumeros(cep);
  if (n.length !== 8) return null;
  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${n}/json/`);
    if (!resposta.ok) return null;
    const d = await resposta.json();
    if (d.erro) return null;
    return { logradouro: d.logradouro ?? '', bairro: d.bairro ?? '', cidade: d.localidade ?? '', uf: d.uf ?? '' };
  } catch {
    return null;
  }
}
