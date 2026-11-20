# Stage 1: Build Next.js frontend standalone bundle
FROM node:20-bookworm-slim AS frontend-builder

WORKDIR /app/frontend
COPY app/frontend/package*.json ./
RUN npm ci
COPY app/frontend/ .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Stage 2: Runtime unified container (Nginx + FastAPI + Next.js standalone)
FROM python:3.11-slim-bookworm

# 1. Install System Dependencies (Node.js 20 runtime, Nginx, Supervisor, ODBC)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    ca-certificates \
    apt-transport-https \
    unixodbc \
    unixodbc-dev \
    nginx \
    supervisor \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /usr/share/keyrings/microsoft-prod.gpg \
    && echo "deb [arch=amd64,arm64,armhf signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" \
        > /etc/apt/sources.list.d/microsoft-prod.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated unprivileged user for app processes
RUN useradd --system --create-home --shell /usr/sbin/nologin appuser

# 2. Setup Backend
WORKDIR /app/backend
COPY app/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/backend/ .

# 3. Copy Next.js standalone build output only (no source/devDependencies)
WORKDIR /app/frontend
COPY --from=frontend-builder /app/frontend/.next/standalone ./
COPY --from=frontend-builder /app/frontend/.next/static ./.next/static
COPY --from=frontend-builder /app/frontend/public ./public
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN chown -R appuser:appuser /app

# 4. Configuration (Nginx & Supervisor)
WORKDIR /app
COPY container/nginx.conf /etc/nginx/sites-available/default
COPY container/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# 5. Only expose the reverse proxy port
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1/health || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
