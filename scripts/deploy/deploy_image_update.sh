#!/bin/bash
set -e

# ==============================================================================
# Configuration
# ==============================================================================
APP_NAME_PREFIX="freshswipe-uni"
RESOURCE_GROUP="dev-${APP_NAME_PREFIX}-rg2"
ACR_NAME="acr$(echo ${APP_NAME_PREFIX}2 | tr -d '-')"
WEB_APP_NAME="app-${APP_NAME_PREFIX}2"

echo "=============================================================================="
echo "Starting Code Deployment (Image Update) for $APP_NAME_PREFIX"
echo "Resource Group: $RESOURCE_GROUP"
echo "Web App Name:   $WEB_APP_NAME"
echo "=============================================================================="

# 1. Prerequisites
if ! command -v az &> /dev/null; then echo "Error: az CLI not installed."; exit 1; fi
if ! command -v docker &> /dev/null; then echo "Error: docker not installed."; exit 1; fi

echo "Checking Azure login..."
az account show > /dev/null 2>&1 || az login

# 2. Login to ACR
echo "Logging into ACR '$ACR_NAME'..."
az acr login --name "$ACR_NAME"
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer --output tsv)

# 3. Build & Push Image
IMAGE_TAG="$ACR_LOGIN_SERVER/freshswipe-unified:latest"
echo "Building Docker image '$IMAGE_TAG'..."
docker build --platform linux/amd64 -t "$IMAGE_TAG" -f container/Dockerfile .

echo "Pushing image to ACR..."
docker push "$IMAGE_TAG"

# 4. Restart Web App
echo "Restarting Web App '$WEB_APP_NAME' to pull new image..."
az webapp restart --resource-group "$RESOURCE_GROUP" --name "$WEB_APP_NAME"

echo "=============================================================================="
echo "Deployment Complete!"
echo "URL: https://$WEB_APP_NAME.azurewebsites.net"
echo "=============================================================================="
