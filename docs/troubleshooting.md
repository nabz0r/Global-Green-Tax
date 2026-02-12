# Troubleshooting Guide

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Installation Issues](#installation-issues)
- [Database Issues](#database-issues)
- [Authentication Issues](#authentication-issues)
- [Engine Calculation Issues](#engine-calculation-issues)
- [Frontend Issues](#frontend-issues)
- [PDF Export Issues](#pdf-export-issues)
- [Docker Issues](#docker-issues)
- [Performance Issues](#performance-issues)
- [Common Error Messages](#common-error-messages)

---

## Quick Diagnostics

Run this checklist when something is wrong:

```mermaid
flowchart TD
    START["Something broken?"] --> CHECK1{"Node.js >= 20?"}
    CHECK1 -->|No| FIX1["Install Node 20+<br/>nvm install 20"]
    CHECK1 -->|Yes| CHECK2{"npm install<br/>succeeded?"}
    CHECK2 -->|No| FIX2["rm -rf node_modules<br/>npm install"]
    CHECK2 -->|Yes| CHECK3{"Database running?"}
    CHECK3 -->|No| FIX3["docker compose up -d postgres redis"]
    CHECK3 -->|Yes| CHECK4{"Prisma generated?"}
    CHECK4 -->|No| FIX4["npm run db:generate<br/>npm run db:push"]
    CHECK4 -->|Yes| CHECK5{".env files set?"}
    CHECK5 -->|No| FIX5["Copy .env.example<br/>Set variables"]
    CHECK5 -->|Yes| CHECK6{"Tests pass?"}
    CHECK6 -->|No| FIX6["See Engine Issues"]
    CHECK6 -->|Yes| OK["System healthy"]
```

---

## Installation Issues

### `npm install` fails with workspace errors

**Symptom:** Errors about missing workspace packages or version conflicts.

**Solution:**
```bash
# Clean everything
rm -rf node_modules apps/*/node_modules packages/*/node_modules
rm package-lock.json

# Reinstall
npm install
```

### `Cannot find module '@ggt/shared'`

**Symptom:** TypeScript or runtime errors about missing workspace packages.

**Cause:** Workspace packages haven't been built yet.

**Solution:**
```bash
# Build all packages in dependency order
npx turbo build
```

### Node.js version mismatch

**Symptom:** Syntax errors or API incompatibilities.

**Solution:**
```bash
# Check version
node --version  # Should be >= 20.0.0

# Use nvm to switch
nvm install 20
nvm use 20
```

---

## Database Issues

### `P1001: Can't reach database server`

**Symptom:** Prisma can't connect to PostgreSQL.

**Diagnosis:**
```bash
# Check if PostgreSQL is running
docker compose ps postgres

# Check connection
docker compose exec postgres pg_isready -U ggt_user

# Check logs
docker compose logs postgres
```

**Solutions:**

1. Start the database:
   ```bash
   docker compose up -d postgres
   ```

2. Check `DATABASE_URL` in `apps/api/.env`:
   ```
   DATABASE_URL="postgresql://ggt_user:ggt_secure_password_2026@localhost:5432/global_green_tax"
   ```

3. If port 5432 is taken:
   ```bash
   # Check what's using the port
   lsof -i :5432

   # Or change the port in docker-compose.yml
   ports:
     - "5433:5432"
   ```

### `P2002: Unique constraint failed`

**Symptom:** Seed script fails on re-run.

**Cause:** The seed uses `upsert`, but if the schema changed, old data may conflict.

**Solution:**
```bash
# Reset database completely
npx -w apps/api prisma db push --force-reset

# Re-seed
npx -w apps/api prisma db seed
```

### `P2021: Table does not exist`

**Symptom:** Runtime errors about missing tables.

**Solution:**
```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push
```

### Prisma client version mismatch

**Symptom:** `@prisma/client` version differs from `prisma` CLI.

**Solution:**
```bash
npm run db:generate
```

---

## Authentication Issues

### `401 Unauthorized` on all API requests

**Diagnosis flow:**

```mermaid
flowchart TD
    E401["401 Unauthorized"] --> Q1{"Authorization header<br/>present?"}
    Q1 -->|No| F1["Add Bearer token<br/>from Clerk useAuth()"]
    Q1 -->|Yes| Q2{"Token format<br/>Bearer xxx?"}
    Q2 -->|No| F2["Fix header format:<br/>Authorization: Bearer <token>"]
    Q2 -->|Yes| Q3{"CLERK_SECRET_KEY<br/>set in API .env?"}
    Q3 -->|No| F3["Add CLERK_SECRET_KEY<br/>to apps/api/.env"]
    Q3 -->|Yes| Q4{"Keys match<br/>pub/secret pair?"}
    Q4 -->|No| F4["Use matching key pair<br/>from Clerk dashboard"]
    Q4 -->|Yes| F5["Token may be expired<br/>Refresh from client"]
```

**Common fixes:**

1. Check Clerk keys match between frontend and API:
   ```bash
   # Frontend
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

   # API (must be from same Clerk app)
   CLERK_SECRET_KEY=sk_test_...
   ```

2. In development, ensure Clerk is configured for `localhost:3000`

### `403 Forbidden` - User not in organization

**Cause:** The authenticated user has no `Organization` record in the database.

**Solution:**
```bash
# Check if user exists
npx -w apps/api prisma studio
# Navigate to User table, check organizationId
```

Or seed the demo data:
```bash
npx -w apps/api prisma db seed
```

---

## Engine Calculation Issues

### `Unsupported jurisdiction: XX:2026`

**Cause:** No strategy registered for that country/year combination.

**Solution:**

1. Check registered strategies:
   ```typescript
   // In tax.service.ts
   console.log(registry.listRegistered());
   // Should show: ['LU:2026', 'FR:2026']
   ```

2. Ensure the strategy is registered:
   ```typescript
   registry.register(new Luxembourg2026Strategy());
   registry.register(new France2026Strategy());
   ```

### Calculation returns unexpected amounts

**Diagnosis:**

1. Check the input values (especially `metadata` fields)
2. Run the engine test suite:
   ```bash
   npm test -- --filter=@ggt/engine
   ```
3. Compare with the data schema (`data/schemas/XX-2026.json`)

### Tests failing for a strategy

```bash
# Run specific test file
npx -w packages/engine vitest run src/__tests__/france-2026.test.ts

# Run in watch mode for debugging
npx -w packages/engine vitest src/__tests__/france-2026.test.ts
```

**Common test failures:**

| Issue | Likely Cause |
|-------|-------------|
| CCE amount wrong | Check `cceRatePerTonne` (should be 44.60 for France) |
| IS amount wrong | Check PME threshold logic (42,500 EUR) |
| PV prime wrong | Check tier boundaries (9/36/100 kWp) |
| ADEME returns 0 | Enterprise may be classified as LARGE (>250 emp or >50M) |

---

## Frontend Issues

### Sliders not updating results

**Cause:** The `useMemo` dependency array may be missing a variable.

**Check:** Ensure all form state variables are in the dependency array of `lineItems`:
```typescript
[countryCode, co2Tonnes, revenue, employeeCount, enterpriseType,
 solarKWp, selfConsumption, evCount, evConsumption, evCountVans,
 wallboxCount, smartCharging, auditExpense, isLU]
```

### `simulateLocally()` returns empty array

**Cause:** Country code not recognized in the switch statement.

**Check `engine-client.ts`:**
```typescript
switch (params.countryCode) {
  case 'LU': return simulateLuxembourg(params);
  case 'FR': return simulateFrance(params);
  default:   return []; // <-- Unknown country
}
```

### Clerk sign-in page not showing

**Check:**
1. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set in `apps/web/.env.local`
2. Clerk middleware is configured in `apps/web/src/middleware.ts`
3. Sign-in route matches: `/sign-in`

### Hydration errors

**Symptom:** React hydration mismatch warnings in console.

**Common causes:**
- Browser extensions injecting elements
- `toLocaleString()` formatting differs between server and client

**Fix:** Wrap locale-dependent formatting in `useEffect` or use consistent formatting.

---

## PDF Export Issues

### "Exporter PDF" button stays in loading state

**Diagnosis:**

```mermaid
flowchart TD
    STUCK["Button stuck loading"] --> Q1{"Open browser console"}
    Q1 --> Q2{"Error visible?"}
    Q2 -->|"Module not found"| F1["npm install @react-pdf/renderer"]
    Q2 -->|"Worker error"| F2["Check CSP headers<br/>allow blob: URLs"]
    Q2 -->|"Rendering error"| F3["Check lineItems<br/>are not empty"]
    Q2 -->|No error| F4["Increase timeout<br/>PDF may be generating"]
```

**Common fixes:**

1. Missing dependency:
   ```bash
   cd apps/web && npm install @react-pdf/renderer
   ```

2. Empty line items:
   - Ensure form fields have non-zero values
   - Check the `disabled` condition: `exporting || lineItems.length === 0`

### PDF renders blank pages

**Cause:** react-pdf styles use absolute positioning that may overflow.

**Fix:** Check that `ReportData` is passed correctly with all required fields.

### Fonts not rendering in PDF

**Note:** The PDF uses built-in Helvetica (always available in @react-pdf/renderer). If you add custom fonts, register them:

```typescript
import { Font } from '@react-pdf/renderer';
Font.register({
  family: 'CustomFont',
  src: '/path/to/font.ttf',
});
```

---

## Docker Issues

### `docker compose up` fails to build

**Common causes:**

1. **Docker not running:**
   ```bash
   docker info  # Should show Docker details
   ```

2. **Dockerfile context wrong:**
   ```bash
   # Build from project root
   docker compose up --build
   ```

3. **npm install fails in container:**
   ```bash
   # Clear Docker build cache
   docker builder prune
   docker compose build --no-cache
   ```

### Container can't reach database

**Cause:** Docker networking - containers must use service names, not `localhost`.

**Fix in container env:**
```bash
# Wrong (from inside container):
DATABASE_URL="postgresql://user:pass@localhost:5432/db"

# Correct (use Docker service name):
DATABASE_URL="postgresql://user:pass@postgres:5432/db"
```

### Redis connection refused

```bash
# Check Redis is running
docker compose ps redis

# Check Redis health
docker compose exec redis redis-cli ping
# Should return: PONG

# Check Redis memory
docker compose exec redis redis-cli info memory
```

### Traefik not routing properly

```bash
# Check Traefik dashboard
open http://localhost:8080/dashboard/

# Check service discovery
docker compose exec traefik traefik healthcheck

# Verify labels on services
docker compose config | grep traefik
```

---

## Performance Issues

### Slow calculation responses

```mermaid
flowchart TD
    SLOW["Slow response"] --> Q1{"Is it cached?"}
    Q1 -->|No| F1["First request is cold<br/>Redis caches subsequent"]
    Q1 -->|Yes| Q2{"Redis connected?"}
    Q2 -->|No| F2["Check REDIS_URL<br/>docker compose ps redis"]
    Q2 -->|Yes| Q3{"Database slow?"}
    Q3 -->|Yes| F3["Check DB connections<br/>Add indexes if needed"]
    Q3 -->|No| F4["Engine calc is CPU-bound<br/>Consider horizontal scaling"]
```

**Optimization tips:**

1. **Redis cache hit ratio:**
   ```bash
   docker compose exec redis redis-cli info stats | grep hit
   ```

2. **Database connection pooling:** Prisma defaults to 5 connections. Increase for production:
   ```
   DATABASE_URL="postgresql://...?connection_limit=20"
   ```

3. **Horizontal scaling:**
   ```bash
   docker compose up -d --scale api=3
   ```

### Frontend slow with many sliders

The client-side engine runs synchronously in `useMemo`. If calculations become heavy:

1. Consider `useTransition` for non-urgent updates
2. Debounce slider onChange events
3. Use `Web Workers` for calculation offloading

---

## Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot find module '@ggt/shared'` | Packages not built | `npx turbo build` |
| `P1001: Can't reach database` | PostgreSQL down | `docker compose up -d postgres` |
| `401 Unauthorized` | Missing/invalid JWT | Check Clerk keys |
| `Unsupported jurisdiction` | Strategy not registered | Register in TaxService |
| `ECONNREFUSED :6379` | Redis not running | `docker compose up -d redis` |
| `Zod validation failed` | Invalid input | Check request body fields |
| `EADDRINUSE :4000` | Port already taken | Kill existing process or change port |
| `Module not found: @react-pdf/renderer` | Missing dependency | `cd apps/web && npm install @react-pdf/renderer` |
| `ERR_MODULE_NOT_FOUND` | ESM/CJS mismatch | Check `tsconfig.json` module setting |
| `PrismaClientInitializationError` | DB URL wrong | Check `DATABASE_URL` format |

---

## Getting Help

If you're stuck:

1. Check the [Architecture Guide](./architecture.md) for system design context
2. Check the [API Reference](./api.md) for endpoint details
3. Run the test suite to verify engine correctness: `npm test`
4. Check Docker logs: `docker compose logs -f`
5. Open Prisma Studio for database inspection: `npx -w apps/api prisma studio`
