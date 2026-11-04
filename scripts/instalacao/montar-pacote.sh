#!/usr/bin/env bash
# Monta em entregas/<nome> o que vai para a conta do cliente: banco, função e backup.
# Não inclui código-fonte das telas, dados nem chaves. O site é montado à parte (ver docs/07).
# Uso: bash scripts/instalacao/montar-pacote.sh imusic
set -euo pipefail

NOME="${1:?Informe o nome da instalação, por exemplo: imusic}"
ORIGEM="instalacoes/$NOME"
DESTINO="entregas/$NOME"
[ -f "$ORIGEM/marca.json" ] || { echo "Não existe $ORIGEM/marca.json"; exit 1; }

rm -rf "$DESTINO"
mkdir -p "$DESTINO/banco" "$DESTINO/funcao" "$DESTINO/repositorio-backup/.github/workflows" "$DESTINO/repositorio-backup/scripts/backup" "$DESTINO/repositorio-backup/docs"

# Banco: todas as atualizações, em ordem, num arquivo só
cat supabase/migrations/*.sql > "$DESTINO/banco/banco-completo.sql"
cp supabase/functions/usuarios/index.ts "$DESTINO/funcao/usuarios.ts"

# Backup: só as rotinas, sem o resto do projeto
cp .github/workflows/backup-diario.yml .github/workflows/restaurar-backup.yml "$DESTINO/repositorio-backup/.github/workflows/"
cp scripts/backup/* "$DESTINO/repositorio-backup/scripts/backup/"
cp docs/02-backup-e-restauracao.md "$DESTINO/repositorio-backup/docs/"
cp "$ORIGEM/marca.json" "$DESTINO/repositorio-backup/marca.json"
printf '*.zip\n*.sql.tmp\n' > "$DESTINO/repositorio-backup/.gitignore"

# Tira o nome do sistema original dos textos entregues
NOVO=$(sed -n 's/.*"nome": *"\([^"]*\)".*/\1/p' "$ORIGEM/marca.json" | head -n 1)
grep -rlE 'CredFacil|credfacil' "$DESTINO" | while read -r arquivo; do
  sed -i "s/CredFacil/$NOVO/g; s/credfacil-teste/projeto-de-teste/g; s/credfacil/$NOME/g" "$arquivo"
done

echo "Pacote pronto em $DESTINO"
