#!/usr/bin/env bash
# Faz a cópia completa do banco (papéis, estrutura e dados, incluindo os logins)
# e junta tudo num .zip protegido por senha (AES-256).
set -euo pipefail

DATA=$(TZ=America/Sao_Paulo date +%F)
EMPRESA=$(jq -r '.nome' marca.json | iconv -f utf-8 -t ascii//TRANSLIT | tr -cd '[:alnum:]')
PASTA=$(mktemp -d)

echo "Copiando o banco..."
supabase db dump --db-url "$SUPABASE_DB_URL" --role-only -f "$PASTA/1-papeis.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$PASTA/2-estrutura.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" --data-only --use-copy -f "$PASTA/3-dados.sql"

# Quantos registros há em cada tabela: usado depois para conferir a restauração
psql "$SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 -f scripts/backup/contagens.sql > "$PASTA/contagens.txt"
cp scripts/backup/LEIA-ME.txt "$PASTA/LEIA-ME.txt"

for f in 2-estrutura.sql 3-dados.sql; do
  if [ ! -s "$PASTA/$f" ]; then
    echo "::error::A cópia $f saiu vazia. Backup interrompido."
    exit 1
  fi
done

ARQUIVO="${EMPRESA}-backup-${DATA}.zip"
7z a -tzip -mem=AES256 -mx=9 -p"$BACKUP_SENHA" "$ARQUIVO" "$PASTA"/* > /dev/null
# Confere que o arquivo abre com a senha antes de seguir
7z t -p"$BACKUP_SENHA" "$ARQUIVO" > /dev/null

RESUMO=$(paste -sd ' ' "$PASTA/contagens.txt")
echo "Backup pronto: $ARQUIVO ($(du -h "$ARQUIVO" | cut -f1)) · $RESUMO"
echo "arquivo=$ARQUIVO" >> "$GITHUB_OUTPUT"
echo "resumo=$RESUMO" >> "$GITHUB_OUTPUT"
rm -rf "$PASTA"
