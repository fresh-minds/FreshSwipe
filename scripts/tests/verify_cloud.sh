#!/usr/bin/env bash
set -euo pipefail

RG="${RESOURCE_GROUP:-dev-freshswipe-uni-rg2}"
APP="${WEB_APP_NAME:-app-freshswipe-uni2}"
APP_URL="${APP_URL:-}"

if ! command -v az >/dev/null 2>&1; then
  echo "Error: Azure CLI ('az') is not installed."
  exit 1
fi

az account show >/dev/null 2>&1 || {
  echo "Please login to Azure CLI: az login"
  exit 1
}

if [[ -z "$APP_URL" ]]; then
  APP_URL="https://$(az webapp show --resource-group "$RG" --name "$APP" --query defaultHostName -o tsv)"
fi

ADMIN_EMAIL=$(az webapp config appsettings list --resource-group "$RG" --name "$APP" --query "[?name=='ADMIN_EMAIL'].value | [0]" -o tsv)
ADMIN_PASSWORD=$(az webapp config appsettings list --resource-group "$RG" --name "$APP" --query "[?name=='ADMIN_PASSWORD'].value | [0]" -o tsv)

if [[ -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
  echo "Error: ADMIN_EMAIL or ADMIN_PASSWORD not found in app settings."
  exit 1
fi

APP_URL="$APP_URL" ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  python scripts/tests/verify_azure_full.py
