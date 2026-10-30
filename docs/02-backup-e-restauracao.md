# Backup e restauração – guia em linguagem simples

## Onde ficam as cópias

| Onde | Quando | Como abrir | Para quê |
|---|---|---|---|
| **GitHub** (repositório privado da empresa → aba *Releases*) | Todo dia às 3h da manhã, sozinho | 7-Zip + senha do backup | Restaurar o sistema inteiro |
| **E-mail** (anexo "Backup … – data") | Logo depois, todo dia | 7-Zip + senha do backup | Uma cópia extra, em outro lugar |
| **Seu celular ou computador** (botão *Mais → Backup e exportação* no app) | Quando você clicar | Abre direto no Excel ou como PDF | Ler e conferir os dados |

**Quanto tempo fica guardado no GitHub:** todos os backups dos últimos 30 dias e, dos meses anteriores, o último de cada mês, para sempre.

> 🔑 **A senha do backup** é o que protege as cópias. Sem ela, ninguém abre os arquivos, nem você.
> Guarde no gerenciador de senhas e passe também para um segundo administrador (por exemplo, um sócio).
> Ela **nunca** deve ficar no próprio e-mail nem num arquivo no computador.

---

## Como saber se o backup está funcionando

- No app, em **Mais → Backup e exportação**, aparece a data do **último backup automático**.
  Se passar de 2 dias sem backup, o quadro fica **vermelho**.
- Todo dia chega o e-mail **"Backup … – data"**. Se chegar **"⚠ FALHA no backup"**, siga a seção abaixo.
- O GitHub também manda um e-mail automático quando a rotina falha.

## O que fazer se o backup falhar

1. **Não se preocupe com os dados:** eles continuam no Supabase. Só a cópia do dia não foi feita.
2. Abra o GitHub → repositório do sistema → aba **Actions** → clique na execução com ❌ vermelho.
3. Abra o passo que falhou e copie a mensagem de erro (ela não mostra senhas, que o GitHub esconde com `***`).
4. Para tentar de novo na hora: **Actions → Backup diário → Run workflow → Run workflow**.
5. Falhas comuns:
   - *"Faltam os segredos..."*: um segredo foi apagado ou digitado errado (veja o guia de publicação).
   - *Erro de conexão / senha*: a senha do banco no Supabase foi trocada. Atualize o segredo `SUPABASE_DB_URL`.
   - *Projeto pausado*: o Supabase gratuito pausa após 7 dias sem uso. Entre no painel do Supabase e clique em **Restore project**.

---

## Como abrir um arquivo de backup no computador (opcional)

1. Instale o **7-Zip** (gratuito, site oficial 7-zip.org).
2. Clique com o botão direito no arquivo `...-backup-AAAA-MM-DD.zip` → **7-Zip → Extrair aqui**.
3. Digite a **senha do backup**.
4. Vão aparecer os arquivos `.sql` (para restaurar o sistema) e o `contagens.txt` (quantos registros havia).
   Para **ler** os dados, use a exportação em Excel/PDF do app, que é mais prática.

---

## Como restaurar o sistema

**Regra de segurança:** a restauração é feita **sempre num projeto novo e vazio** do Supabase.
O banco em uso nunca é sobrescrito; a rotina se recusa a fazer isso.

### A) Teste de restauração (fazer antes de colocar no ar, e depois a cada 3 meses)

Serve para provar que os backups realmente funcionam.

1. O projeto de teste no Supabase (por exemplo `credfacil-teste`) precisa estar **novo e vazio**.
   Se já foi usado num teste anterior, apague-o e crie outro (*Project Settings → General → Delete project*),
   sempre conferindo o nome antes, para **não apagar o projeto principal**.
2. No GitHub: **Actions → Restaurar backup → Run workflow**.
3. Preencha:
   - **Data do backup:** em branco (usa o mais recente) ou a data desejada, por exemplo `2026-10-31`.
   - **Onde restaurar:** `teste`.
   - **Confirmação:** digite `RESTAURAR`.
4. Clique em **Run workflow** e aguarde uns 3 minutos.
5. Resultado:
   - ✅ **"Restauração conferida"**: todos os registros vieram, e as quantidades batem com o momento do backup.
   - ❌ Se der erro, a mensagem diz o motivo. Copie e me mostre.
6. **Prova extra (recomendada):** no projeto de teste, abra o *Table Editor* e veja que os clientes e os empréstimos estão lá.

### B) Recuperação de verdade (se um dia o banco principal se perder)

1. **Calma:** os dados estão nos backups. Nada é feito no projeto antigo.
2. No Supabase, crie um **projeto novo** (região São Paulo), igual ao da Parte 2 do primeiro guia.
3. Pegue a ligação dele (*Connect → Session pooler*, com a senha do banco nova) e cadastre no GitHub como segredo `NOVO_DB_URL`.
4. Rode **Actions → Restaurar backup** com **Onde restaurar: `novo_projeto`** e **Confirmação: `RESTAURAR`**.
5. Quando aparecer ✅, troque o endereço e a chave do app para os do projeto novo
   (no Cloudflare: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`) e publique de novo.
6. Troque também o segredo `SUPABASE_DB_URL` para o projeto novo, para os backups continuarem.
7. Os usuários entram com **os mesmos e-mails e senhas** de antes, porque os logins vêm junto no backup.

---

## Resumo dos segredos usados pelo backup (cadastrados no GitHub, nunca no código)

| Nome do segredo | O que é |
|---|---|
| `SUPABASE_DB_URL` | Ligação com o banco principal (*Connect → Session pooler*, com a senha do banco) |
| `BACKUP_SENHA` | A senha que criptografa os backups (crie uma longa no gerenciador de senhas) |
| `BREVO_API_KEY` | Chave do Brevo para enviar o e-mail do backup |
| `BACKUP_EMAIL_DE` | E-mail remetente cadastrado e confirmado no Brevo |
| `BACKUP_EMAIL_PARA` | Quem recebe o backup (pode ter dois, separados por vírgula) |
| `TESTE_DB_URL` | Ligação com o projeto de teste, para o teste de restauração |
| `NOVO_DB_URL` | Só numa recuperação de verdade: a ligação do projeto novo |
