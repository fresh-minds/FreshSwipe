#!/bin/bash
set -e

# Configuration
DB_CONTAINER="freshswipe-sql"
APP_CONTAINER="freshswipe-app"
SA_PASSWORD="${MSSQL_SA_PASSWORD:-}"
DB_NAME="freshswipe"

if [ -z "$SA_PASSWORD" ]; then
    echo "❌ MSSQL_SA_PASSWORD is not set."
    exit 1
fi

echo "🚀 Starting Local FreshSwipe (MSSQL Edition)..."

# 1. Clean start
echo "🧹 Cleaning up old containers..."
docker-compose down --remove-orphans

# 2. Build and Start
echo "🏗️  Building and starting containers..."
docker-compose up -d --build

# 3. Wait for SQL Server
echo "⏳ Waiting for SQL Server to be ready..."
MAX_RETRIES=30
count=0

# Detect sqlcmd path
if docker exec $DB_CONTAINER test -f /opt/mssql-tools18/bin/sqlcmd; then
    SQLCMD="/opt/mssql-tools18/bin/sqlcmd"
else
    SQLCMD="/opt/mssql-tools/bin/sqlcmd"
fi

# Try to connect until successful or timeout
until docker exec $DB_CONTAINER $SQLCMD -S localhost -U sa -P "$SA_PASSWORD" -C -Q "SELECT 1" &> /dev/null
do
    echo "   Waiting for MSSQL... ($count/$MAX_RETRIES)"
    sleep 2
    count=$((count+1))
    if [ $count -ge $MAX_RETRIES ]; then
        echo "❌ Timeout waiting for SQL Server."
        exit 1
    fi
done

echo "✅ SQL Server is up!"

# 4. Create Database
echo "🗄️  Creating database '$DB_NAME'..."
# Only create if doesn't exist to avoid errors
docker exec $DB_CONTAINER $SQLCMD -S localhost -U sa -P "$SA_PASSWORD" -C -Q "IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '$DB_NAME') BEGIN CREATE DATABASE $DB_NAME; END"

# 5. Restart App to initialize/seed
echo "🔄 Restarting App to trigger database seeding..."
docker restart $APP_CONTAINER

echo "✅ AWSOME! Deployment Complete."
echo "👉 App is running at: http://localhost:8081"
