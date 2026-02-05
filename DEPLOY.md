# Deployment Guide (Unified Container)

This guide covers deploying FreshSwipe as a **single Docker container** to Azure App Service using the unified image.

## Prerequisites

1. **Azure CLI**: Ensure `az` is installed and you are logged in (`az login`).
2. **Docker**: Ensure Docker is running locally for image building.
3. **Environment Variables**: Set required secrets before running the script.

Required environment variables:
- `AZURE_ENTRA_AD_CLIENT_SECRET`
- `ADMIN_PASSWORD`

Optional environment variables:
- `DB_ADMIN_PASS`
- `NEXTAUTH_SECRET`
- `ADMIN_EMAIL`
- `DB_ENGINE` (set to `mssql` to use Azure SQL; default `postgres`)

## How to Deploy

1. Make the script executable:
   ```bash
   chmod +x container/deploy_single_container.sh
   ```

2. Run the deployment:
   ```bash
   ./container/deploy_single_container.sh
   ```

The script will:
- Create a Resource Group.
- Create an Azure Container Registry (ACR).
- Build and push the unified Docker image.
- Create/Reuse a PostgreSQL Flexible Server (or Azure SQL if `DB_ENGINE=mssql`).
- Create/Update the App Service and configure settings.

## Local Verification

To verify locally using the unified container:
```bash
./container/verify_local.sh
```

## Legacy Multi-Container Deployment

The previous multi-container ACI deployment scripts and `docker-compose.yml` have been archived under:
```
old/multi_container/
```
