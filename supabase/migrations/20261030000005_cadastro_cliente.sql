-- =====================================================================
-- Atualização 5: cadastro completo do cliente (CPF, nascimento, e-mail,
-- endereço e observações) com histórico de cada alteração.
-- Os campos novos são opcionais no banco (clientes antigos não têm);
-- o app exige CPF e endereço nos cadastros novos.
-- =====================================================================

-- Confere os dígitos verificadores do CPF (só números)
create function public.cpf_valido(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  soma integer;
  d1 integer;
  d2 integer;
  i integer;
begin
  if p is null or p !~ '^[0-9]{11}$' or p ~ '^(.)\1{10}$' then
    return false;
  end if;
  soma := 0;
  for i in 1..9 loop
    soma := soma + substr(p, i, 1)::integer * (11 - i);
  end loop;
  d1 := (soma * 10) % 11;
  if d1 = 10 then d1 := 0; end if;
  soma := 0;
  for i in 1..10 loop
    soma := soma + substr(p, i, 1)::integer * (12 - i);
  end loop;
  d2 := (soma * 10) % 11;
  if d2 = 10 then d2 := 0; end if;
  return d1 = substr(p, 10, 1)::integer and d2 = substr(p, 11, 1)::integer;
end $$;

alter table public.clientes
  add column cpf text check (cpf is null or public.cpf_valido(cpf)),
  add column data_nascimento date,
  add column email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column cep text check (cep is null or cep ~ '^[0-9]{8}$'),
  add column logradouro text check (length(logradouro) <= 200),
  add column numero text check (length(numero) <= 20),
  add column complemento text check (length(complemento) <= 100),
  add column bairro text check (length(bairro) <= 100),
  add column cidade text check (length(cidade) <= 100),
  add column uf text check (uf is null or uf ~ '^[A-Z]{2}$'),
  add column observacoes text check (length(observacoes) <= 1000),
  add column atualizado_em timestamptz;

create unique index clientes_cpf_unico on public.clientes (cpf) where cpf is not null;

-- Histórico do cadastro: a foto dos dados antes de cada alteração. Nunca é alterado nem apagado.
create table public.clientes_historico (
  id bigint generated always as identity primary key,
  cliente_id uuid not null references public.clientes (id),
  dados_anteriores jsonb not null,
  usuario_id uuid references public.perfis (id),
  criado_em timestamptz not null default now()
);
create index clientes_historico_cliente on public.clientes_historico (cliente_id, id);

create trigger sem_exclusao before delete on public.clientes_historico for each row execute function public.bloquear_exclusao();
create trigger sem_limpeza before truncate on public.clientes_historico for each statement execute function public.bloquear_exclusao();
create trigger sem_alteracao before update on public.clientes_historico for each row execute function public.bloquear_alteracao();

alter table public.clientes_historico enable row level security;
create policy leitura on public.clientes_historico for select to authenticated using (public.usuario_ativo());
revoke all on public.clientes_historico from anon;
revoke insert, update, delete, truncate, references, trigger on public.clientes_historico from authenticated;

-- Texto opcional: vazio vira nulo; recusa se passar do tamanho
create function public.texto_opcional(p_dados jsonb, p_chave text, p_maximo integer, p_rotulo text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := nullif(trim(coalesce(p_dados ->> p_chave, '')), '');
begin
  if length(v) > p_maximo then
    raise exception '% muito longo (máximo de % letras).', p_rotulo, p_maximo;
  end if;
  return v;
end $$;

-- ---------------------------------------------------------------------
-- Cadastrar (p_cliente nulo) ou atualizar um cliente.
-- Na atualização, guarda os dados anteriores no histórico.
-- ---------------------------------------------------------------------
create function public.salvar_cliente(p_cliente uuid, p_dados jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c public.clientes;
  v_nome text := trim(coalesce(p_dados ->> 'nome', ''));
  v_whatsapp text;
  v_cpf text := nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '[^0-9]', '', 'g'), '');
  v_email text := nullif(lower(trim(coalesce(p_dados ->> 'email', ''))), '');
  v_cep text := nullif(regexp_replace(coalesce(p_dados ->> 'cep', ''), '[^0-9]', '', 'g'), '');
  v_uf text := nullif(upper(trim(coalesce(p_dados ->> 'uf', ''))), '');
  v_nascimento date;
  v_outro text;
  v_id uuid;
begin
  perform public.exigir_usuario_ativo();

  if length(v_nome) not between 1 and 120 then
    raise exception 'Informe o nome do cliente.';
  end if;
  v_whatsapp := public.normalizar_whatsapp(p_dados ->> 'whatsapp');
  if v_cpf is not null then
    if not public.cpf_valido(v_cpf) then
      raise exception 'CPF inválido: confira os números.';
    end if;
    select nome into v_outro from public.clientes where cpf = v_cpf and id is distinct from p_cliente;
    if found then
      raise exception 'Já existe um cliente com este CPF: %.', v_outro;
    end if;
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido.';
  end if;
  if v_cep is not null and v_cep !~ '^[0-9]{8}$' then
    raise exception 'CEP inválido: são 8 números.';
  end if;
  if v_uf is not null and v_uf !~ '^[A-Z]{2}$' then
    raise exception 'Estado (UF) inválido: use 2 letras, por exemplo SP.';
  end if;
  begin
    v_nascimento := nullif(trim(coalesce(p_dados ->> 'data_nascimento', '')), '')::date;
  exception when others then
    raise exception 'Data de nascimento inválida.';
  end;
  if v_nascimento is not null and (v_nascimento < date '1900-01-01' or v_nascimento > public.hoje_sp()) then
    raise exception 'Data de nascimento inválida.';
  end if;
  if v_nascimento is not null and v_nascimento > (public.hoje_sp() - interval '18 years')::date then
    raise exception 'O cliente precisa ter 18 anos ou mais.';
  end if;

  if p_cliente is null then
    insert into public.clientes
      (nome, whatsapp, cpf, data_nascimento, email, cep, logradouro, numero, complemento, bairro, cidade, uf, observacoes, criado_por)
    values
      (v_nome, v_whatsapp, v_cpf, v_nascimento, v_email, v_cep,
       public.texto_opcional(p_dados, 'logradouro', 200, 'Endereço'),
       public.texto_opcional(p_dados, 'numero', 20, 'Número'),
       public.texto_opcional(p_dados, 'complemento', 100, 'Complemento'),
       public.texto_opcional(p_dados, 'bairro', 100, 'Bairro'),
       public.texto_opcional(p_dados, 'cidade', 100, 'Cidade'),
       v_uf,
       public.texto_opcional(p_dados, 'observacoes', 1000, 'Observações'),
       auth.uid())
    returning id into v_id;
    return v_id;
  end if;

  select * into c from public.clientes where id = p_cliente for update;
  if not found then
    raise exception 'Cliente não encontrado.';
  end if;

  insert into public.clientes_historico (cliente_id, dados_anteriores, usuario_id)
  values (c.id, to_jsonb(c) - 'id', auth.uid());

  update public.clientes set
    nome = v_nome,
    whatsapp = v_whatsapp,
    cpf = v_cpf,
    data_nascimento = v_nascimento,
    email = v_email,
    cep = v_cep,
    logradouro = public.texto_opcional(p_dados, 'logradouro', 200, 'Endereço'),
    numero = public.texto_opcional(p_dados, 'numero', 20, 'Número'),
    complemento = public.texto_opcional(p_dados, 'complemento', 100, 'Complemento'),
    bairro = public.texto_opcional(p_dados, 'bairro', 100, 'Bairro'),
    cidade = public.texto_opcional(p_dados, 'cidade', 100, 'Cidade'),
    uf = v_uf,
    observacoes = public.texto_opcional(p_dados, 'observacoes', 1000, 'Observações'),
    atualizado_em = now()
  where id = c.id;

  return c.id;
end $$;

-- Histórico do cadastro com o nome de quem alterou
create view public.v_clientes_historico with (security_invoker = true) as
select h.*, p.nome as usuario_nome, p.email as usuario_email
from public.clientes_historico h
left join public.perfis p on p.id = h.usuario_id;

revoke all on public.v_clientes_historico from anon;
grant select on public.v_clientes_historico to authenticated;

revoke execute on function public.cpf_valido(text), public.texto_opcional(jsonb, text, integer, text) from public, anon, authenticated;
revoke execute on function public.salvar_cliente(uuid, jsonb) from public, anon;
grant execute on function public.salvar_cliente(uuid, jsonb) to authenticated;
