-- =====================================================================
-- Atualização 3: cada usuário define o próprio nome; mensagem de
-- bloqueio sem o nome da empresa (o nome pode mudar).
-- =====================================================================

create or replace function public.bloquear_exclusao() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Operação não permitida: os registros nunca são apagados.';
end $$;

create function public.definir_meu_nome(p_nome text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_usuario_ativo();
  if length(trim(coalesce(p_nome, ''))) not between 1 and 80 then
    raise exception 'Informe seu nome (até 80 letras).';
  end if;
  update public.perfis set nome = trim(p_nome) where id = auth.uid();
end $$;

revoke execute on function public.definir_meu_nome(text) from public, anon;
grant execute on function public.definir_meu_nome(text) to authenticated;
