-- Depois de restaurar: religa o gatilho que cria o perfil de cada novo login.
-- (Ele fica na tabela de logins do Supabase, que não entra na cópia da estrutura.)
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();
