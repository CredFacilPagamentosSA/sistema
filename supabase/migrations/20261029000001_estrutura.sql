-- =====================================================================
-- CredFacil - Estrutura do banco e regras de segurança
-- Valores em dinheiro: sempre em CENTAVOS (números inteiros).
-- Datas de vencimento: dia no fuso America/Sao_Paulo.
-- Nada é apagado: só se acrescentam registros.
-- =====================================================================

create type public.perfil_usuario as enum ('admin', 'atendente');
create type public.tipo_lancamento as enum ('criacao', 'juros', 'parcial', 'quitacao', 'edicao', 'desfazer');
create type public.estado_emprestimo as enum ('aberto', 'quitado', 'cancelado');

-- Quem usa o sistema (um registro para cada login)
create table public.perfis (
  id uuid primary key references auth.users (id),
  nome text not null default '',
  email text not null default '',
  perfil public.perfil_usuario not null default 'atendente',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Clientes: só o necessário (LGPD): nome e WhatsApp
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 120),
  whatsapp text not null check (whatsapp ~ '^55[0-9]{10,11}$'),
  criado_em timestamptz not null default now(),
  criado_por uuid references public.perfis (id)
);

create table public.emprestimos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id),
  valor_emprestado bigint not null check (valor_emprestado > 0),
  valor_divida bigint not null check (valor_divida >= 0),
  juros_ciclo bigint not null check (juros_ciclo >= 0),
  vencimento date not null,
  renovacoes integer not null default 0 check (renovacoes >= 0),
  renovacoes_so_juros_seguidas integer not null default 0 check (renovacoes_so_juros_seguidas >= 0),
  estado public.estado_emprestimo not null default 'aberto',
  criado_em timestamptz not null default now(),
  criado_por uuid references public.perfis (id),
  encerrado_em timestamptz
);
create index emprestimos_estado_vencimento on public.emprestimos (estado, vencimento);
create index emprestimos_cliente on public.emprestimos (cliente_id);

-- Histórico: cada movimento de um empréstimo. Nunca é alterado nem apagado.
create table public.lancamentos (
  id bigint generated always as identity primary key,
  emprestimo_id uuid not null references public.emprestimos (id),
  tipo public.tipo_lancamento not null,
  valor_recebido bigint not null default 0 check (valor_recebido >= 0),
  juros_recebido bigint not null default 0 check (juros_recebido >= 0),
  abatimento bigint not null default 0 check (abatimento >= 0),
  multa bigint not null default 0 check (multa >= 0),
  descricao text not null default '',
  usuario_id uuid references public.perfis (id),
  criado_em timestamptz not null default now(),
  -- foto do empréstimo antes deste lançamento, usada pelo "desfazer"
  estado_anterior jsonb,
  -- preenchido só nos lançamentos do tipo 'desfazer'
  desfaz_lancamento_id bigint unique references public.lancamentos (id),
  check (valor_recebido = juros_recebido + abatimento + multa),
  check ((tipo = 'desfazer') = (desfaz_lancamento_id is not null))
);
create index lancamentos_emprestimo on public.lancamentos (emprestimo_id, id);
create index lancamentos_criado_em on public.lancamentos (criado_em);

-- Registro de cada backup (automático ou exportação manual)
create table public.backups (
  id bigint generated always as identity primary key,
  feito_em timestamptz not null default now(),
  origem text not null check (origem in ('automatico', 'exportacao')),
  sucesso boolean not null,
  detalhe text not null default '',
  usuario_id uuid references public.perfis (id)
);

-- ---------------------------------------------------------------------
-- Proteção: ninguém apaga nada (nem administrador, nem o próprio sistema)
-- ---------------------------------------------------------------------
create function public.bloquear_exclusao() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Operação não permitida: os registros da CredFacil nunca são apagados.';
end $$;

create function public.bloquear_alteracao() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Operação não permitida: o histórico não pode ser alterado.';
end $$;

create trigger sem_exclusao before delete on public.perfis for each row execute function public.bloquear_exclusao();
create trigger sem_exclusao before delete on public.clientes for each row execute function public.bloquear_exclusao();
create trigger sem_exclusao before delete on public.emprestimos for each row execute function public.bloquear_exclusao();
create trigger sem_exclusao before delete on public.lancamentos for each row execute function public.bloquear_exclusao();
create trigger sem_exclusao before delete on public.backups for each row execute function public.bloquear_exclusao();
create trigger sem_limpeza before truncate on public.perfis for each statement execute function public.bloquear_exclusao();
create trigger sem_limpeza before truncate on public.clientes for each statement execute function public.bloquear_exclusao();
create trigger sem_limpeza before truncate on public.emprestimos for each statement execute function public.bloquear_exclusao();
create trigger sem_limpeza before truncate on public.lancamentos for each statement execute function public.bloquear_exclusao();
create trigger sem_limpeza before truncate on public.backups for each statement execute function public.bloquear_exclusao();
create trigger sem_alteracao before update on public.lancamentos for each row execute function public.bloquear_alteracao();
create trigger sem_alteracao before update on public.backups for each row execute function public.bloquear_alteracao();

-- ---------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------
create function public.hoje_sp() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

create function public.usuario_ativo() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfis where id = auth.uid() and ativo);
$$;

create function public.eh_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfis where id = auth.uid() and ativo and perfil = 'admin');
$$;

-- Todo novo login ganha um perfil. O primeiro vira administrador; os demais, atendentes.
create function public.criar_perfil_novo_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfis (id, email, nome, perfil)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    case when exists (select 1 from public.perfis where perfil = 'admin')
         then 'atendente'::public.perfil_usuario
         else 'admin'::public.perfil_usuario end
  );
  return new;
end $$;

create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- ---------------------------------------------------------------------
-- Regras de acesso (RLS): só usuários logados e ativos leem os dados.
-- Ninguém grava direto nas tabelas: toda gravação passa pelas funções
-- do arquivo de regras, que conferem permissões e fazem as contas.
-- ---------------------------------------------------------------------
alter table public.perfis enable row level security;
alter table public.clientes enable row level security;
alter table public.emprestimos enable row level security;
alter table public.lancamentos enable row level security;
alter table public.backups enable row level security;

create policy leitura on public.perfis for select to authenticated using (public.usuario_ativo());
create policy leitura on public.clientes for select to authenticated using (public.usuario_ativo());
create policy leitura on public.emprestimos for select to authenticated using (public.usuario_ativo());
create policy leitura on public.lancamentos for select to authenticated using (public.usuario_ativo());
create policy leitura on public.backups for select to authenticated using (public.eh_admin());

revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Visão dos empréstimos com a situação calculada automaticamente
create view public.v_emprestimos with (security_invoker = true) as
select
  e.*,
  c.nome as cliente_nome,
  c.whatsapp as cliente_whatsapp,
  e.valor_divida + e.juros_ciclo as total_para_quitar,
  (e.vencimento - public.hoje_sp()) as dias_para_vencer,
  case
    when e.estado = 'quitado' then 'quitado'
    when e.estado = 'cancelado' then 'cancelado'
    when e.vencimento < public.hoje_sp() then 'atrasado'
    when e.vencimento = public.hoje_sp() then 'vence_hoje'
    when e.vencimento <= public.hoje_sp() + 3 then 'vence_em_breve'
    else 'em_dia'
  end as situacao,
  (e.estado = 'aberto' and e.renovacoes_so_juros_seguidas >= 3) as alerta_risco
from public.emprestimos e
join public.clientes c on c.id = e.cliente_id;

revoke all on public.v_emprestimos from anon;
grant select on public.v_emprestimos to authenticated;
