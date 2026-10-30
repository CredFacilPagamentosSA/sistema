-- =====================================================================
-- Atualização 6: exportação completa dos dados (somente administradores)
-- e registro de cada exportação na tabela de backups.
-- =====================================================================

create function public.exportar_dados() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exigir_admin();
  return jsonb_build_object(
    'gerado_em', now(),
    'clientes', (select coalesce(jsonb_agg(to_jsonb(c) order by c.nome), '[]'::jsonb) from public.clientes c),
    'emprestimos', (select coalesce(jsonb_agg(to_jsonb(e) order by e.criado_em), '[]'::jsonb) from public.v_emprestimos e),
    'lancamentos', (
      select coalesce(jsonb_agg(to_jsonb(l) - 'estado_anterior' || jsonb_build_object('cliente_nome', c.nome) order by l.id), '[]'::jsonb)
        from public.v_lancamentos l
        join public.emprestimos e on e.id = l.emprestimo_id
        join public.clientes c on c.id = e.cliente_id
    ),
    'clientes_historico', (
      select coalesce(jsonb_agg(to_jsonb(h) order by h.id), '[]'::jsonb) from public.v_clientes_historico h
    ),
    'usuarios', (
      select coalesce(jsonb_agg(jsonb_build_object('nome', p.nome, 'email', p.email, 'perfil', p.perfil, 'ativo', p.ativo, 'criado_em', p.criado_em) order by p.nome), '[]'::jsonb)
        from public.perfis p
    )
  );
end $$;

create function public.registrar_exportacao(p_formato text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_admin();
  insert into public.backups (origem, sucesso, detalhe, usuario_id)
  values ('exportacao', true, 'Exportação ' || left(coalesce(p_formato, ''), 20), auth.uid());
end $$;

revoke execute on function public.exportar_dados(), public.registrar_exportacao(text) from public, anon;
grant execute on function public.exportar_dados(), public.registrar_exportacao(text) to authenticated;
