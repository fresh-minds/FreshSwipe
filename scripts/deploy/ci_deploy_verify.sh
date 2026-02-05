#!/bin/bash
set -e

# ==============================================================================
# Configuration
# ==============================================================================
APP_NAME_PREFIX="freshswipe-uni"
ACR_NAME="acr$(echo ${APP_NAME_PREFIX}2 | tr -d '-')"
IMAGE_TAG="freshswipe-unified:latest"

echo "=============================================================================="
echo "Starting Local CI/CD Pipeline"
echo "1. Run Tests (w/ Validation)"
echo "2. Build Docker Image"
echo "3. Push to ACR"
echo "=============================================================================="

# 1. Run Backend Tests
echo ""
echo "------------------------------------------------------------------------------"
echo "Running Backend Tests..."
echo "------------------------------------------------------------------------------"
cd app/backend
if pytest; then
    echo "✅ Backend Tests Passed"
else
    echo "❌ Backend Tests Failed"
    exit 1
fi
cd ../..

# 2. Run Frontend Build (Type Check + Build Verification)
# We don't run e2e tests here as they require a running server, which takes longer.
# A build failure is a good proxy for "broken code".
echo ""
echo "------------------------------------------------------------------------------"
echo "Verifying Frontend Build..."
echo "------------------------------------------------------------------------------"
cd app/frontend
if npm run build; then
    echo "✅ Frontend Build Passed"
else
    echo "❌ Frontend Build Failed"
    exit 1
fi
cd ../..

# 3. Build Docker Image
echo ""
echo "------------------------------------------------------------------------------"
echo "Building Unified Docker Image..."
echo "------------------------------------------------------------------------------"

# Login to ACR first to get the login server URL
echo "Logging into Azure..."
az account show > /dev/null 2>&1 || az login
echo "Logging into ACR '$ACR_NAME'..."
az acr login --name "$ACR_NAME"

ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer --output tsv)
FULL_IMAGE_TAG="$ACR_LOGIN_SERVER/$IMAGE_TAG"

echo "Building image: $FULL_IMAGE_TAG"
if docker build --platform linux/amd64 -t "$FULL_IMAGE_TAG" -f container/Dockerfile .; then
    echo "✅ Docker Build Passed"
else
    echo "❌ Docker Build Failed"
    exit 1
fi

# 4. Push to ACR
echo ""
echo "------------------------------------------------------------------------------"
echo "Pushing to ACR..."
echo "------------------------------------------------------------------------------"
if docker push "$FULL_IMAGE_TAG"; then
    echo "✅ Image Pushed Successfully"
else
    echo "❌ Failed to Push Image"
    exit 1
fi

echo ""
echo "=============================================================================="
echo "🚀 Deployment to ACR Complete!"
echo "To deploy this image to the Web App, run: ./scripts/deploy/deploy_single_container.sh"
echo "=============================================================================="
