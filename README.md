# FreshSwipe 🎯

A Tinder-style professional skills swipe application for internal enterprise use. Employees can swipe on skill domains to express interest, growth ambitions, and active engagement.

![FreshSwipe Demo](docs/demo.gif)

## 🚀 Quick Start

### Prerequisites
- Docker
- Azure CLI (`az`)
- Node.js 18+ & Python 3.11+ (for local development)

### 🐳 Run with Docker (Unified Container)

This runs the exact same container image used in production, including Nginx, Frontend, and Backend.

```bash
# Build and run with local PostgreSQL (default)
./container/verify_local.sh

# Or run with local SQL Server compatibility
DB_ENGINE=mssql ./container/verify_local.sh

# Access the application:
# UI: http://localhost:8081
# API Docs: http://localhost:8081/docs
```

### 💻 Run Locally (Development)

**1. Backend (FastAPI)**
```bash
cd app/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Set local env vars
export DATABASE_URL="postgresql+asyncpg://freshswipe:freshswipe@localhost:5432/freshswipe"
export ADMIN_EMAILS='["your.email@freshminds.nl"]'

uvicorn app.main:app --reload --port 8000
```

**2. Frontend (Next.js)**
```bash
cd app/frontend
npm install
npm run dev
# App runs at http://localhost:3000
```

---

## 🏗️ Architecture

The application is deployed as a **Unified Container** on Azure Web App for Containers.

```mermaid
graph TD
    User[User] -->|HTTPS/443| AzureLB[Azure Load Balancer]
    AzureLB -->|HTTP/80| Container[Unified Container]
    
    subgraph Container
        Nginx[Nginx Reverse Proxy]
        Frontend["Next.js (Node.js)"]
        Backend["FastAPI (Python)"]
        Supervisor[Supervisor Process Manager]
        
        Nginx -->|/| Frontend
        Nginx -->|/api| Backend
        Frontend -->|"/api (server-side)"| Backend
    end
    
    Backend -->|SQL| DB[("Azure SQL / Postgres")]
    Backend --> KeyVault[Azure Key Vault]
```

-   **Nginx**: Acts as the internal reverse proxy, routing `/api` to FastAPI and everything else to Next.js.
-   **Supervisor**: Manages the multiple processes (Nginx, Node, Python) within the single Docker container.
-   **Key Vault**: Stores sensitivity credentials (`DB_ADMIN_PASS`, `NEXTAUTH_SECRET`, etc.) securely.

---

## 🚀 CI/CD Pipelines

Authentication and infrastructure are separated into two pipelines for safety and speed.

### 1. Code Deployment (Automatic)
-   **File**: `.github/workflows/cd.yml`
-   **Trigger**: Push to `main`
-   **Action**: 
    1.  Builds new Docker Image.
    2.  Pushes to Azure Container Registry (ACR).
    3.  Restarts the Web App to pull the new image.
-   **Note**: Does **not** modify infrastructure or secrets.

### 2. Infrastructure Deployment (Manual)
-   **File**: `.github/workflows/cd-infra.yml`
-   **Trigger**: Manual (`workflow_dispatch`)
-   **Action**: Runs `scripts/deploy/deploy_single_container.sh`.
-   **Scope**:
    -   Provisions/Updates Resource Groups, App Plans, SQL Servers.
    -   Creates/Updates Azure Key Vault.
    -   Assigns Managed Identities.
    -   Updates Secrets and App Settings.

---

## 🛠️ Scripts & Tools

| Script | Purpose |
|--------|---------|
| `container/verify_local.sh` | Builds and runs the unified Docker container locally for testing. |
| `scripts/deploy/ci_deploy_to_acr_from_local.sh` | Runs local tests, builds the image, and pushes to ACR (Manual CI/CD). |
| `scripts/deploy/deploy_image_update.sh` | **Fast Deploy**: Only updates the container image on Azure. |
| `scripts/deploy/deploy_single_container.sh` | **Full Deploy**: Provisions all Azure infrastructure and configures secrets. |

---

## 🔐 Security & Authentication

### Authentication
-   **Provider**: Azure Entra ID (via NextAuth.js).
-   **Access Control**: Email-based allowlist for Admin features.
-   **Token Management**: Automatic token refresh and rotation.

### Secrets Management
-   Sensitive environment variables are stored in **Azure Key Vault**.
-   The Web App uses a System-Assigned Managed Identity to read these secrets at runtime via Key Vault References (`@Microsoft.KeyVault(...)`).

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `AZURE_ENTRA_TENANT_ID` | Your Microsoft Tenant ID |
| `AZURE_ENTRA_AD_CLIENT_ID` | App Registration Client ID |
| `AZURE_ENTRA_AD_CLIENT_SECRET` | App Registration Secret (Stored in KV) |
| `NEXTAUTH_SECRET` | Random string for session encryption (Stored in KV) |
| `NEXTAUTH_URL` | Application URL (e.g., `https://app-freshswipe.azurewebsites.net`) |
| `DATABASE_URL` | Connection string (Stored in KV) |
| `ADMIN_EMAILS` | JSON array of admin emails `["user@example.com"]` |
| `ADMIN_PASSWORD` | Fallback admin password (Stored in KV) |

---

## 📁 Project Structure

```
swipefreshminds/
├── app/
│   ├── backend/        # FastAPI Application
│   └── frontend/       # Next.js Application
├── container/          # Docker & Nginx Configs
│   ├── Dockerfile
│   ├── nginx.conf
│   └── supervisord.conf
├── scripts/            # Deployment & Utility Scripts
│   └── deploy/
├── .github/
│   └── workflows/      # CI/CD Pipelines
└── README.md
```

## 📄 License

Internal use only. Not for distribution.
