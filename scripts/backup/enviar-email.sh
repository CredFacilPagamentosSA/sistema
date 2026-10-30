#!/usr/bin/env bash
# Envia o resultado do backup por e-mail (Brevo). Uso: enviar-email.sh ok|falha [arquivo]
set -euo pipefail

SITUACAO="$1"
ARQUIVO="${2:-}"
if [ -z "${BREVO_API_KEY:-}" ] || [ -z "${BACKUP_EMAIL_PARA:-}" ] || [ -z "${BACKUP_EMAIL_DE:-}" ]; then
  echo "Envio por e-mail não configurado (faltam BREVO_API_KEY, BACKUP_EMAIL_PARA ou BACKUP_EMAIL_DE). Pulando."
  exit 0
fi

DATA=$(TZ=America/Sao_Paulo date +%d/%m/%Y)
EMPRESA=$(jq -r '.nome' marca.json)
LINK="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/releases"
PARA=$(echo "$BACKUP_EMAIL_PARA" | jq -R 'split(",") | map(gsub("^\\s+|\\s+$"; "")) | map(select(length > 0)) | map({email: .})')
LIMITE_ANEXO=$((15 * 1024 * 1024))

if [ "$SITUACAO" = "ok" ]; then
  ASSUNTO="Backup $EMPRESA – $DATA"
  TAMANHO=$(stat -c %s "$ARQUIVO")
  if [ "$TAMANHO" -le "$LIMITE_ANEXO" ]; then
    TEXTO="O backup automático de $DATA foi feito com sucesso. O arquivo está anexado e também guardado no GitHub ($LINK). Para abrir, use o 7-Zip e a senha do backup (guardada no gerenciador de senhas)."
    base64 -w0 "$ARQUIVO" > /tmp/anexo.b64
    jq -n --arg de "$BACKUP_EMAIL_DE" --arg nome "$EMPRESA" --argjson para "$PARA" --arg assunto "$ASSUNTO" \
      --arg texto "$TEXTO" --arg arquivo "$(basename "$ARQUIVO")" --rawfile anexo /tmp/anexo.b64 \
      '{sender: {email: $de, name: $nome}, to: $para, subject: $assunto, textContent: $texto,
        attachment: [{name: $arquivo, content: $anexo}]}' > /tmp/email.json
  else
    TEXTO="O backup automático de $DATA foi feito com sucesso, mas ficou grande demais para ir anexado. Ele está guardado no GitHub: $LINK"
    jq -n --arg de "$BACKUP_EMAIL_DE" --arg nome "$EMPRESA" --argjson para "$PARA" --arg assunto "$ASSUNTO" --arg texto "$TEXTO" \
      '{sender: {email: $de, name: $nome}, to: $para, subject: $assunto, textContent: $texto}' > /tmp/email.json
  fi
else
  ASSUNTO="⚠ FALHA no backup $EMPRESA – $DATA"
  TEXTO="O backup automático de $DATA NÃO foi concluído. Veja o que aconteceu em ${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions e siga o guia 'O que fazer se o backup falhar' (docs/02-backup-e-restauracao.md)."
  jq -n --arg de "$BACKUP_EMAIL_DE" --arg nome "$EMPRESA" --argjson para "$PARA" --arg assunto "$ASSUNTO" --arg texto "$TEXTO" \
    '{sender: {email: $de, name: $nome}, to: $para, subject: $assunto, textContent: $texto}' > /tmp/email.json
fi

curl -sS --fail-with-body -X POST https://api.brevo.com/v3/smtp/email \
  -H "api-key: $BREVO_API_KEY" -H 'content-type: application/json' -H 'accept: application/json' \
  -d @/tmp/email.json > /dev/null
echo "E-mail enviado: $ASSUNTO"
rm -f /tmp/email.json /tmp/anexo.b64
