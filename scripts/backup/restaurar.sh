#!/usr/bin/env bash
# Baixa o backup escolhido, abre com a senha, restaura no projeto de destino
# e compara a quantidade de registros com a do momento do backup.
set -euo pipefail

# 1. Qual backup: o da data informada ou o mais recente
LISTA=$(for tag in $(gh release list --limit 300 --json tagName -q '.[].tagName' | grep '^backup-' || true); do
  gh release view "$tag" --json assets -q ".assets[].name | \"$tag \" + ."
done)
if [ -n "${DATA_BACKUP:-}" ]; then
  ESCOLHIDO=$(echo "$LISTA" | grep -- "-${DATA_BACKUP}.zip" | head -n 1 || true)
else
  ESCOLHIDO=$(echo "$LISTA" | awk '{ match($2, /[0-9]{4}-[0-9]{2}-[0-9]{2}/); print substr($2, RSTART, 10), $0 }' | sort | tail -n 1 | cut -d' ' -f2-)
fi
if [ -z "$ESCOLHIDO" ]; then
  echo "::error::Backup não encontrado${DATA_BACKUP:+ para a data $DATA_BACKUP}."
  exit 1
fi
TAG=$(echo "$ESCOLHIDO" | cut -d' ' -f1)
NOME=$(echo "$ESCOLHIDO" | cut -d' ' -f2)
echo "Usando o backup: $NOME"

# 2. Baixar e abrir com a senha
rm -rf baixado backup && mkdir -p baixado backup
gh release download "$TAG" -p "$NOME" -D baixado
7z x -p"$BACKUP_SENHA" -obackup "baixado/$NOME" > /dev/null

# 3. O destino precisa ser um projeto novo, sem as tabelas do sistema
if [ "$(psql "$DESTINO_URL" -X -A -t -c "select to_regclass('public.emprestimos') is not null")" = "t" ]; then
  echo "::error::O projeto de destino já tem as tabelas do sistema. Use um projeto novo e vazio."
  exit 1
fi

# 4. Restaurar tudo de uma vez (se algo falhar, nada fica pela metade).
# O 1-papeis.sql fica só como registro: o sistema não cria papéis próprios, usa os que
# o Supabase já traz em todo projeto novo, e alguns ajustes desses papéis só a Supabase pode fazer.
psql "$DESTINO_URL" -X -q --single-transaction -v ON_ERROR_STOP=1 \
  -f backup/2-estrutura.sql \
  -c 'SET session_replication_role = replica' \
  -f backup/3-dados.sql \
  -c 'SET session_replication_role = origin' \
  -f scripts/backup/pos-restauracao.sql

# 5. Conferir: a quantidade de registros precisa ser igual à do backup
psql "$DESTINO_URL" -X -A -t -v ON_ERROR_STOP=1 -f scripts/backup/contagens.sql > contagens-restauradas.txt
echo "No backup:      $(paste -sd ' ' backup/contagens.txt)"
echo "Após restaurar: $(paste -sd ' ' contagens-restauradas.txt)"
if diff -q backup/contagens.txt contagens-restauradas.txt > /dev/null; then
  echo "RESTAURAÇÃO CONFERIDA: todos os registros vieram."
  {
    echo "## ✅ Restauração conferida"
    echo "Backup **$NOME** restaurado. Registros: $(paste -sd ' ' contagens-restauradas.txt)"
  } >> "$GITHUB_STEP_SUMMARY"
else
  echo "::error::As quantidades não batem. Compare as duas linhas acima."
  exit 1
fi
