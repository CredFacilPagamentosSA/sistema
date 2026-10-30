# Passo a passo: criar o banco de dados no Supabase (gratuito)

Tempo estimado: 15 minutos. Não precisa de cartão de crédito.

> **Regra de ouro:** senhas e chaves **nunca** vão no chat. Guarde-as num gerenciador de senhas
> (por exemplo, o app Senhas do iPhone, Bitwarden ou 1Password).

---

## Parte 1 – Criar a conta (no nome da CredFacil)

1. Acesse **https://supabase.com** e clique em **Start your project**.
2. Escolha **Sign up with email** e use um **e-mail da empresa** (não um e-mail pessoal).
   Crie uma senha forte e confirme o e-mail que vai chegar.
3. Ative a **verificação em duas etapas**: clique na sua foto (canto superior direito) →
   **Account preferences** → **Security** → **Multi-factor authentication** → siga as instruções
   com um app autenticador (Google Authenticator ou o app Senhas do iPhone).
   Isso evita que alguém entre na conta mesmo descobrindo a senha.

## Parte 2 – Criar o projeto

1. Se ele pedir para criar uma **Organization**: nome **CredFacil**, tipo **Company**, plano **Free**.
2. Clique em **New project** e preencha:
   - **Name:** `credfacil`
   - **Database Password:** clique em **Generate a password**, copie e **guarde no gerenciador de senhas**.
     (Essa é a senha mestra do banco. Não mande para ninguém, nem para mim.)
   - **Region:** **South America (São Paulo)** – deixa o app mais rápido no Brasil.
3. Clique em **Create new project** e aguarde uns 2 minutos até terminar.

## Parte 3 – Instalar a estrutura do banco

A estrutura está em dois arquivos do projeto. É só copiar e colar, **na ordem**:

1. No menu da esquerda do Supabase, clique em **SQL Editor** → **New query**.
2. Abra o arquivo `supabase/migrations/20261029000001_estrutura.sql`, copie **todo** o conteúdo,
   cole no SQL Editor e clique em **Run**. Deve aparecer *"Success. No rows returned"*.
3. Clique em **New query** de novo, faça o mesmo com o arquivo
   `supabase/migrations/20261029000002_regras.sql` e clique em **Run**.

Se aparecer qualquer mensagem em vermelho, tire um print e me mostre (não tem chave nenhuma ali).

## Parte 4 – Ajustar o login

No menu da esquerda, clique em **Authentication**:

1. **Sign In / Providers** (ou *Providers*): em **Email**, **desligue** a opção
   **Allow new users to sign up**. Assim ninguém se cadastra sozinho: só quem um administrador convidar.
2. Ainda em **Email**, coloque **Minimum password length = 8** (se a opção aparecer) e salve.
3. **URL Configuration**:
   - **Site URL:** `http://localhost:5173` (vamos trocar pelo endereço definitivo na publicação)
   - Em **Redirect URLs**, clique em **Add URL** e adicione: `http://localhost:5173/definir-senha`
   - Salve.

## Parte 5 – Criar o primeiro administrador (você)

> Faça isto **depois** da Parte 3, porque é a estrutura do banco que transforma o primeiro usuário em administrador.

1. **Authentication** → **Users** → **Add user** → **Create new user**.
2. Use **o mesmo e-mail da conta do Supabase** (assim o e-mail de recuperação de senha já funciona
   no plano gratuito, antes de configurarmos o serviço de e-mails).
3. Crie uma senha, marque **Auto Confirm User** e clique em **Create user**.
4. Guarde essa senha no gerenciador de senhas.

## Parte 6 – Ligar o app ao banco

1. No Supabase, clique em **Project Settings** (engrenagem) → **API Keys** (ou **Data API**).
2. Copie o **Project URL** (algo como `https://abcdefgh.supabase.co`).
3. Copie a chave **Publishable** (começa com `sb_publishable_`). Se só aparecer "anon public", use essa.
   ⚠️ **Não** copie a chave **secret** / **service_role**.
4. No projeto, abra o arquivo **`.env.local`** e cole os dois valores depois do sinal de `=`:
   ```
   VITE_SUPABASE_URL=https://abcdefgh.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
5. Salve o arquivo e me avise **"pronto"** no chat (sem colar as chaves).

---

### Por que a chave "publishable" pode ficar no app?
Ela é como o endereço de uma loja: diz *onde* fica o banco, mas não abre a porta.
Quem abre a porta é o login, e o que cada pessoa pode fazer é decidido pelas regras de segurança
que instalamos na Parte 3. A chave **secret** é diferente: ela abre tudo, por isso nunca sai do Supabase.
