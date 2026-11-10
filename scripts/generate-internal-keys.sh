#!/usr/bin/env bash
# Gera um par de chaves ES256 (EC P-256) para o token interno entre os serviços.
# Imprime as duas variáveis em base64 (uma linha cada) e apaga os arquivos gerados.
#
#   INTERNAL_JWT_PRIVATE_KEY_B64 → vai SOMENTE no .env do auth (é quem emite o token)
#   INTERNAL_JWT_PUBLIC_KEY_B64  → vai no .env dos serviços que verificam o token
#
# NUNCA commite as chaves: elas ficam apenas nos arquivos .env, que são ignorados pelo git.
#
# Uso: ./scripts/generate-internal-keys.sh
set -euo pipefail

# arquivos criados só com permissão do dono
umask 077
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

openssl ecparam -name prime256v1 -genkey -noout \
  | openssl pkcs8 -topk8 -nocrypt -out "$tmp_dir/private.pem"
openssl pkey -in "$tmp_dir/private.pem" -pubout -out "$tmp_dir/public.pem"

# tr remove as quebras de linha: o base64 do macOS não tem a opção -w0
to_base64() { base64 < "$1" | tr -d '\n'; }

echo "INTERNAL_JWT_PRIVATE_KEY_B64=$(to_base64 "$tmp_dir/private.pem")"
echo "INTERNAL_JWT_PUBLIC_KEY_B64=$(to_base64 "$tmp_dir/public.pem")"
