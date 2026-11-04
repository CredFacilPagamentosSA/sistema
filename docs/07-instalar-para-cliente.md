# Instalar uma cópia para um cliente

Roteiro para fazer **com o cliente ao lado**, em cerca de 2 horas. Tudo fica nas contas dele, com o e-mail dele,
e ele digita as próprias senhas. Você não precisa ficar com nenhuma senha dele.

**Antes de começar:** contrato assinado e pagamento combinado recebido, como vocês acertaram.

## 0. Preparar o pacote (você, antes do dia)

Peça para o Claude rodar a montagem do pacote da instalação. Ela cria `entregas/<nome>` com o banco, a função e as
rotinas de backup. O nome e as cores da instalação ficam em `instalacoes/<nome>`.

## 1. E-mail e contas (cliente)

1. Criar o e-mail que será usado no sistema. Guardar a senha.
2. Criar conta em: **Supabase**, **GitHub** e **Cloudflare**, sempre com esse e-mail.
   Se algum site mostrar "acesso restrito", tente no celular pelos dados móveis.

## 2. Banco de dados (Supabase)

1. **New project**, região **South America (São Paulo)**. Senha do banco **só com letras e números**, guardada no cofre.
2. **SQL Editor → New query:** colar `banco/banco-completo.sql` → **Run** → conferir "Success".
3. **Authentication → Sign In / Providers:** desligar **Allow new users to sign up** e salvar.
4. Em **Email**: tamanho mínimo **8** e requisitos de **minúsculas, maiúsculas e números**. Salvar.
5. **Authentication → Users → Add user → Create new user:** e-mail e senha do cliente, com **Auto Confirm User**.
   Esse primeiro usuário vira **administrador e Dono** automaticamente.

## 3. Função que cria os acessos (Supabase)

1. **Edge Functions → Deploy a new function → Via Editor:** colar `funcao/usuarios.ts`.
2. Nome: `usuarios` → **Deploy function**.
3. **Settings:** desligar **Verify JWT with legacy secret** → **Save changes**.

## 4. Montar e publicar o app

1. No botão **Connect** ou na página inicial do projeto dele, copiar o **Project URL** e a chave **Publishable**.
   A chave **secret** não é usada e não deve ser copiada.
2. Passar os dois ao Claude **pela janela do terminal, não pelo chat**, para montar `dist/<nome>`. A montagem recusa
   rodar sem esses dados, para o app do cliente nunca apontar para o seu banco.
3. Cloudflare: **Workers & Pages → Create → Pages → Upload assets**. Nome do projeto neutro.
   Arrastar a pasta `dist/<nome>` → **Deploy**.
4. Supabase → **Authentication → URL Configuration:** **Site URL** = endereço publicado. Em **Redirect URLs**, adicionar
   o endereço + `/definir-senha`.

## 5. Backup diário (GitHub)

1. Criar um repositório **privado** e vazio e enviar a pasta `repositorio-backup` para ele.
2. **Settings → Secrets and variables → Actions:** cadastrar
   - `SUPABASE_DB_URL`: **Connect → Direct → Session pooler**, trocando `[YOUR-PASSWORD]` pela senha do banco;
   - `BACKUP_SENHA`: senha longa, só letras e números, guardada **em dois lugares** pelo cliente.
3. **Actions → Backup diário → Run workflow** e conferir ✅.

## 6. Teste de restauração (obrigatório antes de entregar)

1. Criar um segundo projeto no Supabase do cliente, **vazio**, em São Paulo. Senha só com letras e números.
2. Cadastrar o segredo `TESTE_DB_URL` com a ligação **Session pooler** desse projeto.
3. **Actions → Restaurar backup → Run workflow:** destino `teste`, confirmação `RESTAURAR`.
4. Só considere entregue com **"Restauração conferida"**.

## 7. Conferir com o cliente

- [ ] Abrir o endereço no **Safari** e entrar.
- [ ] **Compartilhar → Adicionar à Tela de Início**.
- [ ] Cadastrar um cliente e um empréstimo, receber, desfazer e cancelar.
- [ ] Criar o acesso do ajudante e entrar com ele numa janela anônima: troca de senha obrigatória, sem Relatórios,
      Backup nem Usuários.
- [ ] Baixar um Excel e um PDF.
- [ ] Remover os dados usados no treino, se o cliente quiser, ou cancelar e arquivar.
- [ ] Mostrar onde ver o backup e explicar as senhas.

## 8. Fechamento

- Entregar a lista de contas (sem senhas) e o guia de backup, que está em `docs` no repositório dele.
- Sair de todas as contas dele nos seus aparelhos.
- A garantia de 30 dias começa na data combinada no contrato.

## Limites para combinar com o cliente

- **Plano gratuito:** sem suporte da Supabase, e o banco pausa após 7 dias sem uso. Para voltar, basta **Restore project**.
- **Alterações no app:** dependem de você, porque ele recebe o app montado, sem o código-fonte. Se o banco mudar, a
  atualização também precisa ser aplicada na conta dele.
- **Disfarce:** nome e ícone não substituem senha, bloqueio de tela nem as obrigações da LGPD.
