# Deployment Guide

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Docker Compose (Production)](#docker-compose-production)
- [Cloud Deployment](#cloud-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Database Operations](#database-operations)
- [SSL & Domain Configuration](#ssl--domain-configuration)
- [Monitoring](#monitoring)

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | >= 20.0.0 | Runtime |
| npm | >= 10.8.0 | Package manager |
| Docker | >= 24.0 | Containerization |
| Docker Compose | >= 2.20 | Multi-container orchestration |
| Git | >= 2.40 | Version control |

---

## Environment Variables

### API (`apps/api/.env`)

```bash
# Database
DATABASE_URL="postgresql://ggt_user:ggt_secure_password_2026@localhost:5432/global_green_tax"

# Redis
REDIS_URL="redis://localhost:6379"

# Authentication (Clerk)
CLERK_SECRET_KEY="sk_live_..."

# CORS
CORS_ORIGIN="https://your-domain.com"

# Server
API_PORT=4000
NODE_ENV=production
```

### Web (`apps/web/.env.local`)

```bash
# API
NEXT_PUBLIC_API_URL="https://api.your-domain.com"

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
CLERK_SECRET_KEY="sk_live_..."

# Next.js
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/dashboard"
```

### Docker Compose (`.env` at root)

```bash
# PostgreSQL
POSTGRES_USER=ggt_user
POSTGRES_PASSWORD=ggt_secure_password_2026
POSTGRES_DB=global_green_tax

# Domain
DOMAIN=your-domain.com
ACME_EMAIL=admin@your-domain.com

# Clerk
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
```

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Start infrastructure

```bash
docker compose up -d postgres redis
```

### 3. Initialize database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed with demo data (LU + FR)
npx -w apps/api prisma db seed
```

### 4. Start development servers

```bash
npm run dev
```

This starts both services via Turborepo:
- **API**: http://localhost:4000
- **Web**: http://localhost:3000

### 5. Run tests

```bash
npm test
```

### Development Architecture

```mermaid
graph LR
    subgraph Local
        DEV["npm run dev<br/>Turborepo"]
        DEV --> API["NestJS<br/>:4000"]
        DEV --> WEB["Next.js<br/>:3000"]
    end

    subgraph Docker
        PG["PostgreSQL<br/>:5432"]
        RD["Redis<br/>:6379"]
    end

    API --> PG
    API --> RD
    WEB -->|API calls| API
```

---

## Docker Compose (Production)

### Full Stack Deployment

```mermaid
graph TB
    Internet["Internet<br/>:80 / :443"] --> Traefik

    subgraph Docker["Docker Compose"]
        Traefik["Traefik v3<br/>SSL + Routing"]
        Traefik -->|"/api/*"| API["NestJS API<br/>:4000"]
        Traefik -->|"/*"| WEB["Next.js Web<br/>:3000"]
        API --> PG["PostgreSQL 16<br/>:5432"]
        API --> RD["Redis 7<br/>:6379"]
    end

    subgraph Volumes
        PG_DATA["ggt_postgres_data"]
        RD_DATA["ggt_redis_data"]
    end

    PG --> PG_DATA
    RD --> RD_DATA
```

### Deploy

```bash
# Build and start all services
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f api
docker compose logs -f web

# Run database migrations
docker compose exec api npx prisma db push
docker compose exec api npx prisma db seed
```

### Service Configuration

| Service | Image | Ports | Health Check |
|---------|-------|-------|-------------|
| `postgres` | postgres:16-alpine | 5432 | `pg_isready` |
| `redis` | redis:7-alpine | 6379 | `redis-cli ping` |
| `traefik` | traefik:v3.1 | 80, 443, 8080 | Dashboard |
| `api` | Custom (Dockerfile) | 4000 | - |
| `web` | Custom (Dockerfile) | 3000 | - |

### Docker Build Process

```mermaid
flowchart TD
    subgraph API["API Build (Multi-stage)"]
        A1["base: node:20-alpine"] --> A2["deps: npm ci"]
        A2 --> A3["builder: turbo build<br/>--filter=@ggt/api"]
        A3 --> A4["runner: copy dist +<br/>prisma + node_modules"]
    end

    subgraph Web["Web Build (Multi-stage)"]
        W1["base: node:20-alpine"] --> W2["deps: npm ci"]
        W2 --> W3["builder: next build<br/>standalone output"]
        W3 --> W4["runner: copy .next/standalone<br/>+ .next/static + public"]
    end
```

### Scaling

```bash
# Scale API horizontally
docker compose up -d --scale api=3

# Traefik auto-discovers and load-balances
```

---

## Cloud Deployment

### AWS (ECS + RDS + ElastiCache)

```mermaid
graph TB
    ALB["Application Load Balancer"] --> ECS_API["ECS Service: API<br/>Fargate"]
    ALB --> ECS_WEB["ECS Service: Web<br/>Fargate"]
    ECS_API --> RDS["RDS PostgreSQL 16<br/>Multi-AZ"]
    ECS_API --> EC["ElastiCache Redis 7<br/>Cluster Mode"]

    ECR["ECR Registry"] -.->|Pull| ECS_API
    ECR -.->|Pull| ECS_WEB
```

**Key resources:**
- ECS Fargate for serverless containers
- RDS PostgreSQL 16 with Multi-AZ failover
- ElastiCache Redis 7 for distributed caching
- ALB with ACM certificate for SSL
- ECR for private Docker image registry

### GCP (Cloud Run + Cloud SQL + Memorystore)

```mermaid
graph TB
    GLB["Cloud Load Balancer"] --> CR_API["Cloud Run: API"]
    GLB --> CR_WEB["Cloud Run: Web"]
    CR_API --> SQL["Cloud SQL<br/>PostgreSQL 16"]
    CR_API --> MEM["Memorystore<br/>Redis 7"]

    GAR["Artifact Registry"] -.->|Pull| CR_API
    GAR -.->|Pull| CR_WEB
```

### Digital Ocean (App Platform)

```yaml
# .do/app.yaml
name: global-green-tax
services:
  - name: api
    dockerfile_path: apps/api/Dockerfile
    http_port: 4000
    envs:
      - key: DATABASE_URL
        scope: RUN_TIME
        value: ${db.DATABASE_URL}
  - name: web
    dockerfile_path: apps/web/Dockerfile
    http_port: 3000
databases:
  - name: db
    engine: PG
    version: "16"
```

---

## CI/CD Pipeline

### GitHub Actions Example

```mermaid
flowchart LR
    PUSH["Push to main"] --> LINT["Lint"]
    PUSH --> TEST["Test"]
    LINT --> BUILD["Build"]
    TEST --> BUILD
    BUILD --> DOCKER["Docker Build<br/>+ Push to Registry"]
    DOCKER --> DEPLOY["Deploy to<br/>ECS / Cloud Run"]
```

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build API image
        run: docker build -f apps/api/Dockerfile -t ggt-api .
      - name: Build Web image
        run: docker build -f apps/web/Dockerfile -t ggt-web .
      - name: Push to registry
        run: |
          docker tag ggt-api $REGISTRY/ggt-api:$GITHUB_SHA
          docker tag ggt-web $REGISTRY/ggt-web:$GITHUB_SHA
          docker push $REGISTRY/ggt-api:$GITHUB_SHA
          docker push $REGISTRY/ggt-web:$GITHUB_SHA
      - name: Deploy
        run: |
          # Update ECS service / Cloud Run / etc.
```

---

## Database Operations

### Prisma Commands

```bash
# Generate Prisma client (after schema changes)
npm run db:generate

# Push schema to database (development)
npm run db:push

# Create migration (production)
npm run db:migrate

# Seed database
npx -w apps/api prisma db seed

# Open Prisma Studio (visual editor)
npx -w apps/api prisma studio
```

### Backup & Restore

```bash
# Backup
docker compose exec postgres pg_dump -U ggt_user global_green_tax > backup.sql

# Restore
docker compose exec -T postgres psql -U ggt_user global_green_tax < backup.sql
```

### Migration Strategy

```mermaid
flowchart TD
    DEV["Development<br/>prisma db push"] -->|"Schema stable"| MIG["Create migration<br/>prisma migrate dev"]
    MIG --> REVIEW["Review SQL migration"]
    REVIEW --> STAGE["Apply to staging<br/>prisma migrate deploy"]
    STAGE --> PROD["Apply to production<br/>prisma migrate deploy"]
```

---

## SSL & Domain Configuration

### Traefik + Let's Encrypt (Automatic)

The `docker-compose.yml` includes Traefik v3 with automatic SSL:

```yaml
traefik:
  command:
    - --certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}
    - --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
    - --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
```

Traefik labels on services:

```yaml
labels:
  - "traefik.http.routers.api.rule=Host(`api.${DOMAIN}`)"
  - "traefik.http.routers.api.tls.certresolver=letsencrypt"
  - "traefik.http.routers.web.rule=Host(`${DOMAIN}`)"
  - "traefik.http.routers.web.tls.certresolver=letsencrypt"
```

### DNS Configuration

```
A     your-domain.com        -> server IP
A     api.your-domain.com    -> server IP
```

---

## Monitoring

### Health Checks

```bash
# PostgreSQL
docker compose exec postgres pg_isready -U ggt_user

# Redis
docker compose exec redis redis-cli ping

# API
curl http://localhost:4000/api/v1/tax/history \
  -H "Authorization: Bearer $JWT"

# Traefik Dashboard
http://localhost:8080/dashboard/
```

### Logging

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api --tail 100

# API with timestamps
docker compose logs -f --timestamps api
```

### Resource Limits (Recommended)

| Service | CPU | Memory |
|---------|-----|--------|
| API | 1 core | 512MB |
| Web | 0.5 core | 256MB |
| PostgreSQL | 2 cores | 1GB |
| Redis | 0.5 core | 256MB |
| Traefik | 0.25 core | 128MB |
