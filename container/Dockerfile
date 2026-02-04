# Use Python 3.11 slim as base (Debian-based)
FROM python:3.11-slim-bookworm

# 1. Install System Dependencies (Node.js, Nginx, Supervisor, ODBC)
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    ca-certificates \
    apt-transport-https \
    unixodbc \
    unixodbc-dev \
    nginx \
    supervisor \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /usr/share/keyrings/microsoft-prod.gpg \
    && echo "deb [arch=amd64,arm64,armhf signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" \
        > /etc/apt/sources.list.d/microsoft-prod.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 2. Setup Backend
WORKDIR /app/backend
COPY app/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/backend/ .

# 3. Setup Frontend
WORKDIR /app/frontend
COPY app/frontend/package*.json ./
RUN npm ci
COPY app/frontend/ .
# Build Next.js - ENV variables used at build time must be present if required, 
# but for runtime config usually we need them at runtime.
# Next.js standalone output helps.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# 4. Configuration (Nginx & Supervisor)
WORKDIR /app
COPY container/nginx.conf /etc/nginx/sites-available/default
COPY container/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# 5. Entrypoint
EXPOSE 80 8000 3000
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
