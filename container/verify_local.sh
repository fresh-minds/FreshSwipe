#!/bin/bash
set -e

echo "Building Unified Image..."
docker build -t freshswipe-unified -f container/Dockerfile .

echo "Removing any existing test containers..."
docker rm -f local-unified-test 2>/dev/null || true
docker rm -f freshswipe-db 2>/dev/null || true
docker rm -f freshswipe-sql 2>/dev/null || true

NETWORK_NAME="freshswipe-unified-net"
if ! docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
  echo "Creating docker network: $NETWORK_NAME"
  docker network create "$NETWORK_NAME" >/dev/null
fi

DB_ENGINE="${DB_ENGINE:-postgres}"
DATABASE_URL="${DATABASE_URL:-}"

if [ "$DB_ENGINE" = "azure-sql" ] || [ "$DB_ENGINE" = "mssql" ]; then
  SA_PASSWORD="${SA_PASSWORD:-LocalPassw0rd!}"
  if [ -z "$DATABASE_URL" ]; then
    DATABASE_URL="mssql+aioodbc://sa:${SA_PASSWORD}@freshswipe-sql:1433/freshswipe?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=no&TrustServerCertificate=yes"
  fi
  echo "Starting local SQL Server container..."
  docker run -d --name freshswipe-sql \
    --network "$NETWORK_NAME" \
    -e "ACCEPT_EULA=Y" \
    -e "MSSQL_SA_PASSWORD=$SA_PASSWORD" \
    -p 1433:1433 \
    mcr.microsoft.com/mssql/server:2022-latest
  echo "Waiting for SQL Server to be ready..."
  sleep 15
  docker exec freshswipe-sql /bin/bash -c "SQLCMD=/opt/mssql-tools18/bin/sqlcmd; if [ ! -x \"\$SQLCMD\" ]; then SQLCMD=/opt/mssql-tools/bin/sqlcmd; fi; if [ -x \"\$SQLCMD\" ]; then \"\$SQLCMD\" -S localhost -U sa -P \"$SA_PASSWORD\" -C -Q \"IF DB_ID('freshswipe') IS NULL CREATE DATABASE freshswipe;\"; else echo \"sqlcmd not found in container\"; fi"
else
  if [ -z "$DATABASE_URL" ]; then
    DATABASE_URL="postgresql+asyncpg://freshswipe:freshswipe@freshswipe-db:5432/freshswipe"
  fi
  echo "Starting local Postgres container..."
  docker run -d --name freshswipe-db \
    --network "$NETWORK_NAME" \
    -e POSTGRES_USER="freshswipe" \
    -e POSTGRES_PASSWORD="freshswipe" \
    -e POSTGRES_DB="freshswipe" \
    -p 5432:5432 \
    postgres:15-alpine
fi

echo "Starting Unified Container..."
# We map container port 80 (nginx) to localhost:8081 to avoid conflicts with local dev
docker run -d --name local-unified-test \
  --network "$NETWORK_NAME" \
  -p 8081:80 \
  -e DATABASE_URL="$DATABASE_URL" \
  -e DB_SSL="disable" \
  -e DB_ENGINE="$DB_ENGINE" \
  -e NEXTAUTH_SECRET="local-test-secret" \
  -e NEXTAUTH_URL="http://localhost:8081" \
  -e NEXT_PUBLIC_API_URL="http://localhost:8081" \
  -e AZURE_AD_CLIENT_ID="${AZURE_AD_CLIENT_ID:-your-id}" \
  -e AZURE_AD_TENANT_ID="${AZURE_AD_TENANT_ID:-your-tenant}" \
  -e AZURE_AD_CLIENT_SECRET="${AZURE_AD_CLIENT_SECRET:-your-secret}" \
  -e DEBUG="true" \
  -e DEBUG_USER_ID="${DEBUG_USER_ID:-}" \
  -e ADMIN_EMAIL="${ADMIN_EMAIL:-admin@test.com}" \
  -e ADMIN_PASSWORD="${ADMIN_PASSWORD:-password123}" \
  freshswipe-unified

echo "Containers started. Waiting 15s for initialization..."
sleep 15

echo "Logs from container:"
docker logs local-unified-test | grep -i "error" | head -n 10 || echo "No immediate errors in log head."

echo "Testing Localhost: WARNING: This might take a minute if cold start."
echo "1. Checking API Health..."
curl -v http://localhost:8081/health

echo ""
echo "2. Checking Frontend Root..."
curl -I http://localhost:8081/

echo ""
echo "Done. You can inspect manually with: docker logs -f local-unified-test"
