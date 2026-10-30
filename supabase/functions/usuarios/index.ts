// Função do Supabase (roda no servidor, nunca no celular).
// Só ela usa a chave secreta, para convidar e bloquear logins.
// Antes de qualquer ação, confere se quem chamou é administrador ativo.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cabecalhos = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: cabecalhos });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhos });

  const url = Deno.env.get('SUPABASE_URL')!;
  const chavePublica = Deno.env.get('SUPABASE_ANON_KEY')!;
  const chaveSecreta = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const site = Deno.env.get('SITE_URL') ?? '';

  // Cliente com as permissões de quem chamou: as regras do banco valem para ele
  const comoUsuario = createClient(url, chavePublica, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
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

  if (corpo.acao === 'convidar') {
    const email = String(corpo.email ?? '').trim().toLowerCase();
    const nome = String(corpo.nome ?? '').trim();
    const perfil = corpo.perfil === 'admin' ? 'admin' : 'atendente';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !nome) {
      return resposta({ erro: 'Informe nome e e-mail válidos.' }, 400);
    }
    const { data, error } = await sistema.auth.admin.inviteUserByEmail(email, {
      data: { nome },
      redirectTo: `${site}/definir-senha`,
    });
    if (error) return resposta({ erro: error.message }, 400);
    // O banco cria o perfil como atendente; promove se for administrador
    if (perfil === 'admin') {
      const { error: erroPerfil } = await comoUsuario.rpc('definir_perfil', { p_usuario: data.user.id, p_perfil: 'admin' });
      if (erroPerfil) return resposta({ erro: erroPerfil.message }, 400);
    }
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
