-- =====================================================================
-- Atualização 7: cancelar empréstimo lançado por engano e arquivar cliente
-- (somente administradores). Nada é apagado: o cancelamento vira um
-- lançamento no histórico e pode ser desfeito; o cliente arquivado
-- só sai das listas.
-- =====================================================================

alter type public.tipo_lancamento add value if not exists 'cancelamento';

alter table public.clientes
  add column arquivado_em timestamptz,
  add column arquivado_por uuid references public.perfis (id);

-- ---------------------------------------------------------------------
-- Cancelar: o empréstimo e todos os recebimentos dele saem do Painel e
-- dos Relatórios, mas continuam no histórico.
-- ---------------------------------------------------------------------
create function public.cancelar_emprestimo(p_emprestimo uuid, p_motivo text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  e public.emprestimos;
  v_antes jsonb;
  v_id bigint;
begin
  perform public.exigir_admin();
  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  select * into e from public.emprestimos where id = p_emprestimo for update;
  if not found then
    raise exception 'Empréstimo não encontrado.';
  end if;
  if e.estado = 'cancelado' then
    raise exception 'Este empréstimo já está cancelado.';
  end if;

  v_antes := public.foto_emprestimo(e.id);
  update public.emprestimos set estado = 'cancelado', encerrado_em = now() where id = e.id;

  insert into public.lancamentos (emprestimo_id, tipo, descricao, usuario_id, estado_anterior)
  values (e.id, 'cancelamento', 'Cancelado: ' || left(trim(p_motivo), 300), auth.uid(), v_antes)
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Desfazer: igual ao anterior, mas desfazer um cancelamento é só para administradores
-- ---------------------------------------------------------------------
create or replace function public.desfazer_ultimo(
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
  if alvo.tipo::text = 'cancelamento' and not public.eh_admin() then
    raise exception 'Acesso negado: somente administradores podem desfazer um cancelamento.';
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
-- Recebido no mês e relatórios: recebimentos de empréstimos cancelados não contam
-- ---------------------------------------------------------------------
create or replace function public.recebido_no_mes(p_dia date default null) returns bigint
language sql stable set search_path = '' as $$
  select coalesce(sum(l.valor_recebido), 0)::bigint
    from public.lancamentos l
    join public.emprestimos e on e.id = l.emprestimo_id and e.estado <> 'cancelado'
   where l.tipo in ('juros', 'parcial', 'quitacao')
     and not exists (select 1 from public.lancamentos d where d.desfaz_lancamento_id = l.id)
     and date_trunc('month', l.criado_em at time zone 'America/Sao_Paulo')
         = date_trunc('month', coalesce(p_dia, public.hoje_sp())::timestamp);
$$;

create or replace function public.relatorio(p_inicio date, p_fim date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_unidade text;
  v_resultado jsonb;
begin
  perform public.exigir_admin();
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Período inválido: a data final precisa ser igual ou depois da inicial.';
  end if;
  if p_fim - p_inicio > 3660 then
    raise exception 'Período muito longo: escolha no máximo 10 anos.';
  end if;
  v_unidade := case when p_fim - p_inicio <= 62 then 'day' else 'month' end;

  with recebimentos as (
    select date_trunc(v_unidade, l.criado_em at time zone 'America/Sao_Paulo')::date as periodo,
           l.tipo, l.valor_recebido, l.juros_recebido, l.abatimento, l.multa
      from public.lancamentos l
      join public.emprestimos e on e.id = l.emprestimo_id and e.estado <> 'cancelado'
     where l.tipo in ('juros', 'parcial', 'quitacao')
       and not exists (select 1 from public.lancamentos d where d.desfaz_lancamento_id = l.id)
       and (l.criado_em at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
  ),
  novos as (
    select date_trunc(v_unidade, e.criado_em at time zone 'America/Sao_Paulo')::date as periodo, e.valor_emprestado
      from public.emprestimos e
     where e.estado <> 'cancelado'
       and (e.criado_em at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
  ),
  periodos as (
    select generate_series(date_trunc(v_unidade, p_inicio::timestamp), p_fim::timestamp, ('1 ' || v_unidade)::interval)::date as periodo
  ),
  por_periodo_rec as (
    select periodo, sum(juros_recebido)::bigint as juros, sum(abatimento)::bigint as abatimento, sum(multa)::bigint as multa
      from recebimentos group by periodo
  ),
  por_periodo_novos as (
    select periodo, sum(valor_emprestado)::bigint as emprestado, count(*) as novos
      from novos group by periodo
  )
  select jsonb_build_object(
    'agrupamento', case v_unidade when 'day' then 'dia' else 'mes' end,
    'totais', jsonb_build_object(
      'recebido', (select coalesce(sum(valor_recebido), 0)::bigint from recebimentos),
      'juros', (select coalesce(sum(juros_recebido), 0)::bigint from recebimentos),
      'abatimento', (select coalesce(sum(abatimento), 0)::bigint from recebimentos),
      'multa', (select coalesce(sum(multa), 0)::bigint from recebimentos),
      'recebimentos', (select count(*) from recebimentos),
      'quitados', (select count(*) from recebimentos where tipo = 'quitacao'),
      'emprestado', (select coalesce(sum(valor_emprestado), 0)::bigint from novos),
      'novos', (select count(*) from novos)
    ),
    'serie', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'periodo', p.periodo,
               'juros', coalesce(r.juros, 0),
               'abatimento', coalesce(r.abatimento, 0),
               'multa', coalesce(r.multa, 0),
               'emprestado', coalesce(n.emprestado, 0),
               'novos', coalesce(n.novos, 0)
             ) order by p.periodo), '[]'::jsonb)
        from periodos p
        left join por_periodo_rec r on r.periodo = p.periodo
        left join por_periodo_novos n on n.periodo = p.periodo
    )
  ) into v_resultado;

  return v_resultado;
end $$;

-- ---------------------------------------------------------------------
-- Arquivar / reativar cliente (sai das listas; nada é apagado)
-- ---------------------------------------------------------------------
create function public.arquivar_cliente(p_cliente uuid, p_arquivar boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.clientes;
begin
  perform public.exigir_admin();
  select * into c from public.clientes where id = p_cliente for update;
  if not found then
    raise exception 'Cliente não encontrado.';
  end if;
  if p_arquivar and exists (select 1 from public.emprestimos where cliente_id = c.id and estado = 'aberto') then
    raise exception 'Este cliente tem empréstimo em aberto. Quite ou cancele antes de arquivar.';
  end if;

  insert into public.clientes_historico (cliente_id, dados_anteriores, usuario_id)
  values (c.id, to_jsonb(c) - 'id', auth.uid());

  update public.clientes
     set arquivado_em = case when p_arquivar then now() end,
         arquivado_por = case when p_arquivar then auth.uid() end,
         atualizado_em = now()
   where id = c.id;
end $$;

revoke execute on function public.cancelar_emprestimo(uuid, text), public.arquivar_cliente(uuid, boolean) from public, anon;
grant execute on function public.cancelar_emprestimo(uuid, text), public.arquivar_cliente(uuid, boolean) to authenticated;
