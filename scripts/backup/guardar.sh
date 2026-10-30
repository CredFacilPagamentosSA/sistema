#!/usr/bin/env bash
# Guarda o backup em "Releases" do repositório privado (uma por mês) e faz a limpeza:
# mantém todos os backups dos últimos 30 dias e, dos meses anteriores, o último de cada mês.
set -euo pipefail

ARQUIVO="$1"
MES=$(TZ=America/Sao_Paulo date +%Y-%m)
TAG="backup-$MES"

if ! gh release view "$TAG" > /dev/null 2>&1; then
  gh release create "$TAG" --title "Backups $MES" --latest=false \
    --notes "Backups diários criptografados de $MES. Para abrir: 7-Zip + senha do backup. Veja docs/02-backup-e-restauracao.md."
fi
gh release upload "$TAG" "$ARQUIVO" --clobber
echo "Guardado em Releases > $TAG"

LIMITE=$(TZ=America/Sao_Paulo date -d '30 days ago' +%F)
for tag in $(gh release list --limit 300 --json tagName -q '.[].tagName' | grep '^backup-' || true); do
  nomes=$(gh release view "$tag" --json assets -q '.assets[].name' | sort)
  [ -z "$nomes" ] && continue
  ultimo=$(echo "$nomes" | tail -n 1)
  for nome in $nomes; do
    data=$(echo "$nome" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)
    if [ -n "$data" ] && [[ "$data" < "$LIMITE" ]] && [ "$nome" != "$ultimo" ]; then
      gh release delete-asset "$tag" "$nome" --yes
      echo "Removido backup antigo: $nome (o último de cada mês é mantido)"
    fi
  done
done
