-- Quantidade de registros por tabela (para conferir se a restauração trouxe tudo)
select 'clientes=' || (select count(*) from public.clientes)
union all select 'emprestimos=' || (select count(*) from public.emprestimos)
union all select 'lancamentos=' || (select count(*) from public.lancamentos)
union all select 'usuarios=' || (select count(*) from public.perfis)
union all select 'logins=' || (select count(*) from auth.users)
union all select 'historico_clientes=' || (select count(*) from public.clientes_historico)
union all select 'backups=' || (select count(*) from public.backups);
