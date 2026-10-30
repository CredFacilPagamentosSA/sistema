-- =====================================================================
-- Atualização 4: relatórios por período (somente administradores)
-- Recebimentos desfeitos não contam. Empréstimos cancelados não contam.
-- Períodos de até 62 dias são agrupados por dia; maiores, por mês.
-- =====================================================================

create function public.relatorio(p_inicio date, p_fim date) returns jsonb
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

revoke execute on function public.relatorio(date, date) from public, anon;
grant execute on function public.relatorio(date, date) to authenticated;
