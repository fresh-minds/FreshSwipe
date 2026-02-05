#!/bin/bash
set -e

# ==============================================================================
# Configuration
# ==============================================================================
APP_NAME_PREFIX="freshswipe-uni"
RESOURCE_GROUP="dev-${APP_NAME_PREFIX}-rg2"
LOCATION="westeurope"
ACR_NAME="acr$(echo ${APP_NAME_PREFIX}2 | tr -d '-')" # Unique name, alphanumeric only
PLAN_NAME="plan-${APP_NAME_PREFIX}2"
WEB_APP_NAME="app-${APP_NAME_PREFIX}2"
DB_ENGINE="${DB_ENGINE:-azure-sql}"
DB_SERVER_NAME="db-${APP_NAME_PREFIX}2"
DB_NAME="freshswipe2"
DB_ADMIN_USER="dbadmin2"
DB_ADMIN_PASS="${DB_ADMIN_PASS:-}"

# Load .env file if it exists
if [ -f .env ]; then
    echo "Loading environment variables from .env..."
    set -a
    source .env
    set +a
fi

# Secrets (Env vars or prompt)
AZURE_ENTRA_AD_CLIENT_ID="${AZURE_ENTRA_AD_CLIENT_ID:-67f7d9af-a5dd-4f03-8c45-18aaaebe1d06}"
if [ -z "$AZURE_ENTRA_AD_CLIENT_SECRET" ]; then
    if [ "$CI" = "true" ]; then
        echo "Error: AZURE_ENTRA_AD_CLIENT_SECRET is missing in CI environment."
        exit 1
    fi
    read -s -p "Enter Azure AD Client Secret: " AZURE_ENTRA_AD_CLIENT_SECRET
    echo ""
fi

# Prioritize AZURE_ENTRA_TENANT_ID, fall back to AZURE_AD_TENANT_ID, then default
AZURE_ENTRA_TENANT_ID="${AZURE_ENTRA_TENANT_ID:-${AZURE_AD_TENANT_ID:-fedcef2f-0c85-40dd-8f55-e23143dcb367}}"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-karel.goense@freshminds.nl}"

echo "=============================================================================="
echo "Starting Unified Deployment for $APP_NAME_PREFIX"
echo "Resource Group: $RESOURCE_GROUP"
echo "Web App Name:   $WEB_APP_NAME"
echo "=============================================================================="

# 1. Prerequisites
if ! command -v az &> /dev/null; then echo "Error: az CLI not installed."; exit 1; fi
if ! command -v docker &> /dev/null; then echo "Error: docker not installed."; exit 1; fi

echo "Checking Azure login..."
az account show > /dev/null 2>&1 || az login

# 2. Resource Group
echo "Creating/Updating Resource Group '$RESOURCE_GROUP'..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION"

# 3. ACR (Registry)
echo "Creating/Updating ACR '$ACR_NAME'..."
az acr create --resource-group "$RESOURCE_GROUP" --name "$ACR_NAME" --sku Basic --admin-enabled true

echo "Logging into ACR..."
az acr login --name "$ACR_NAME"
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer --output tsv)
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username --output tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query passwords[0].value --output tsv)

# 4. Build & Push Image
IMAGE_TAG="$ACR_LOGIN_SERVER/freshswipe-unified:latest"
echo "Building Docker image '$IMAGE_TAG'..."
# Build from project root, using container/Dockerfile
docker build --platform linux/amd64 -t "$IMAGE_TAG" -f container/Dockerfile .
echo "Pushing image to ACR..."
docker push "$IMAGE_TAG"

# 5. Database (PostgreSQL Flexible or Azure SQL)
# Handle Password
if [ -z "$DB_ADMIN_PASS" ]; then
    EXISTING_DB_CONN=$(az webapp config appsettings list -g "$RESOURCE_GROUP" -n "$WEB_APP_NAME" --query "[?name=='DATABASE_URL'].value" -o tsv 2>/dev/null || true)
    if [ -n "$EXISTING_DB_CONN" ]; then
        # Reuse the existing connection string when we don't have admin credentials.
        echo "Found existing DB connection string. Will reuse."
        DATABASE_URL="$EXISTING_DB_CONN"
    else
        if [ "$CI" = "true" ]; then
            echo "Error: DB_ADMIN_PASS is missing in CI environment."
            exit 1
        fi
        read -s -p "Enter Database Admin Password: " DB_ADMIN_PASS
        echo ""
        if [ -z "$DB_ADMIN_PASS" ]; then
            echo "Error: DB_ADMIN_PASS cannot be empty."
            exit 1
        fi
    fi
fi

if [ "$DB_ENGINE" = "azure-sql" ] || [ "$DB_ENGINE" = "mssql" ]; then
    DB_SERVER_NAME="sql-${APP_NAME_PREFIX}2"
    echo "Checking if Microsoft.Sql resource provider is registered..."
    PROVIDER_STATE=$(az provider show --namespace Microsoft.Sql --query "registrationState" -o tsv)
    if [ "$PROVIDER_STATE" != "Registered" ]; then
        echo "Provider not registered. Registering now..."
        az provider register --namespace Microsoft.Sql > /dev/null
        # Wait for registration to complete
        for i in {1..20}; do
            STATE=$(az provider show --namespace Microsoft.Sql --query "registrationState" -o tsv)
            if [ "$STATE" = "Registered" ]; then
                break
            fi
            sleep 5
        done
    else
        echo "Microsoft.Sql is already registered."
    fi
    if az sql server show --resource-group "$RESOURCE_GROUP" --name "$DB_SERVER_NAME" > /dev/null 2>&1; then
        echo "SQL Server '$DB_SERVER_NAME' exists."
    else
        echo "Creating Azure SQL Server '$DB_SERVER_NAME'..."
        az sql server create \
            --resource-group "$RESOURCE_GROUP" \
            --name "$DB_SERVER_NAME" \
            --location "$LOCATION" \
            --admin-user "$DB_ADMIN_USER" \
            --admin-password "$DB_ADMIN_PASS"
    fi

    if ! az sql db show --resource-group "$RESOURCE_GROUP" --server "$DB_SERVER_NAME" --name "$DB_NAME" > /dev/null 2>&1; then
        echo "Creating Azure SQL Database '$DB_NAME' (free tier)..."
        az sql db create \
            --resource-group "$RESOURCE_GROUP" \
            --server "$DB_SERVER_NAME" \
            --name "$DB_NAME" \
            --edition GeneralPurpose \
            --family Gen5 \
            --capacity 1 \
            --compute-model Serverless \
            --auto-pause-delay 60 \
            --min-capacity 0.5 \
            --max-size 32GB \
            --use-free-limit true \
            --free-limit-exhaustion-behavior AutoPause
    fi

    echo "Ensuring Azure SQL Database '$DB_NAME' is configured for free tier..."
    az sql db update \
        --resource-group "$RESOURCE_GROUP" \
        --server "$DB_SERVER_NAME" \
        --name "$DB_NAME" \
        --edition GeneralPurpose \
        --family Gen5 \
        --capacity 1 \
        --compute-model Serverless \
        --auto-pause-delay 60 \
        --min-capacity 0.5 \
        --max-size 32GB \
        --use-free-limit true \
        --free-limit-exhaustion-behavior AutoPause > /dev/null

    az sql server firewall-rule create --resource-group "$RESOURCE_GROUP" --server "$DB_SERVER_NAME" --name "allow-azure" --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 > /dev/null 2>&1 || true

    DB_HOST="$DB_SERVER_NAME.database.windows.net"
    if [ -n "$DB_ADMIN_PASS" ]; then
        MSSQL_LOGIN="$DB_ADMIN_USER"
        if [[ "$DB_ADMIN_USER" != *"@"* ]]; then
            MSSQL_LOGIN="${DB_ADMIN_USER}@${DB_SERVER_NAME}"
        fi
        DB_ADMIN_PASS_ENC=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$DB_ADMIN_PASS''', safe=''))")
        DATABASE_URL="mssql+aioodbc://$MSSQL_LOGIN:$DB_ADMIN_PASS_ENC@$DB_HOST:1433/$DB_NAME?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no"
    fi
else
    DB_SERVER_NAME="psql-${APP_NAME_PREFIX}2"
    if az postgres flexible-server show --resource-group "$RESOURCE_GROUP" --name "$DB_SERVER_NAME" > /dev/null 2>&1; then
        echo "Database Server '$DB_SERVER_NAME' exists."
    else
        echo "Creating PostgreSQL Server '$DB_SERVER_NAME'..."
        az postgres flexible-server create \
            --resource-group "$RESOURCE_GROUP" \
            --name "$DB_SERVER_NAME" \
            --location "$LOCATION" \
            --admin-user "$DB_ADMIN_USER" \
            --admin-password "$DB_ADMIN_PASS" \
            --sku-name Standard_B1ms \
            --tier Burstable \
            --public-access all \
            --storage-size 32 \
            --version 15 \
            --yes
    fi

    # Ensure DB exists
    if ! az postgres flexible-server db show --resource-group "$RESOURCE_GROUP" --server-name "$DB_SERVER_NAME" --database-name "$DB_NAME" > /dev/null 2>&1; then
        echo "Creating Database '$DB_NAME'..."
        az postgres flexible-server db create --resource-group "$RESOURCE_GROUP" --server-name "$DB_SERVER_NAME" --database-name "$DB_NAME"
    fi

    # Firewall
    az postgres flexible-server firewall-rule create --resource-group "$RESOURCE_GROUP" --name "$DB_SERVER_NAME" --rule-name "allow-azure" --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 > /dev/null 2>&1 || true

    # Construct Conn String
    DB_HOST="$DB_SERVER_NAME.postgres.database.azure.com"
    if [ -n "$DB_ADMIN_PASS" ]; then
        DB_ADMIN_PASS_ENC=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$DB_ADMIN_PASS''', safe=''))")
        DATABASE_URL="postgresql+asyncpg://$DB_ADMIN_USER:$DB_ADMIN_PASS_ENC@$DB_HOST:5432/$DB_NAME"
    fi
fi

# 6. App Service Plan
echo "Creating/Updating App Service Plan '$PLAN_NAME'..."
PLAN_OK=false
for i in {1..6}; do
    if az appservice plan create --resource-group "$RESOURCE_GROUP" --name "$PLAN_NAME" --is-linux --sku B1; then
        PLAN_OK=true
        break
    fi
    echo "Plan creation failed. Retrying in 20s..."
    sleep 20
done
if [ "$PLAN_OK" != "true" ]; then
    echo "Error: App Service plan creation failed after retries."
    exit 1
fi

# 7. Web App
echo "Creating/Updating Web App '$WEB_APP_NAME'..."
if ! az webapp show --resource-group "$RESOURCE_GROUP" --name "$WEB_APP_NAME" > /dev/null 2>&1; then
    WEBAPP_OK=false
    for i in {1..6}; do
        if az webapp create --resource-group "$RESOURCE_GROUP" --plan "$PLAN_NAME" --name "$WEB_APP_NAME" \
            --container-image-name "$IMAGE_TAG" \
            --container-registry-url "https://$ACR_LOGIN_SERVER" \
            --container-registry-user "$ACR_USERNAME" \
            --container-registry-password "$ACR_PASSWORD"; then
            WEBAPP_OK=true
            break
        fi
        echo "Web app creation failed. Retrying in 20s..."
        sleep 20
    done
    if [ "$WEBAPP_OK" != "true" ]; then
        echo "Error: Web app creation failed after retries."
        exit 1
    fi
fi

# Set container image and registry credentials
az webapp config container set --resource-group "$RESOURCE_GROUP" --name "$WEB_APP_NAME" \
    --container-image-name "$IMAGE_TAG" \
    --container-registry-url "https://$ACR_LOGIN_SERVER" \
    --container-registry-user "$ACR_USERNAME" \
    --container-registry-password "$ACR_PASSWORD"

# 7b. Harden App Service
echo "Applying App Service security settings..."
az webapp update --resource-group "$RESOURCE_GROUP" --name "$WEB_APP_NAME" --https-only true > /dev/null
az webapp update --resource-group "$RESOURCE_GROUP" --name "$WEB_APP_NAME" --set clientAffinityEnabled=false > /dev/null
az webapp config set --resource-group "$RESOURCE_GROUP" --name "$WEB_APP_NAME" --min-tls-version 1.2 --ftps-state Disabled > /dev/null

# 8. Configure Secrets in Key Vault and App Settings
echo "Configuring Secrets Management..."

# Generate NextAuth Secret if needed
if [ -z "$NEXTAUTH_SECRET" ]; then
   NEXTAUTH_SECRET=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')
fi

# 8a. Setup Key Vault
KV_NAME="kv$(echo ${APP_NAME_PREFIX}2 | tr -d '-')" # Globally unique name
echo "Ensuring Key Vault '$KV_NAME' exists..."
if az keyvault create --name "$KV_NAME" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --enable-rbac-authorization false > /dev/null 2>&1; then
    echo "Key Vault created/updated (Access Policies Enabled)."
else
    # If creation failed, it might exist but we might not have access, or name conflict.
    # Try to proceed, assuming it exists.
    echo "Warning: Key Vault creation might have failed or it already exists. Proceeding..."
fi

# Determine whether the vault uses RBAC or access policies.
KV_USE_RBAC=$(az keyvault show --name "$KV_NAME" --resource-group "$RESOURCE_GROUP" --query "properties.enableRbacAuthorization" -o tsv 2>/dev/null || echo "false")
KV_SCOPE=$(az keyvault show --name "$KV_NAME" --resource-group "$RESOURCE_GROUP" --query "id" -o tsv 2>/dev/null || true)

# 8b. Managed Identity for Web App
echo "Enabling System-Assigned Managed Identity for Web App..."
IDENTITY_OUTPUT=$(az webapp identity assign --resource-group "$RESOURCE_GROUP" --name "$WEB_APP_NAME")
APP_IDENTITY_ID=$(echo "$IDENTITY_OUTPUT" | grep -o '"principalId": "[^"]*' | cut -d'"' -f4)

# 8c. Access Policy
echo "Granting Web App ($APP_IDENTITY_ID) access to Key Vault secrets..."
if [ "$KV_USE_RBAC" = "true" ]; then
    az role assignment create --assignee-object-id "$APP_IDENTITY_ID" --assignee-principal-type ServicePrincipal --role "Key Vault Secrets User" --scope "$KV_SCOPE" > /dev/null 2>&1 || true
else
    az keyvault set-policy --name "$KV_NAME" --object-id "$APP_IDENTITY_ID" --secret-permissions get list > /dev/null
fi

# Also ensure current user has access to set secrets
CURRENT_USER_ID=$(az ad signed-in-user show --query id -o tsv 2>/dev/null || true)
if [ -n "$CURRENT_USER_ID" ]; then
     if [ "$KV_USE_RBAC" = "true" ]; then
         az role assignment create --assignee-object-id "$CURRENT_USER_ID" --assignee-principal-type User --role "Key Vault Secrets Officer" --scope "$KV_SCOPE" > /dev/null 2>&1 || true
     else
         az keyvault set-policy --name "$KV_NAME" --object-id "$CURRENT_USER_ID" --secret-permissions set get list delete > /dev/null
     fi
fi

# 8d. Store Secrets in Key Vault
echo "Storing secrets in Key Vault..."
az keyvault secret set --vault-name "$KV_NAME" --name "AZURE-ENTRA-AD-CLIENT-SECRET" --value "$AZURE_ENTRA_AD_CLIENT_SECRET" > /dev/null
if [ -n "$DB_ADMIN_PASS" ]; then
    az keyvault secret set --vault-name "$KV_NAME" --name "DB-ADMIN-PASS" --value "$DB_ADMIN_PASS" > /dev/null
fi
az keyvault secret set --vault-name "$KV_NAME" --name "ADMIN-PASSWORD" --value "$ADMIN_PASSWORD" > /dev/null
az keyvault secret set --vault-name "$KV_NAME" --name "NEXTAUTH-SECRET" --value "$NEXTAUTH_SECRET" > /dev/null
if [ -n "$DATABASE_URL" ]; then
    az keyvault secret set --vault-name "$KV_NAME" --name "DATABASE-URL" --value "$DATABASE_URL" > /dev/null
fi


# 8e. Configure App Settings (Referencing Key Vault)
echo "Configuring App Settings with Key Vault References..."

SETTINGS=(
    "WEBSITES_PORT=80"
    "DB_SSL=require"
    "DB_ODBC_TIMEOUT=30"
    "DB_ENGINE=$DB_ENGINE"
    "DEBUG=false"
    "AZURE_ENTRA_AD_CLIENT_ID=$AZURE_ENTRA_AD_CLIENT_ID"
    "AZURE_ENTRA_TENANT_ID=$AZURE_ENTRA_TENANT_ID"
    "AZURE_AD_TENANT_ID=$AZURE_ENTRA_TENANT_ID"
    "ADMIN_EMAIL=$ADMIN_EMAIL"
    "ADMIN_EMAILS=${ADMIN_EMAILS:-[\"admin@freshminds.nl\", \"karel.goense@freshminds.nl\"]}"
    "NEXT_PUBLIC_API_URL=https://$WEB_APP_NAME.azurewebsites.net"
    "NEXTAUTH_URL=https://$WEB_APP_NAME.azurewebsites.net"
    "NODE_ENV=production"
    
    # Key Vault References: @Microsoft.KeyVault(SecretUri=...)
    "AZURE_ENTRA_AD_CLIENT_SECRET=@Microsoft.KeyVault(SecretUri=https://$KV_NAME.vault.azure.net/secrets/AZURE-ENTRA-AD-CLIENT-SECRET)"
    "DB_ADMIN_PASS=@Microsoft.KeyVault(SecretUri=https://$KV_NAME.vault.azure.net/secrets/DB-ADMIN-PASS)"
    "ADMIN_PASSWORD=@Microsoft.KeyVault(SecretUri=https://$KV_NAME.vault.azure.net/secrets/ADMIN-PASSWORD)"
    "NEXTAUTH_SECRET=@Microsoft.KeyVault(SecretUri=https://$KV_NAME.vault.azure.net/secrets/NEXTAUTH-SECRET)"
)

if [ -n "$DATABASE_URL" ]; then
    SETTINGS+=("DATABASE_URL=@Microsoft.KeyVault(SecretUri=https://$KV_NAME.vault.azure.net/secrets/DATABASE-URL)")
fi

az webapp config appsettings set --resource-group "$RESOURCE_GROUP" --name "$WEB_APP_NAME" --settings "${SETTINGS[@]}" > /dev/null

echo "Restarting Web App..."
az webapp restart --resource-group "$RESOURCE_GROUP" --name "$WEB_APP_NAME"

echo "=============================================================================="
echo "Deployment Complete!"
echo "URL: https://$WEB_APP_NAME.azurewebsites.net"
echo "Resource Group: $RESOURCE_GROUP"
echo "=============================================================================="
