# Passo a passo: GitHub, Brevo e projeto de teste (tudo gratuito)

Tempo estimado: 40 minutos, em 6 partes. Faça **na ordem** e me avise ao fim da Parte 1,
porque eu preciso enviar o código para o GitHub antes das outras partes.

> **Regra de ouro (de novo):** senhas, chaves e "ligações" do banco vão **direto** para o gerenciador
> de senhas ou para os *Secrets* do GitHub. **Nunca** no chat, nem em e-mail ou arquivo.
> Use o **Edge** (não o navegador do Claude), com a tradução automática **desligada** nesses sites.

---

## Parte 1 – Conta no GitHub e repositório privado (10 min)

1. Acesse **https://github.com/signup** e crie a conta com o **e-mail da empresa**.
   - Nome de usuário: algo como `credfacil-pagamentos` (pode ser trocado depois).
2. Confirme o e-mail que o GitHub enviar.
3. **Ative a verificação em duas etapas:** foto (canto superior direito) → **Settings** →
   **Password and authentication** → **Enable two-factor authentication** → use o app autenticador.
   Guarde os **códigos de recuperação** (*recovery codes*) no gerenciador de senhas.
4. Crie o repositório: botão **+** (canto superior direito) → **New repository**:
   - **Repository name:** `sistema`
   - Marque **Private** ⚠️ (muito importante)
   - **Não** marque "Add a README", nem .gitignore, nem licença (o repositório precisa nascer vazio)
   - Clique em **Create repository**
5. Copie o endereço que aparece no topo da página, algo como `https://github.com/credfacil-pagamentos/sistema`
   (esse endereço **não** é secreto, pode me mandar) e me avise **"GitHub pronto"**.

Eu envio o código. Na hora, vai abrir uma janela do GitHub pedindo para **você** autorizar; é só entrar e clicar em *Authorize*.

---

## Parte 2 – Projeto de teste no Supabase (5 min)

Ele serve só para o **teste de restauração**. Precisa ficar **vazio**: não cole nenhum arquivo SQL nele.

1. No Supabase (Edge), vá na lista de **Projects** → **New project**.
2. **Name:** `credfacil-teste` · **Region:** South America (São Paulo).
3. **Database password:** crie no gerenciador de senhas (item "Supabase TESTE – senha do banco"),
   **só letras e números**, e cole no campo.
4. **Create new project** e aguarde.

---

## Parte 3 – As "ligações" dos dois bancos (5 min)

A rotina de backup precisa de um endereço com senha para entrar em cada banco. Faça para os **dois** projetos
(primeiro o `CredFacil`, depois o `credfacil-teste`):

1. Abra o projeto → botão verde **Connect** (no topo).
2. Procure **Session pooler** (às vezes dentro de "Connection string" → "Method: Session pooler").
   ⚠️ Use **Session pooler**, não "Direct connection" (a direta não funciona a partir do GitHub).
3. Copie o endereço. Ele tem este formato:
   `postgresql://postgres.xxxxxxxx:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`
4. No gerenciador de senhas, crie um item e cole o endereço, **trocando `[YOUR-PASSWORD]`** (com os colchetes)
   pela senha do banco **daquele** projeto.
   - Item 1: "Ligação backup – CredFacil (principal)"
   - Item 2: "Ligação backup – credfacil-teste"

---

## Parte 4 – Conta no Brevo (10 min)

1. Acesse **https://www.brevo.com** → **Sign up free** → use o **e-mail da empresa**.
2. Preencha os dados da empresa que ele pedir (nome, site pode ficar em branco, país Brasil). Plano: **Free**.
3. **Cadastre o remetente:** menu (seu nome, canto superior direito) → **Senders, Domains & Dedicated IPs** →
   **Senders** → **Add a sender** → nome da empresa + e-mail da empresa → confirme pelo e-mail que chegar.
4. **Crie a chave de envio:** menu → **SMTP & API** → aba **API keys** → **Generate a new API key** →
   nome `backup-github` → copie e guarde no gerenciador de senhas ("Brevo – chave API").
   ⚠️ Ela só aparece uma vez.

> Às vezes o Brevo pede para "ativar" a conta para e-mails transacionais (pode levar algumas horas).
> Se aparecer esse aviso, siga o que ele pedir; o resto continua funcionando enquanto isso.

---

## Parte 5 – A senha do backup (2 min)

1. No gerenciador de senhas, crie o item **"Senha do backup"** com uma senha **longa** (24+ caracteres),
   **só letras e números**.
2. Passe essa senha também para um segundo administrador de confiança (sócio), de forma segura
   (pessoalmente ou pelo próprio gerenciador de senhas).
3. **Sem ela, os backups não podem ser abertos.** Não guarde no e-mail.

---

## Parte 6 – Cadastrar os segredos no GitHub (8 min)

No repositório `sistema`: **Settings** (aba do repositório, não da conta) → **Secrets and variables** →
**Actions** → **New repository secret**. Crie um por vez (nome **exatamente** como está, em maiúsculas):

| Name | Secret (o valor) |
|---|---|
| `SUPABASE_DB_URL` | A ligação do projeto **principal** (Parte 3, item 1) |
| `TESTE_DB_URL` | A ligação do projeto **de teste** (Parte 3, item 2) |
| `BACKUP_SENHA` | A senha do backup (Parte 5) |
| `BREVO_API_KEY` | A chave do Brevo (Parte 4) |
| `BACKUP_EMAIL_DE` | O e-mail remetente confirmado no Brevo |
| `BACKUP_EMAIL_PARA` | Quem recebe o backup. Para dois: `voce@empresa.com, socio@empresa.com` |

Quando terminar, a lista deve mostrar os **6 nomes** (o GitHub nunca mostra os valores de novo; é normal).
Me avise **"segredos prontos"**.

---

## Depois disso, eu acompanho com você

1. **Primeiro backup:** aba **Actions** → **Backup diário** → **Run workflow** → **Run workflow**.
   Em uns 3 minutos deve ficar ✅, aparecer em **Releases** e chegar o e-mail.
2. **Teste de restauração:** **Actions** → **Restaurar backup** → **Run workflow** →
   destino `teste`, confirmação `RESTAURAR`. Deve terminar com **"Restauração conferida"**.
