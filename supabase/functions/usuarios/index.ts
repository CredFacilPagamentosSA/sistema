// Função do Supabase (roda no servidor, nunca no celular).
// Só ela usa a chave secreta, para criar logins, trocar senhas e bloquear acessos.
// Antes de qualquer ação, confere se quem chamou é administrador ativo.
// Não usa e-mail: o administrador cria o acesso com uma senha provisória
// e a pessoa é obrigada a trocá-la no primeiro acesso.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cabecalhos = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: cabecalhos });
}

// Projetos com o formato novo de chaves recebem uma lista (JSON) em vez de uma chave só
function primeiraChave(nome: string): string {
  const valor = Deno.env.get(nome) ?? '';
  try {
    const lista = JSON.parse(valor);
    return String(Object.values(lista)[0] ?? '');
  } catch {
    return valor;
  }
}

// Mesma regra configurada no login: 8+ caracteres, minúscula, maiúscula e número
function senhaValida(senha: string) {
  return senha.length >= 8 && /[a-z]/.test(senha) && /[A-Z]/.test(senha) && /[0-9]/.test(senha);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhos });

  const url = Deno.env.get('SUPABASE_URL')!;
  const chavePublica = Deno.env.get('SUPABASE_ANON_KEY') || primeiraChave('SUPABASE_PUBLISHABLE_KEYS');
  const chaveSecreta = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || primeiraChave('SUPABASE_SECRET_KEYS');
  if (!url || !chavePublica || !chaveSecreta) {
    return resposta({ erro: 'A função não encontrou as chaves do projeto. Fale com o suporte técnico.' }, 500);
  }

  // Cliente com as permissões de quem chamou: as regras do banco valem para ele
  const comoUsuario = createClient(url, chavePublica, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: ehAdmin, error: erroAdmin } = await comoUsuario.rpc('eh_admin');
  if (erroAdmin || ehAdmin !== true) {
    return resposta({ erro: 'Acesso negado: somente administradores podem fazer isso.' }, 403);
  }

  const sistema = createClient(url, chaveSecreta, { auth: { persistSession: false } });
  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return resposta({ erro: 'Pedido inválido.' }, 400);
  }

  if (corpo.acao === 'criar') {
    const email = String(corpo.email ?? '').trim().toLowerCase();
    const nome = String(corpo.nome ?? '').trim();
    const senha = String(corpo.senha ?? '');
    const perfil = corpo.perfil === 'admin' ? 'admin' : 'atendente';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !nome) {
      return resposta({ erro: 'Informe nome e e-mail válidos.' }, 400);
    }
    if (!senhaValida(senha)) {
      return resposta({ erro: 'A senha provisória precisa ter 8 caracteres, com minúscula, MAIÚSCULA e número.' }, 400);
    }
    const { data, error } = await sistema.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome },
    });
    if (error) {
      const jaExiste = /already|registered|exists/i.test(error.message);
      return resposta({ erro: jaExiste ? 'Já existe um acesso com este e-mail.' : error.message }, 400);
    }
    // O banco cria o perfil como atendente; marca a troca obrigatória e promove se for administrador
    await sistema.from('perfis').update({ precisa_trocar_senha: true, nome }).eq('id', data.user.id);
    if (perfil === 'admin') {
      const { error: erroPerfil } = await comoUsuario.rpc('definir_perfil', { p_usuario: data.user.id, p_perfil: 'admin' });
      if (erroPerfil) return resposta({ erro: erroPerfil.message }, 400);
    }
    return resposta({ ok: true });
  }

  if (corpo.acao === 'redefinir_senha') {
    const usuario = String(corpo.usuario ?? '');
    const senha = String(corpo.senha ?? '');
    if (!senhaValida(senha)) {
      return resposta({ erro: 'A senha provisória precisa ter 8 caracteres, com minúscula, MAIÚSCULA e número.' }, 400);
    }
    // A senha do Dono do sistema não pode ser trocada por outro administrador
    const { data: alvo } = await sistema.from('perfis').select('dono').eq('id', usuario).maybeSingle();
    if (!alvo) return resposta({ erro: 'Usuário não encontrado.' }, 404);
    if (alvo.dono) {
      return resposta({ erro: 'Não é possível: a senha do Dono do sistema não pode ser trocada por aqui.' }, 403);
    }
    const { error } = await sistema.auth.admin.updateUserById(usuario, { password: senha });
    if (error) return resposta({ erro: error.message }, 400);
    await sistema.from('perfis').update({ precisa_trocar_senha: true }).eq('id', usuario);
    return resposta({ ok: true });
  }

  if (corpo.acao === 'definir_ativo') {
    const usuario = String(corpo.usuario ?? '');
    const ativo = corpo.ativo === true;
    // A regra "nunca ficar sem administrador" é conferida pelo banco
    const { error } = await comoUsuario.rpc('definir_ativo', { p_usuario: usuario, p_ativo: ativo });
    if (error) return resposta({ erro: error.message }, 400);
    // Bloqueia (ou libera) também o login
    const { error: erroLogin } = await sistema.auth.admin.updateUserById(usuario, {
      ban_duration: ativo ? 'none' : '876000h',
    });
    if (erroLogin) return resposta({ erro: erroLogin.message }, 400);
    return resposta({ ok: true });
  }

  return resposta({ erro: 'Ação desconhecida.' }, 400);
});
