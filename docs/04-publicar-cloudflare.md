# Passo a passo: publicar o app no Cloudflare (gratuito)

Tempo estimado: 15 minutos. Depois disso o app abre de **qualquer lugar**, no celular ou no computador.

> Se o cadastro no computador der "acesso restrito", faça pelo **celular** (como no GitHub).
> As duas informações do Supabase da Parte 4 são públicas por natureza, mas mesmo assim
> **não mande no chat**: copie do arquivo `.env.local` direto para o Cloudflare.

---

## Parte 1 – Conta no Cloudflare (3 min)

1. Acesse **https://dash.cloudflare.com/sign-up** e crie a conta com o **e-mail da empresa**.
2. Confirme o e-mail que chegar.
3. Ative a **verificação em duas etapas**: foto (canto superior direito) → **Profile** →
   **Authentication** → **Two-Factor Authentication**.

## Parte 2 – Ligar o Cloudflare ao GitHub (4 min)

1. No menu da esquerda, clique em **Workers & Pages** (às vezes em "Compute").
2. Clique em **Create** (ou "Create application").
3. Escolha a aba **Pages** → **Import an existing Git repository** (ou "Connect to Git").
   - Se só aparecerem opções de "Workers", procure o link *"Looking to deploy Pages? Get started"*.
4. Escolha **GitHub** → vai abrir o GitHub pedindo autorização:
   - Entre com a conta **CredFacilPagamentosSA**.
   - Em **Repository access**, escolha **Only select repositories** → selecione **sistema**.
   - Clique em **Install & Authorize**.
5. De volta ao Cloudflare, selecione o repositório **sistema** → **Begin setup**.

## Parte 3 – Configurar a publicação (4 min)

| Campo | O que colocar |
|---|---|
| **Project name** | Vira o endereço do app: `NOME.pages.dev`. Sugestão neutra, já que o nome da empresa pode mudar: `gestao-emprestimos` (se estiver ocupado, ele avisa; acrescente algo, ex. `gestao-emprestimos-sp`) |
| **Production branch** | `main` |
| **Framework preset** | `React (Vite)` (se não houver, deixe `None`) |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |

## Parte 4 – As informações do Supabase (3 min)

Ainda na mesma tela, abra **Environment variables (advanced)** e adicione **três** variáveis:

| Variable name | Value |
|---|---|
| `VITE_SUPABASE_URL` | Copie do arquivo `.env.local` (o endereço `https://...supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Copie do arquivo `.env.local` (a chave `sb_publishable_...`) |
| `NODE_VERSION` | `24` |

> Para abrir o `.env.local`: na pasta `C:\Users\Win\Credfacil.sistema`, botão direito no arquivo →
> **Abrir com → Bloco de Notas**. Copie só o que vem **depois** do `=`.

Clique em **Save and Deploy**. Em uns 2 minutos aparece **"Success"** e o endereço do app
(`https://NOME.pages.dev`). **Me mande esse endereço** (não é secreto).

## Parte 5 – Avisar o Supabase do novo endereço (2 min)

Sem isso, o "esqueci minha senha" e os convites mandariam as pessoas para o endereço errado.

1. No Supabase (Edge) → projeto **CredFacil** → **Authentication** → **URL Configuration**.
2. **Site URL:** troque `http://localhost:5173` por `https://NOME.pages.dev` → **Save changes**.
3. **Redirect URLs → Add URL:** `https://NOME.pages.dev/definir-senha` → **Save URLs**.
   (Pode deixar também o `http://localhost:5173/definir-senha` que já está lá; ele serve para os meus testes.)

## Parte 6 – Instalar no iPhone

1. Abra **https://NOME.pages.dev** no **Safari** (precisa ser o Safari).
2. Entre com seu e-mail e senha.
3. Toque em **Compartilhar** (quadrado com seta para cima) → **Adicionar à Tela de Início** → **Adicionar**.
4. O ícone aparece na tela do iPhone e abre em tela cheia. Na primeira vez pelo ícone, entre de novo
   com e-mail e senha (o iPhone guarda o login do ícone separado do Safari).

---

### Daqui para frente
Toda melhoria que eu enviar ao GitHub é publicada **sozinha** pelo Cloudflare em 1–2 minutos.
Se um dia a publicação falhar, o app continua no ar com a versão anterior.
