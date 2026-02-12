// ─── Deployment Configuration Generator ───────────────────────────────
// Generates docker-compose.yml, .env files, and deployment scripts
// based on wizard selections.

export interface DeploymentConfig {
  // Step 1: Deployment type
  deploymentType: 'cloud' | 'on-premise';
  provider?: 'aws' | 'gcp' | 'azure' | 'hetzner' | 'ovh' | 'custom';

  // Step 2: Infrastructure
  domain: string;
  apiSubdomain: string;
  postgresVersion: '16' | '15' | '14';
  redisMaxMemory: '256' | '512' | '1024';
  enableTraefik: boolean;
  enableBackups: boolean;
  replicaCount: number;

  // Step 3: Database
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbPort: string;
  redisPassword: string;
  redisPort: string;

  // Step 4: Application
  clerkPublishableKey: string;
  clerkSecretKey: string;
  apiPort: string;
  webPort: string;
  corsOrigin: string;
  nodeEnv: 'production' | 'staging';
  adminEmail: string;
  sslEmail: string;

  // Step 5: Monitoring
  enableMonitoring: boolean;
  sentryDsn: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export const DEFAULT_CONFIG: DeploymentConfig = {
  deploymentType: 'cloud',
  provider: 'aws',
  domain: 'global-green-tax.com',
  apiSubdomain: 'api',
  postgresVersion: '16',
  redisMaxMemory: '256',
  enableTraefik: true,
  enableBackups: true,
  replicaCount: 1,
  dbName: 'global_green_tax',
  dbUser: 'ggt_user',
  dbPassword: '',
  dbPort: '5432',
  redisPassword: '',
  redisPort: '6379',
  clerkPublishableKey: '',
  clerkSecretKey: '',
  apiPort: '4000',
  webPort: '3000',
  corsOrigin: '',
  nodeEnv: 'production',
  adminEmail: 'admin@global-green-tax.com',
  sslEmail: 'admin@global-green-tax.com',
  enableMonitoring: false,
  sentryDsn: '',
  logLevel: 'info',
};

export function generateDockerCompose(config: DeploymentConfig): string {
  const isOnPrem = config.deploymentType === 'on-premise';
  const fullApiUrl = `https://${config.apiSubdomain}.${config.domain}`;
  const dbUrl = `postgresql://${config.dbUser}:${config.dbPassword}@postgres:${config.dbPort}/${config.dbName}?schema=public`;
  const redisUrl = config.redisPassword
    ? `redis://:${config.redisPassword}@redis:${config.redisPort}`
    : `redis://redis:${config.redisPort}`;

  let yaml = `version: "3.9"

services:
  # ─── PostgreSQL ${config.postgresVersion} ────────────────────────────────
  postgres:
    image: postgres:${config.postgresVersion}-alpine
    container_name: ggt-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${config.dbName}
      POSTGRES_USER: ${config.dbUser}
      POSTGRES_PASSWORD: \${DB_PASSWORD}
    ports:
      - "${config.dbPort}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${config.dbUser} -d ${config.dbName}"]
      interval: 10s
      timeout: 5s
      retries: 5
    labels:
      - "traefik.enable=false"
`;

  if (config.enableBackups) {
    yaml += `
  # ─── PostgreSQL Backups ──────────────────────────────────────────────
  pg-backup:
    image: prodrigestivill/postgres-backup-local:16
    container_name: ggt-pg-backup
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_DB: ${config.dbName}
      POSTGRES_USER: ${config.dbUser}
      POSTGRES_PASSWORD: \${DB_PASSWORD}
      SCHEDULE: "@daily"
      BACKUP_KEEP_DAYS: 7
      BACKUP_KEEP_WEEKS: 4
      BACKUP_KEEP_MONTHS: 6
    volumes:
      - pg_backups:/backups
    labels:
      - "traefik.enable=false"
`;
  }

  yaml += `
  # ─── Redis ${config.redisMaxMemory}MB ─────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: ggt-redis
    restart: unless-stopped
    ports:
      - "${config.redisPort}:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory ${config.redisMaxMemory}mb --maxmemory-policy allkeys-lru${config.redisPassword ? ` --requirepass \${REDIS_PASSWORD}` : ''}
    healthcheck:
      test: ["CMD", "redis-cli"${config.redisPassword ? ', "-a", "${REDIS_PASSWORD}"' : ''}, "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    labels:
      - "traefik.enable=false"
`;

  if (config.enableTraefik) {
    yaml += `
  # ─── Traefik (reverse proxy + SSL) ──────────────────────────────────
  traefik:
    image: traefik:v3.1
    container_name: ggt-traefik
    restart: unless-stopped
    command:
      - "--api.dashboard=${isOnPrem ? 'true' : 'false'}"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=${config.sslEmail}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
      - "--entrypoints.web.http.redirections.entrypoint.scheme=https"${isOnPrem ? `
      - "--log.level=${config.logLevel.toUpperCase()}"` : ''}
    ports:
      - "80:80"
      - "443:443"${isOnPrem ? `
      - "8080:8080"` : ''}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik_certs:/letsencrypt
`;
  }

  yaml += `
  # ─── API (NestJS) ───────────────────────────────────────────────────
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    container_name: ggt-api
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      DATABASE_URL: ${dbUrl}
      REDIS_URL: ${redisUrl}
      NODE_ENV: ${config.nodeEnv}
      API_PORT: "${config.apiPort}"
      CLERK_SECRET_KEY: \${CLERK_SECRET_KEY}
      CORS_ORIGIN: "https://${config.domain}"
      LOG_LEVEL: ${config.logLevel}${config.sentryDsn ? `
      SENTRY_DSN: \${SENTRY_DSN}` : ''}
`;

  if (config.enableTraefik) {
    yaml += `    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(\`${config.apiSubdomain}.${config.domain}\`)"
      - "traefik.http.routers.api.entrypoints=websecure"
      - "traefik.http.routers.api.tls.certresolver=letsencrypt"
      - "traefik.http.services.api.loadbalancer.server.port=${config.apiPort}"
`;
  } else {
    yaml += `    ports:
      - "${config.apiPort}:${config.apiPort}"
`;
  }

  if (config.replicaCount > 1) {
    yaml += `    deploy:
      replicas: ${config.replicaCount}
`;
  }

  yaml += `
  # ─── Web (Next.js) ──────────────────────────────────────────────────
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    container_name: ggt-web
    restart: unless-stopped
    depends_on:
      - api
    environment:
      NEXT_PUBLIC_API_URL: ${fullApiUrl}
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: \${CLERK_PUBLISHABLE_KEY}
      CLERK_SECRET_KEY: \${CLERK_SECRET_KEY}
      NODE_ENV: ${config.nodeEnv}
`;

  if (config.enableTraefik) {
    yaml += `    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.web.rule=Host(\`${config.domain}\`)"
      - "traefik.http.routers.web.entrypoints=websecure"
      - "traefik.http.routers.web.tls.certresolver=letsencrypt"
      - "traefik.http.services.web.loadbalancer.server.port=${config.webPort}"
`;
  } else {
    yaml += `    ports:
      - "${config.webPort}:${config.webPort}"
`;
  }

  if (config.enableMonitoring) {
    yaml += `
  # ─── Monitoring (Prometheus + Grafana) ──────────────────────────────
  prometheus:
    image: prom/prometheus:v2.51.0
    container_name: ggt-prometheus
    restart: unless-stopped
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    labels:
      - "traefik.enable=false"

  grafana:
    image: grafana/grafana:10.4.0
    container_name: ggt-grafana
    restart: unless-stopped
    depends_on:
      - prometheus
    environment:
      GF_SECURITY_ADMIN_PASSWORD: \${GRAFANA_PASSWORD}
      GF_SERVER_ROOT_URL: "https://monitoring.${config.domain}"
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - "3001:3000"
    labels:
      - "traefik.enable=false"
`;
  }

  yaml += `
volumes:
  postgres_data:
  redis_data:`;

  if (config.enableTraefik) yaml += `\n  traefik_certs:`;
  if (config.enableBackups) yaml += `\n  pg_backups:`;
  if (config.enableMonitoring) yaml += `\n  prometheus_data:\n  grafana_data:`;
  yaml += '\n';

  return yaml;
}

export function generateEnvFile(config: DeploymentConfig): string {
  const lines: string[] = [
    '# ─── Global Green Tax — Environment Configuration ───────────────────',
    `# Generated on ${new Date().toISOString().split('T')[0]}`,
    `# Deployment: ${config.deploymentType.toUpperCase()} ${config.provider ? `(${config.provider.toUpperCase()})` : ''}`,
    '',
    '# ─── Database ─────────────────────────────────────────────────────────',
    `DB_PASSWORD=${config.dbPassword}`,
    `DATABASE_URL=postgresql://${config.dbUser}:${config.dbPassword}@localhost:${config.dbPort}/${config.dbName}`,
    '',
    '# ─── Redis ────────────────────────────────────────────────────────────',
    `REDIS_PASSWORD=${config.redisPassword}`,
    `REDIS_URL=redis://${config.redisPassword ? `:${config.redisPassword}@` : ''}localhost:${config.redisPort}`,
    '',
    '# ─── Clerk Authentication ─────────────────────────────────────────────',
    `CLERK_PUBLISHABLE_KEY=${config.clerkPublishableKey}`,
    `CLERK_SECRET_KEY=${config.clerkSecretKey}`,
    '',
    '# ─── Application ──────────────────────────────────────────────────────',
    `NODE_ENV=${config.nodeEnv}`,
    `API_PORT=${config.apiPort}`,
    `CORS_ORIGIN=https://${config.domain}`,
    `NEXT_PUBLIC_API_URL=https://${config.apiSubdomain}.${config.domain}`,
    `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${config.clerkPublishableKey}`,
    `ADMIN_EMAIL=${config.adminEmail}`,
    `LOG_LEVEL=${config.logLevel}`,
  ];

  if (config.sentryDsn) {
    lines.push('', '# ─── Monitoring ───────────────────────────────────────────────────────');
    lines.push(`SENTRY_DSN=${config.sentryDsn}`);
  }

  if (config.enableMonitoring) {
    lines.push(`GRAFANA_PASSWORD=changeme_grafana_${Math.random().toString(36).slice(2, 10)}`);
  }

  lines.push('');
  return lines.join('\n');
}

export function generateDeployScript(config: DeploymentConfig): string {
  const isOnPrem = config.deploymentType === 'on-premise';

  return `#!/bin/bash
set -euo pipefail

# ─── Global Green Tax — Deployment Script ────────────────────────────
# Deployment: ${config.deploymentType.toUpperCase()}${config.provider ? ` (${config.provider.toUpperCase()})` : ''}
# Domain: ${config.domain}
# Generated: ${new Date().toISOString().split('T')[0]}

BOLD="\\033[1m"
GREEN="\\033[32m"
YELLOW="\\033[33m"
RED="\\033[31m"
RESET="\\033[0m"

log() { echo -e "\${GREEN}[GGT]\${RESET} $1"; }
warn() { echo -e "\${YELLOW}[WARN]\${RESET} $1"; }
err() { echo -e "\${RED}[ERROR]\${RESET} $1"; exit 1; }

# ─── Pre-flight checks ───────────────────────────────────────────────
log "Running pre-flight checks..."

command -v docker >/dev/null 2>&1 || err "Docker is not installed"
command -v docker compose >/dev/null 2>&1 || err "Docker Compose is not installed"
${isOnPrem ? `
# Check system resources
TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_MEM" -lt 4096 ]; then
  warn "Less than 4GB RAM detected ($TOTAL_MEM MB). Recommended: 8GB+"
fi

DISK_FREE=$(df -BG / | awk 'NR==2{print $4}' | tr -d 'G')
if [ "$DISK_FREE" -lt 20 ]; then
  warn "Less than 20GB free disk space ($DISK_FREE GB). Recommended: 50GB+"
fi` : ''}

# ─── Load environment ────────────────────────────────────────────────
if [ ! -f .env ]; then
  err ".env file not found. Please create it from .env.example"
fi

log "Loading environment variables..."
set -a && source .env && set +a

# Verify critical variables
[ -z "\${DB_PASSWORD:-}" ] && err "DB_PASSWORD is not set in .env"
[ -z "\${CLERK_SECRET_KEY:-}" ] && err "CLERK_SECRET_KEY is not set in .env"
[ -z "\${CLERK_PUBLISHABLE_KEY:-}" ] && err "CLERK_PUBLISHABLE_KEY is not set in .env"

# ─── Build & Deploy ──────────────────────────────────────────────────
log "Building containers..."
docker compose build --no-cache

log "Starting infrastructure (PostgreSQL + Redis)..."
docker compose up -d postgres redis
sleep 5

log "Waiting for PostgreSQL to be ready..."
until docker compose exec postgres pg_isready -U ${config.dbUser} -d ${config.dbName}; do
  sleep 2
done

log "Running database migrations..."
docker compose exec api npx prisma migrate deploy

log "Seeding database..."
docker compose exec api npx prisma db seed

log "Starting all services..."
docker compose up -d

# ─── Health check ─────────────────────────────────────────────────────
log "Performing health checks..."
sleep 10

API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${config.apiPort}/health || echo "000")
if [ "$API_STATUS" = "200" ]; then
  log "API is healthy (HTTP 200)"
else
  warn "API returned HTTP $API_STATUS — check logs: docker compose logs api"
fi

# ─── Summary ──────────────────────────────────────────────────────────
echo ""
echo -e "\${BOLD}\${GREEN}═══════════════════════════════════════════════════\${RESET}"
echo -e "\${BOLD}  Global Green Tax — Deployment Complete\${RESET}"
echo -e "\${BOLD}\${GREEN}═══════════════════════════════════════════════════\${RESET}"
echo ""
echo -e "  Web:      \${BOLD}https://${config.domain}\${RESET}"
echo -e "  API:      \${BOLD}https://${config.apiSubdomain}.${config.domain}\${RESET}"
${config.enableMonitoring ? `echo -e "  Grafana:  \\${BOLD}https://monitoring.${config.domain}\\${RESET}"` : ''}
echo ""
echo -e "  Logs:     docker compose logs -f"
echo -e "  Stop:     docker compose down"
echo -e "  Restart:  docker compose restart"
echo ""
`;
}

export function generateNginxConfig(config: DeploymentConfig): string {
  return `# ─── Global Green Tax — Nginx Configuration (On-Premise) ─────────────
# Use this if you prefer Nginx over Traefik

upstream ggt_api {
    server 127.0.0.1:${config.apiPort};
}

upstream ggt_web {
    server 127.0.0.1:${config.webPort};
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name ${config.domain} ${config.apiSubdomain}.${config.domain};
    return 301 https://$host$request_uri;
}

# Web frontend
server {
    listen 443 ssl http2;
    server_name ${config.domain};

    ssl_certificate     /etc/ssl/certs/${config.domain}.pem;
    ssl_certificate_key /etc/ssl/private/${config.domain}.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://ggt_web;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# API backend
server {
    listen 443 ssl http2;
    server_name ${config.apiSubdomain}.${config.domain};

    ssl_certificate     /etc/ssl/certs/${config.domain}.pem;
    ssl_certificate_key /etc/ssl/private/${config.domain}.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # API rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;

    location / {
        limit_req zone=api_limit burst=50 nodelay;

        proxy_pass http://ggt_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://ggt_api/health;
        access_log off;
    }
}
`;
}
