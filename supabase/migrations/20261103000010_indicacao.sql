-- =====================================================================
-- Atualização 10: campo "Indicado por" no cadastro do cliente.
-- Opcional; entra no histórico de alterações como os demais campos.
-- =====================================================================

alter table public.clientes
  add column indicacao text check (length(indicacao) <= 120);

create or replace function public.salvar_cliente(p_cliente uuid, p_dados jsonb) returns uuid
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
      (nome, whatsapp, cpf, data_nascimento, email, cep, logradouro, numero, complemento, bairro, cidade, uf, observacoes, indicacao, criado_por)
    values
      (v_nome, v_whatsapp, v_cpf, v_nascimento, v_email, v_cep,
       public.texto_opcional(p_dados, 'logradouro', 200, 'Endereço'),
       public.texto_opcional(p_dados, 'numero', 20, 'Número'),
       public.texto_opcional(p_dados, 'complemento', 100, 'Complemento'),
       public.texto_opcional(p_dados, 'bairro', 100, 'Bairro'),
       public.texto_opcional(p_dados, 'cidade', 100, 'Cidade'),
       v_uf,
       public.texto_opcional(p_dados, 'observacoes', 1000, 'Observações'),
       public.texto_opcional(p_dados, 'indicacao', 120, 'Indicado por'),
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
    indicacao = public.texto_opcional(p_dados, 'indicacao', 120, 'Indicado por'),
    atualizado_em = now()
  where id = c.id;

  return c.id;
end $$;
