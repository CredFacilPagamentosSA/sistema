-- =====================================================================
-- Atualização 9: o "Dono" do sistema (o primeiro administrador).
-- Ninguém pode remover o acesso do Dono, rebaixá-lo a atendente ou trocar
-- a senha dele pelo app. Para passar o posto, ver o final deste arquivo.
-- =====================================================================

alter table public.perfis add column dono boolean not null default false;
create unique index perfis_um_so_dono on public.perfis (dono) where dono;

-- O Dono é o primeiro administrador cadastrado
update public.perfis set dono = true
 where id = (select id from public.perfis where perfil = 'admin' order by criado_em limit 1);

-- Em instalações novas, o primeiro login vira administrador e Dono
create or replace function public.criar_perfil_novo_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_primeiro boolean := not exists (select 1 from public.perfis where perfil = 'admin');
begin
  insert into public.perfis (id, email, nome, perfil, dono)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    case when v_primeiro then 'admin'::public.perfil_usuario else 'atendente'::public.perfil_usuario end,
    v_primeiro
  );
  return new;
end $$;

create or replace function public.definir_perfil(p_usuario uuid, p_perfil public.perfil_usuario) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_admin();
  if p_perfil = 'atendente' and exists (select 1 from public.perfis where id = p_usuario and dono) then
    raise exception 'Não é possível: o Dono do sistema não pode deixar de ser administrador.';
  end if;
  if p_perfil = 'atendente'
     and (select count(*) from public.perfis where ativo and perfil = 'admin' and id <> p_usuario) = 0 then
    raise exception 'Não é possível: o sistema precisa ter pelo menos um administrador ativo.';
  end if;
  update public.perfis set perfil = p_perfil where id = p_usuario;
  if not found then
    raise exception 'Usuário não encontrado.';
  end if;
end $$;

create or replace function public.definir_ativo(p_usuario uuid, p_ativo boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_admin();
  if not p_ativo and exists (select 1 from public.perfis where id = p_usuario and dono) then
    raise exception 'Não é possível: o acesso do Dono do sistema não pode ser removido.';
  end if;
  if not p_ativo
     and (select count(*) from public.perfis where ativo and perfil = 'admin' and id <> p_usuario) = 0 then
    raise exception 'Não é possível: o sistema precisa ter pelo menos um administrador ativo.';
  end if;
  update public.perfis set ativo = p_ativo where id = p_usuario;
  if not found then
    raise exception 'Usuário não encontrado.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Para passar o posto de Dono a outro administrador (só pelo SQL Editor do
-- Supabase, por quem tem a conta do Supabase), troque o e-mail e rode:
--
--   begin;
--   update public.perfis set dono = false where dono;
--   update public.perfis set dono = true, perfil = 'admin', ativo = true
--    where email = 'novo.dono@exemplo.com';
--   commit;
-- ---------------------------------------------------------------------
