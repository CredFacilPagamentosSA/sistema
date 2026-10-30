-- =====================================================================
-- CredFacil - Regras do negócio (ciclos, recebimentos, desfazer)
-- Toda gravação acontece aqui, numa única operação: ou grava tudo, ou nada.
-- =====================================================================

create function public.exigir_usuario_ativo() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.usuario_ativo() then
    raise exception 'Acesso negado: faça login com um usuário ativo.';
  end if;
end $$;

create function public.exigir_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.eh_admin() then
    raise exception 'Acesso negado: somente administradores podem fazer isso.';
  end if;
end $$;

-- Deixa só os números e garante o código do Brasil (55) na frente
create function public.normalizar_whatsapp(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
begin
  if length(v) in (10, 11) then
    v := '55' || v;
  end if;
  if v !~ '^55[0-9]{10,11}$' then
    raise exception 'WhatsApp inválido: informe DDD + número, por exemplo (11) 91234-5678.';
  end if;
  return v;
end $$;

-- Foto do empréstimo num momento (guardada em cada lançamento para o desfazer)
create function public.foto_emprestimo(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'valor_divida', e.valor_divida,
    'juros_ciclo', e.juros_ciclo,
    'vencimento', e.vencimento,
    'renovacoes', e.renovacoes,
    'renovacoes_so_juros_seguidas', e.renovacoes_so_juros_seguidas,
    'estado', e.estado,
    'encerrado_em', e.encerrado_em,
    'cliente_nome', c.nome,
    'cliente_whatsapp', c.whatsapp
  )
  from public.emprestimos e
  join public.clientes c on c.id = e.cliente_id
  where e.id = p_id;
$$;

-- ---------------------------------------------------------------------
-- Novo empréstimo
-- ---------------------------------------------------------------------
create function public.criar_emprestimo(
  p_nome text,
  p_whatsapp text,
  p_valor bigint,
  p_juros bigint,
  p_vencimento date,
  p_cliente_id uuid default null,
  p_descricao text default ''
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_cliente uuid;
  v_emprestimo uuid;
begin
  perform public.exigir_usuario_ativo();
  if p_valor is null or p_valor <= 0 then
    raise exception 'Informe um valor emprestado maior que zero.';
  end if;
  if p_juros is null or p_juros < 0 then
    raise exception 'Informe o valor dos juros (pode ser zero, mas não negativo).';
  end if;
  if p_vencimento is null then
    raise exception 'Informe a data do primeiro vencimento.';
  end if;

  if p_cliente_id is not null then
    select id into v_cliente from public.clientes where id = p_cliente_id;
    if not found then
      raise exception 'Cliente não encontrado.';
    end if;
  else
    if length(trim(coalesce(p_nome, ''))) = 0 then
      raise exception 'Informe o nome do cliente.';
    end if;
    insert into public.clientes (nome, whatsapp, criado_por)
    values (trim(p_nome), public.normalizar_whatsapp(p_whatsapp), auth.uid())
    returning id into v_cliente;
  end if;

  insert into public.emprestimos (cliente_id, valor_emprestado, valor_divida, juros_ciclo, vencimento, criado_por)
  values (v_cliente, p_valor, p_valor, p_juros, p_vencimento, auth.uid())
  returning id into v_emprestimo;

  insert into public.lancamentos (emprestimo_id, tipo, descricao, usuario_id)
  values (v_emprestimo, 'criacao', coalesce(nullif(trim(p_descricao), ''), 'Empréstimo criado'), auth.uid());

  return v_emprestimo;
end $$;

-- ---------------------------------------------------------------------
-- Recebimento no vencimento: 'quitacao', 'juros' ou 'parcial'
--   quitacao: recebe dívida + juros (+ multa) e encerra
--   juros:    recebe juros (+ multa), dívida igual, abre novo ciclo
--   parcial:  recebe juros + abatimento (+ multa), dívida menor, novo ciclo
-- p_juros_recebido: em branco = juros do ciclo atual
-- ---------------------------------------------------------------------
create function public.registrar_recebimento(
  p_emprestimo uuid,
  p_tipo public.tipo_lancamento,
  p_novo_vencimento date default null,
  p_novos_juros bigint default null,
  p_abatimento bigint default 0,
  p_multa bigint default 0,
  p_juros_recebido bigint default null,
  p_descricao text default ''
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  e public.emprestimos;
  v_antes jsonb;
  v_juros bigint;
  v_multa bigint := coalesce(p_multa, 0);
  v_abatimento bigint := 0;
  v_descricao text;
  v_id bigint;
begin
  perform public.exigir_usuario_ativo();
  if p_tipo is null or p_tipo not in ('quitacao', 'juros', 'parcial') then
    raise exception 'Tipo de recebimento inválido.';
  end if;

  select * into e from public.emprestimos where id = p_emprestimo for update;
  if not found then
    raise exception 'Empréstimo não encontrado.';
  end if;
  if e.estado <> 'aberto' then
    raise exception 'Este empréstimo não está aberto.';
  end if;

  v_juros := coalesce(p_juros_recebido, e.juros_ciclo);
  if v_juros < 0 then
    raise exception 'O valor de juros recebido não pode ser negativo.';
  end if;
  if v_multa < 0 then
    raise exception 'A multa não pode ser negativa.';
  end if;

  if p_tipo in ('juros', 'parcial') then
    if p_novo_vencimento is null then
      raise exception 'Informe o novo vencimento.';
    end if;
    if p_novo_vencimento <= e.vencimento then
      raise exception 'O novo vencimento precisa ser depois do vencimento atual (%).', to_char(e.vencimento, 'DD/MM/YYYY');
    end if;
    if p_novos_juros is null or p_novos_juros < 0 then
      raise exception 'Informe os juros do novo ciclo.';
    end if;
  end if;

  v_antes := public.foto_emprestimo(e.id);

  if p_tipo = 'quitacao' then
    v_abatimento := e.valor_divida;
    update public.emprestimos
       set valor_divida = 0, estado = 'quitado', encerrado_em = now()
     where id = e.id;
    v_descricao := 'Quitação';
  elsif p_tipo = 'juros' then
    update public.emprestimos
       set juros_ciclo = p_novos_juros,
           vencimento = p_novo_vencimento,
           renovacoes = renovacoes + 1,
           renovacoes_so_juros_seguidas = renovacoes_so_juros_seguidas + 1
     where id = e.id;
    v_descricao := 'Juros recebidos e renovado';
  else
    v_abatimento := coalesce(p_abatimento, 0);
    if v_abatimento <= 0 then
      raise exception 'Informe o valor a abater da dívida.';
    end if;
    if v_abatimento >= e.valor_divida then
      raise exception 'O abatimento é igual ou maior que a dívida. Use "Quitar tudo".';
    end if;
    update public.emprestimos
       set valor_divida = valor_divida - v_abatimento,
           juros_ciclo = p_novos_juros,
           vencimento = p_novo_vencimento,
           renovacoes = renovacoes + 1,
           renovacoes_so_juros_seguidas = 0
     where id = e.id;
    v_descricao := 'Pagamento parcial e renovado';
  end if;

  insert into public.lancamentos
    (emprestimo_id, tipo, valor_recebido, juros_recebido, abatimento, multa, descricao, usuario_id, estado_anterior)
  values
    (e.id, p_tipo, v_juros + v_abatimento + v_multa, v_juros, v_abatimento, v_multa,
     coalesce(nullif(trim(p_descricao), ''), v_descricao), auth.uid(), v_antes)
  returning id into v_id;

  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Editar: dados do cliente (qualquer empréstimo) e, se aberto,
-- vencimento e juros do ciclo atual. Campo em branco = não muda.
-- ---------------------------------------------------------------------
create function public.editar_emprestimo(
  p_emprestimo uuid,
  p_nome text default null,
  p_whatsapp text default null,
  p_vencimento date default null,
  p_juros_ciclo bigint default null,
  p_descricao text default ''
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  e public.emprestimos;
  c public.clientes;
  v_antes jsonb;
  v_nome text;
  v_whatsapp text;
  v_vencimento date;
  v_juros bigint;
  v_id bigint;
begin
  perform public.exigir_usuario_ativo();

  select * into e from public.emprestimos where id = p_emprestimo for update;
  if not found then
    raise exception 'Empréstimo não encontrado.';
  end if;
  select * into c from public.clientes where id = e.cliente_id for update;

  v_nome := coalesce(nullif(trim(p_nome), ''), c.nome);
  v_whatsapp := case when nullif(trim(p_whatsapp), '') is null then c.whatsapp
                     else public.normalizar_whatsapp(p_whatsapp) end;
  v_vencimento := coalesce(p_vencimento, e.vencimento);
  v_juros := coalesce(p_juros_ciclo, e.juros_ciclo);

  if v_juros < 0 then
    raise exception 'Os juros não podem ser negativos.';
  end if;
  if e.estado <> 'aberto' and (v_vencimento <> e.vencimento or v_juros <> e.juros_ciclo) then
    raise exception 'Vencimento e juros só podem ser editados em empréstimos abertos.';
  end if;
  if v_nome = c.nome and v_whatsapp = c.whatsapp and v_vencimento = e.vencimento and v_juros = e.juros_ciclo then
    raise exception 'Nada foi alterado.';
  end if;

  v_antes := public.foto_emprestimo(e.id);

  update public.clientes set nome = v_nome, whatsapp = v_whatsapp where id = c.id;
  update public.emprestimos set vencimento = v_vencimento, juros_ciclo = v_juros where id = e.id;

  insert into public.lancamentos (emprestimo_id, tipo, descricao, usuario_id, estado_anterior)
  values (e.id, 'edicao', coalesce(nullif(trim(p_descricao), ''), 'Dados editados'), auth.uid(), v_antes)
  returning id into v_id;

  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Desfazer o último lançamento ainda válido do empréstimo.
-- Restaura a foto anterior e grava um NOVO lançamento 'desfazer'.
-- Pode ser repetido: cada vez desfaz o anterior (como uma pilha).
-- ---------------------------------------------------------------------
create function public.desfazer_ultimo(
  p_emprestimo uuid,
  p_motivo text default ''
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  e public.emprestimos;
  alvo public.lancamentos;
  v_antes jsonb;
  f jsonb;
  v_id bigint;
begin
  perform public.exigir_usuario_ativo();

  select * into e from public.emprestimos where id = p_emprestimo for update;
  if not found then
    raise exception 'Empréstimo não encontrado.';
  end if;

  select l.* into alvo
    from public.lancamentos l
   where l.emprestimo_id = e.id
     and l.tipo <> 'desfazer'
     and not exists (select 1 from public.lancamentos d where d.desfaz_lancamento_id = l.id)
   order by l.id desc
   limit 1;
  if not found then
    raise exception 'Não há lançamento para desfazer.';
  end if;

  v_antes := public.foto_emprestimo(e.id);

  if alvo.tipo = 'criacao' then
    update public.emprestimos set estado = 'cancelado', encerrado_em = now() where id = e.id;
  else
    f := alvo.estado_anterior;
    update public.emprestimos
       set valor_divida = (f ->> 'valor_divida')::bigint,
           juros_ciclo = (f ->> 'juros_ciclo')::bigint,
           vencimento = (f ->> 'vencimento')::date,
           renovacoes = (f ->> 'renovacoes')::integer,
           renovacoes_so_juros_seguidas = (f ->> 'renovacoes_so_juros_seguidas')::integer,
           estado = (f ->> 'estado')::public.estado_emprestimo,
           encerrado_em = (f ->> 'encerrado_em')::timestamptz
     where id = e.id;
    if alvo.tipo = 'edicao' then
      update public.clientes
         set nome = f ->> 'cliente_nome', whatsapp = f ->> 'cliente_whatsapp'
       where id = e.cliente_id;
    end if;
  end if;

  insert into public.lancamentos (emprestimo_id, tipo, descricao, usuario_id, estado_anterior, desfaz_lancamento_id)
  values (
    e.id, 'desfazer',
    'Desfeito: ' || alvo.descricao || coalesce(' - ' || nullif(trim(p_motivo), ''), ''),
    auth.uid(), v_antes, alvo.id
  )
  returning id into v_id;

  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Recebido no mês: soma dos recebimentos não desfeitos, no mês (horário de Brasília)
-- ---------------------------------------------------------------------
create function public.recebido_no_mes(p_dia date default null) returns bigint
language sql stable set search_path = '' as $$
  select coalesce(sum(l.valor_recebido), 0)::bigint
    from public.lancamentos l
   where l.tipo in ('juros', 'parcial', 'quitacao')
     and not exists (select 1 from public.lancamentos d where d.desfaz_lancamento_id = l.id)
     and date_trunc('month', l.criado_em at time zone 'America/Sao_Paulo')
         = date_trunc('month', coalesce(p_dia, public.hoje_sp())::timestamp);
$$;

-- Números do Painel
create function public.painel() returns jsonb
language sql stable set search_path = '' as $$
  with abertos as (
    select * from public.v_emprestimos where estado = 'aberto'
  )
  select jsonb_build_object(
    'dinheiro_na_rua', (select coalesce(sum(valor_divida), 0)::bigint from abertos),
    'juros_ciclos_atuais', (select coalesce(sum(juros_ciclo), 0)::bigint from abertos),
    'vencem_hoje', (select count(*) from abertos where situacao = 'vence_hoje'),
    'atrasados_qtd', (select count(*) from abertos where situacao = 'atrasado'),
    'atrasados_total', (select coalesce(sum(total_para_quitar), 0)::bigint from abertos where situacao = 'atrasado'),
    'recebido_mes', public.recebido_no_mes()
  );
$$;

-- Histórico com o nome de quem fez e se foi desfeito
create view public.v_lancamentos with (security_invoker = true) as
select
  l.*,
  p.nome as usuario_nome,
  p.email as usuario_email,
  exists (select 1 from public.lancamentos d where d.desfaz_lancamento_id = l.id) as desfeito
from public.lancamentos l
left join public.perfis p on p.id = l.usuario_id;

revoke all on public.v_lancamentos from anon;
grant select on public.v_lancamentos to authenticated;

-- ---------------------------------------------------------------------
-- Usuários (somente administradores). Nunca deixa o sistema sem administrador.
-- ---------------------------------------------------------------------
create function public.definir_perfil(p_usuario uuid, p_perfil public.perfil_usuario) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_admin();
  if p_perfil = 'atendente'
     and (select count(*) from public.perfis where ativo and perfil = 'admin' and id <> p_usuario) = 0 then
    raise exception 'Não é possível: o sistema precisa ter pelo menos um administrador ativo.';
  end if;
  update public.perfis set perfil = p_perfil where id = p_usuario;
  if not found then
    raise exception 'Usuário não encontrado.';
  end if;
end $$;

create function public.definir_ativo(p_usuario uuid, p_ativo boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_admin();
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
-- Permissões das funções: nada para visitantes; só o necessário para logados
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.hoje_sp(),
  public.usuario_ativo(),
  public.eh_admin(),
  public.criar_emprestimo(text, text, bigint, bigint, date, uuid, text),
  public.registrar_recebimento(uuid, public.tipo_lancamento, date, bigint, bigint, bigint, bigint, text),
  public.editar_emprestimo(uuid, text, text, date, bigint, text),
  public.desfazer_ultimo(uuid, text),
  public.recebido_no_mes(date),
  public.painel(),
  public.definir_perfil(uuid, public.perfil_usuario),
  public.definir_ativo(uuid, boolean)
to authenticated;
