-- =====================================================================
-- Atualização 8: acessos criados pelo administrador com senha provisória.
-- Quem entra com senha provisória é obrigado a trocar no primeiro acesso.
-- =====================================================================

alter table public.perfis add column precisa_trocar_senha boolean not null default false;

-- Chamada pelo app logo depois de a pessoa definir a própria senha
create function public.marcar_senha_trocada() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_usuario_ativo();
  update public.perfis set precisa_trocar_senha = false where id = auth.uid();
end $$;

revoke execute on function public.marcar_senha_trocada() from public, anon;
grant execute on function public.marcar_senha_trocada() to authenticated;
