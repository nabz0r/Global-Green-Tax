# Architecture Guide

## Table of Contents

- [System Overview](#system-overview)
- [Economic Model](#economic-model)
- [Monorepo Structure](#monorepo-structure)
- [Calculation Engine](#calculation-engine)
- [Strategy Pattern](#strategy-pattern)
- [Data Flow](#data-flow)
- [Multi-Tenancy](#multi-tenancy)
- [Subscription & Quota Management](#subscription--quota-management)
- [Authentication & Authorization](#authentication--authorization)
- [Caching Strategy](#caching-strategy)
- [Client-Side Engine](#client-side-engine)
- [PDF Report Generation](#pdf-report-generation)
- [Adding a New Jurisdiction](#adding-a-new-jurisdiction)

---

## System Overview

Global Green Tax is a SaaS platform that calculates carbon taxes and green subsidies across multiple jurisdictions. The system follows a **Strategy Pattern** where each country/year combination is an independent, pluggable module.

```mermaid
graph TB
    subgraph Clients
        Browser[Browser]
        Mobile[Mobile App]
        ExtAPI[External API Client]
    end

    subgraph Edge["Reverse Proxy"]
        Traefik[Traefik v3<br/>SSL Termination<br/>Let's Encrypt]
    end

    subgraph Frontend["Next.js 15 — Port 3000"]
        SSR[Server-Side Rendering]
        CSR[Client Components]
        CLERK_MW[Clerk Middleware<br/>Route Protection]
    end

    subgraph Backend["NestJS — Port 4000"]
        direction TB
        CTRL[TaxController<br/>api/v1/tax/*]
        AUTH_G[ClerkAuthGuard<br/>JWT Verification]
        TENANT_G[TenantGuard<br/>Org Resolution]
        ZOD_P[ZodValidationPipe<br/>Input Validation]
        SVC[TaxService<br/>Orchestration]
    end

    subgraph EngineCore["@ggt/engine"]
        ENG[GreenTaxEngine]
        REG[StrategyRegistry]
        LU[Luxembourg2026]
        FR[France2026]
        FUT[Future...]
    end

    subgraph Storage
        PG[(PostgreSQL 16<br/>JSONB)]
        RD[(Redis 7<br/>LRU 256MB)]
    end

    Browser --> Traefik
    Mobile --> Traefik
    ExtAPI --> Traefik
    Traefik --> Frontend
    Traefik --> Backend

    Frontend --> Backend
    CTRL --> AUTH_G --> TENANT_G --> ZOD_P --> SVC
    SVC --> ENG
    ENG --> REG --> LU & FR & FUT
    SVC --> PG
    SVC --> RD
```

---

## Economic Model

Global Green Tax follows a **tiered SaaS subscription model** with three plans designed to capture value across the full spectrum of enterprise sizes.

### Plan Comparison

```mermaid
graph TD
    subgraph Starter["🟢 Starter — 99 €/mois"]
        S1["Target: PME / SMEs"]
        S2["1 juridiction"]
        S3["5 simulations/mois"]
        S4["5 exports PDF/mois"]
        S5["2 utilisateurs"]
        S6["Support email"]
    end

    subgraph Professional["🔵 Professional — 499 €/mois"]
        P1["Target: Fiduciaires & Comptables"]
        P2["Toutes juridictions"]
        P3["Simulations illimitées"]
        P4["Export PDF illimité"]
        P5["10 utilisateurs"]
        P6["White-label: PDF & portail"]
        P7["API REST"]
        P8["Support prioritaire + chat"]
        P9["SLA 99.5%"]
    end

    subgraph Enterprise["🟡 Enterprise — Sur mesure"]
        E1["Target: Grands groupes"]
        E2["Toutes juridictions"]
        E3["Simulations illimitées"]
        E4["White-label complet"]
        E5["API REST + Webhooks + SDK"]
        E6["SSO SAML / OIDC"]
        E7["Déploiement On-Premise"]
        E8["Utilisateurs illimités"]
        E9["CSM dédié"]
        E10["SLA 99.9%"]
    end

    Starter -->|"Upsell: multi-pays, API"| Professional
    Professional -->|"Upsell: SSO, on-prem"| Enterprise
```

### Detailed Feature Matrix

| Feature | Starter (99 €/mois) | Professional (499 €/mois) | Enterprise (Custom) |
|---------|---------------------|---------------------------|---------------------|
| **Jurisdictions** | 1 pays | Tous les pays | Tous les pays |
| **Simulations** | 5 / mois | Illimité | Illimité |
| **Export PDF** | 5 / mois | Illimité | Illimité |
| **Utilisateurs** | 2 sièges | 10 sièges | Illimité |
| **White-label** | — | PDF & portail brandé | White-label complet |
| **API Access** | — | REST API | REST + Webhooks + SDK |
| **SSO** | — | — | SAML / OIDC |
| **Support** | Email (48h) | Email + chat prioritaire | CSM dédié |
| **SLA** | — | 99.5% uptime | 99.9% + SLA custom |
| **Déploiement** | Cloud mutualisé | Cloud | Cloud / On-premise |
| **Historique** | 3 mois | 24 mois | Illimité |
| **Audit trail** | — | Logs d'accès | Logs complets + SIEM |

### Subscription Lifecycle

```mermaid
stateDiagram-v2
    [*] --> TRIAL: Inscription
    TRIAL --> STARTER: Souscription
    TRIAL --> EXPIRED: 14 jours sans paiement
    EXPIRED --> STARTER: Paiement tardif

    STARTER --> PROFESSIONAL: Upgrade
    STARTER --> CHURNED: Annulation

    PROFESSIONAL --> ENTERPRISE: Upgrade
    PROFESSIONAL --> STARTER: Downgrade
    PROFESSIONAL --> CHURNED: Annulation

    ENTERPRISE --> PROFESSIONAL: Downgrade
    ENTERPRISE --> CHURNED: Annulation

    CHURNED --> STARTER: Réactivation
    CHURNED --> [*]
```

### Quota Enforcement Architecture

The platform enforces subscription quotas via a `SubscriptionGuard` in the NestJS API pipeline:

```mermaid
sequenceDiagram
    participant Client
    participant AuthGuard as ClerkAuthGuard
    participant TenantGuard
    participant SubGuard as SubscriptionGuard
    participant SubService as SubscriptionService
    participant DB as PostgreSQL
    participant Controller

    Client->>AuthGuard: Request + JWT
    AuthGuard->>TenantGuard: userId verified
    TenantGuard->>SubGuard: tenant context attached
    SubGuard->>SubService: checkQuota(orgId, action)
    SubService->>DB: SELECT plan, usage, period
    DB-->>SubService: Plan limits + current usage

    alt Within quota
        SubService-->>SubGuard: ✅ Allowed
        SubGuard->>Controller: Proceed
        Controller-->>Client: 200 OK
        SubService->>DB: INCREMENT usage counter
    else Quota exceeded
        SubService-->>SubGuard: ❌ Exceeded
        SubGuard-->>Client: 402 Payment Required
        Note over Client: { error, currentUsage, limit, upgradeUrl }
    end
```

### Revenue Model

```mermaid
pie title Répartition MRR cible (Year 2)
    "Starter (60% clients)" : 35
    "Professional (30% clients)" : 45
    "Enterprise (10% clients)" : 20
```

| Metric | Target |
|--------|--------|
| **MRR per Starter** | 99 € |
| **MRR per Professional** | 499 € |
| **ACV Enterprise** | 15 000 – 50 000 € |
| **Taux de churn** | < 5% mensuel |
| **Ratio LTV/CAC** | > 3:1 |
| **Marge brute** | > 85% (pure SaaS) |
| **Conversion trial → paid** | > 15% |

---

## Monorepo Structure

The project uses **Turborepo** with npm workspaces for build orchestration:

```mermaid
graph LR
    subgraph Workspaces
        direction TB
        API["@ggt/api<br/>apps/api"]
        WEB["@ggt/web<br/>apps/web"]
        ENGINE["@ggt/engine<br/>packages/engine"]
        SHARED["@ggt/shared<br/>packages/shared"]
        UI_PKG["@ggt/ui<br/>packages/ui"]
    end

    API --> ENGINE
    API --> SHARED
    WEB --> SHARED
    WEB --> UI_PKG
    ENGINE --> SHARED

    style API fill:#e3f2fd
    style WEB fill:#e8f5e9
    style ENGINE fill:#fff3e0
    style SHARED fill:#f3e5f5
    style UI_PKG fill:#fce4ec
```

### Turborepo Pipeline

```mermaid
graph LR
    shared_build["@ggt/shared<br/>build"] --> engine_build["@ggt/engine<br/>build"]
    shared_build --> api_build["@ggt/api<br/>build"]
    shared_build --> web_build["@ggt/web<br/>build"]
    engine_build --> api_build

    engine_build --> test["@ggt/engine<br/>test"]

    style shared_build fill:#f3e5f5
    style engine_build fill:#fff3e0
    style api_build fill:#e3f2fd
    style web_build fill:#e8f5e9
    style test fill:#fff9c4
```

**Key packages:**

| Package | Role | Dependencies |
|---------|------|-------------|
| `@ggt/shared` | Types, Zod schemas, enums | None |
| `@ggt/engine` | Calculation engine, strategies | `@ggt/shared` |
| `@ggt/api` | REST API, auth, DB, cache | `@ggt/engine`, `@ggt/shared` |
| `@ggt/web` | Frontend, simulation UI, PDF | `@ggt/shared` |
| `@ggt/ui` | Shared UI utilities | None |

---

## Calculation Engine

The engine is a pure TypeScript package with zero framework dependencies. This enables it to run server-side (NestJS) and client-side (browser) identically.

```mermaid
flowchart TD
    INPUT["CalculationInput"] --> VALIDATE["Zod Validation<br/>CalculationInputSchema"]
    VALIDATE -->|Invalid| ERROR["Throw ValidationError"]
    VALIDATE -->|Valid| RESOLVE["Resolve Strategy<br/>registry.get(countryCode, fiscalYear)"]
    RESOLVE -->|Not Found| ERROR2["Throw UnsupportedJurisdiction"]
    RESOLVE -->|Found| CUSTOM_VALIDATE["strategy.validateInput()<br/>(optional)"]
    CUSTOM_VALIDATE --> CALC["strategy.calculate(input)"]
    CALC --> ITEMS["CalculationLineItem[]"]
    ITEMS --> AGGREGATE["Compute netAmount<br/>sum(lineItems.amount)"]
    AGGREGATE --> RESULT["CalculationResult<br/>lineItems + netAmount + metadata"]

    style INPUT fill:#e3f2fd
    style RESULT fill:#e8f5e9
    style ERROR fill:#ffcdd2
    style ERROR2 fill:#ffcdd2
```

### Line Item Convention

Every calculation produces an array of `CalculationLineItem`:

| Field | Description |
|-------|-------------|
| `code` | Unique identifier (e.g., `FR-CCE-2026`) |
| `label` | Human-readable name |
| `amount` | **Positive** = subsidy/credit, **Negative** = tax/levy |
| `currency` | ISO 4217 code |
| `description` | Calculation breakdown |
| `legalReference` | Legal basis (optional) |

---

## Strategy Pattern

Each jurisdiction implements the `JurisdictionStrategy` interface:

```typescript
interface JurisdictionStrategy {
  readonly countryCode: string;
  readonly name: string;
  readonly fiscalYear: number;
  readonly currency: CurrencyCode;
  calculate(input: CalculationInput): Promise<CalculationLineItem[]>;
  validateInput?(input: CalculationInput): void;
}
```

### Strategy Registry

Strategies are stored in a map keyed by `{countryCode}:{fiscalYear}`:

```mermaid
flowchart LR
    REG["StrategyRegistry"]
    REG -->|"LU:2026"| LU["Luxembourg2026Strategy"]
    REG -->|"FR:2026"| FR["France2026Strategy"]
    REG -->|"DE:2026"| DE["Germany2026Strategy<br/>(future)"]
    REG -->|"BE:2027"| BE["Belgium2027Strategy<br/>(future)"]
```

### Luxembourg 2026 Calculation Flow

```mermaid
flowchart TD
    INPUT[CalculationInput] --> CO2["calculateCO2Tax<br/>Progressive brackets<br/>45/65/85/120 EUR/t"]
    INPUT --> CORP["calculateCorporateTax<br/>~24.94% effective"]
    INPUT --> PV["calculateKlimabonusPV<br/>800 EUR/kWp, max 10k<br/>requires >= 50% self-consumption"]
    INPUT --> EV["calculateEVGrants<br/>6000/3000 EUR<br/>by consumption tier"]
    INPUT --> WB["calculateWallbox<br/>1200 + 450 smart"]
    INPUT --> F4S["calculateFit4Sustainability<br/>80/60/50% by size"]
    INPUT --> EN["calculateEnergySavings<br/>950 kWh/kWp"]

    CO2 --> MERGE["Merge line items"]
    CORP --> MERGE
    PV --> MERGE
    EV --> MERGE
    WB --> MERGE
    F4S --> MERGE
    EN --> MERGE

    style CO2 fill:#ffcdd2
    style CORP fill:#ffcdd2
    style PV fill:#c8e6c9
    style EV fill:#c8e6c9
    style WB fill:#c8e6c9
    style F4S fill:#c8e6c9
    style EN fill:#c8e6c9
```

### France 2026 Calculation Flow

```mermaid
flowchart TD
    INPUT[CalculationInput] --> CCE["calculateCCE<br/>Flat 44.60 EUR/t"]
    INPUT --> IS["calculateCorporateTax<br/>IS 25% or PME 15%<br/>+ CVAE 0.09%"]
    INPUT --> PVFR["calculatePrimeAutoconsommation<br/>Tiered: 80/140/70 EUR/kWp"]
    INPUT --> BONUS["calculateBonusEcologique<br/>VP 3000, VUL 4000 EUR"]
    INPUT --> ADEME["calculateAdemeTreemplin<br/>50/30% SME, max 200k"]
    INPUT --> ENFR["calculateEnergySavings<br/>1100 kWh/kWp"]

    CCE --> MERGE["Merge line items"]
    IS --> MERGE
    PVFR --> MERGE
    BONUS --> MERGE
    ADEME --> MERGE
    ENFR --> MERGE

    style CCE fill:#ffcdd2
    style IS fill:#ffcdd2
    style PVFR fill:#c8e6c9
    style BONUS fill:#c8e6c9
    style ADEME fill:#c8e6c9
    style ENFR fill:#c8e6c9
```

### Enterprise Size Classification

Both strategies classify organizations by size, affecting subsidy rates:

```mermaid
graph TD
    INPUT["employees, revenue"] --> CHECK1{"employees <= 50<br/>AND revenue <= 10M?"}
    CHECK1 -->|Yes| SMALL["SMALL_ENTERPRISE<br/>TPE/PE"]
    CHECK1 -->|No| CHECK2{"employees <= 250<br/>AND revenue <= 50M?"}
    CHECK2 -->|Yes| MEDIUM["MEDIUM_ENTERPRISE<br/>ME"]
    CHECK2 -->|No| LARGE["LARGE_ENTERPRISE<br/>GE"]

    style SMALL fill:#c8e6c9
    style MEDIUM fill:#fff9c4
    style LARGE fill:#ffcdd2
```

---

## Data Flow

### Calculation Pipeline (Server-Side)

```mermaid
sequenceDiagram
    participant Client
    participant Controller as TaxController
    participant Guard as Auth + Tenant Guards
    participant Zod as ZodValidationPipe
    participant Service as TaxService
    participant Cache as Redis
    participant Engine as GreenTaxEngine
    participant Strategy as JurisdictionStrategy
    participant DB as PostgreSQL

    Client->>Controller: POST /api/v1/tax/calculate
    Controller->>Guard: Authenticate + resolve tenant
    Guard->>Guard: Verify Clerk JWT
    Guard->>DB: Find user by clerkId
    Guard-->>Controller: tenant context
    Controller->>Zod: Validate request body
    Zod-->>Controller: Validated input
    Controller->>Service: calculate(orgId, country, input)
    Service->>Cache: getCachedResult(key)
    alt Cache Hit
        Cache-->>Service: CalculationResult
    else Cache Miss
        Service->>Engine: calculate(fullInput)
        Engine->>Engine: Zod validate
        Engine->>Strategy: resolve & calculate
        Strategy-->>Engine: LineItem[]
        Engine-->>Service: CalculationResult
        Service->>DB: Persist calculation
        Service->>Cache: Cache result (1h TTL)
    end
    Service-->>Controller: CalculationResult
    Controller-->>Client: JSON response
```

---

## Multi-Tenancy

The application implements **row-level multi-tenancy** through the `TenantGuard`:

```mermaid
flowchart TD
    REQ[HTTP Request] --> JWT["Extract Clerk JWT<br/>from Authorization header"]
    JWT --> VERIFY["Verify token<br/>with Clerk backend"]
    VERIFY --> LOOKUP["Query User by clerkId<br/>include Organization"]
    LOOKUP --> ATTACH["Attach to request:<br/>- userId<br/>- organizationId<br/>- countryCode<br/>- role"]
    ATTACH --> CTRL["Controller uses<br/>tenant.organizationId<br/>for all queries"]

    CTRL --> DB["All DB queries scoped<br/>WHERE organizationId = ?"]
```

### Role-Based Access

```mermaid
graph LR
    OWNER["OWNER<br/>Full access"] --> ADMIN["ADMIN<br/>Manage members"]
    ADMIN --> MEMBER["MEMBER<br/>Calculate + view"]
    MEMBER --> VIEWER["VIEWER<br/>View only"]
```

---

## Subscription & Quota Management

The `SubscriptionModule` manages plan assignments, usage tracking, and quota enforcement for all organizations.

### Data Model

```mermaid
erDiagram
    Plan ||--o{ Organization : "subscribed by"

    Plan {
        uuid id PK
        string name UK "STARTER|PROFESSIONAL|ENTERPRISE"
        int priceEuroCents "Monthly price in cents"
        int maxSimulationsPerMonth "null = unlimited"
        int maxPdfExportsPerMonth "null = unlimited"
        int maxCountries "null = unlimited"
        int maxUsers "null = unlimited"
        boolean whiteLabel
        boolean apiAccess
        boolean ssoEnabled
    }

    Organization {
        uuid id PK
        string planId FK
        int simulationsUsedThisMonth
        int pdfExportsUsedThisMonth
        datetime currentPeriodStart
    }
```

### SubscriptionService API

```typescript
class SubscriptionService {
  // Query
  getOrganizationPlan(orgId: string): Promise<PlanWithUsage>

  // Quota checks (called by guard)
  checkSimulationQuota(orgId: string): Promise<QuotaCheckResult>
  checkPdfExportQuota(orgId: string): Promise<QuotaCheckResult>

  // Usage tracking (called after successful action)
  incrementSimulationUsage(orgId: string): Promise<void>
  incrementPdfExportUsage(orgId: string): Promise<void>

  // Plan management
  changePlan(orgId: string, planName: string): Promise<Organization>
  resetMonthlyUsage(): Promise<void>  // CRON: 1st of each month
}
```

### Quota Reset Flow

```mermaid
flowchart LR
    CRON["CRON Job<br/>1er du mois, 00:00 UTC"] --> CHECK["Verify current period<br/>vs currentPeriodStart"]
    CHECK --> RESET["Reset counters:<br/>simulationsUsed = 0<br/>pdfExportsUsed = 0"]
    RESET --> UPDATE["Update<br/>currentPeriodStart"]
```

---

## Caching Strategy

```mermaid
flowchart LR
    KEY["Cache Key Format:<br/>calc:{orgId}:{country}:{year}"]
    TTL["TTL: 3600s (1 hour)"]
    EVICT["Eviction: allkeys-lru"]
    MAX["Max Memory: 256MB"]

    KEY --- TTL --- EVICT --- MAX
```

The `RedisService` provides:
- `buildCacheKey(orgId, countryCode, fiscalYear)` - Deterministic key generation
- `cacheResult(key, value, ttl)` - Store with TTL
- `getCachedResult<T>(key)` - Retrieve typed result
- `invalidate(key)` - Manual cache bust

---

## Client-Side Engine

The frontend includes a **mirror calculation engine** (`engine-client.ts`) that runs entirely in the browser for instant UI feedback:

```mermaid
flowchart LR
    SLIDER["User adjusts slider"] --> MEMO["useMemo triggers"]
    MEMO --> DISPATCH["simulateLocally(params)"]
    DISPATCH -->|"LU"| LU_CLIENT["simulateLuxembourg()"]
    DISPATCH -->|"FR"| FR_CLIENT["simulateFrance()"]
    LU_CLIENT --> ITEMS["LineItem[]"]
    FR_CLIENT --> ITEMS
    ITEMS --> CARD["ResultCard renders<br/>instantly"]
```

This dual-engine approach provides:
- **Zero latency** during parameter adjustment
- **No API calls** needed for preview
- **Identical logic** to server-side engine
- Server-side engine is the **source of truth** for persistence

---

## PDF Report Generation

```mermaid
flowchart TD
    CLICK["User clicks<br/>Exporter PDF"] --> DYNAMIC["Dynamic import<br/>@react-pdf/renderer"]
    DYNAMIC --> BRANDING["Load country branding<br/>colors, flag, labels"]
    BRANDING --> BUILD["Build ReportData<br/>lineItems + params"]
    BUILD --> RENDER["Render GreenTaxReport<br/>React PDF Document"]
    RENDER --> PAGE1["Page 1:<br/>Header + Summary +<br/>Line Items Table"]
    RENDER --> PAGE2["Page 2:<br/>ROI Projection +<br/>SVG Chart +<br/>Key Insights"]
    PAGE1 --> BLOB["Generate PDF blob"]
    PAGE2 --> BLOB
    BLOB --> DOWNLOAD["Trigger browser download<br/>rapport-fiscal-vert-XX-YYYY.pdf"]
```

### Country Branding

| Element | Luxembourg | France |
|---------|-----------|--------|
| Header BG | `#1A4D8F` (blue) | `#002395` (bleu) |
| Accent | `#D71A28` (red) | `#ED2939` (rouge) |
| Flag | Red/White/Blue | Blue/White/Red |
| Tax color | `#D71A28` | `#ED2939` |
| Subsidy color | `#1A8D5F` | `#1A8D5F` |

---

## Adding a New Jurisdiction

### Step-by-step walkthrough

#### 1. Create the data schema

Copy `data/schemas/_template.json` as `{CODE}-{YEAR}.json`:

```json
{
  "metadata": {
    "countryCode": "DE",
    "countryName": "Germany",
    "fiscalYear": 2026,
    "currency": "EUR",
    "lastUpdated": "2026-01-01"
  },
  "taxRules": { ... },
  "subsidies": { ... },
  "energyRates": { ... }
}
```

#### 2. Create the strategy class

Create `packages/engine/src/strategies/germany-2026.ts`:

```typescript
import type { CalculationInput, CalculationLineItem } from '@ggt/shared';
import type { JurisdictionStrategy } from '../jurisdiction-strategy';

export class Germany2026Strategy implements JurisdictionStrategy {
  readonly countryCode = 'DE';
  readonly name = 'Germany 2026';
  readonly fiscalYear = 2026;
  readonly currency = 'EUR' as const;

  async calculate(input: CalculationInput): Promise<CalculationLineItem[]> {
    const items: CalculationLineItem[] = [];
    // Implement German-specific calculations
    return items;
  }
}
```

#### 3. Register the strategy

Update `packages/engine/src/index.ts`:

```typescript
export { Germany2026Strategy } from './strategies/germany-2026';
```

Update `apps/api/src/modules/tax/tax.service.ts`:

```typescript
registry.register(new Germany2026Strategy());
```

#### 4. Add client-side engine

Update `apps/web/src/lib/engine-client.ts`:

```typescript
export type CountryCode = 'LU' | 'FR' | 'DE';

// In simulateLocally():
case 'DE': return simulateGermany(params);
```

#### 5. Update frontend & branding

Add to `COUNTRIES` array in `page.tsx`, add branding in `pdf/country-branding.ts`.

#### 6. Update seed & tests

- Add data loading in `apps/api/prisma/seed.ts`
- Create test suite in `packages/engine/src/__tests__/germany-2026.test.ts`

### Verification checklist

```mermaid
flowchart LR
    A["JSON schema<br/>created"] --> B["Strategy class<br/>implements interface"]
    B --> C["Engine exports<br/>updated"]
    C --> D["API registry<br/>registers strategy"]
    D --> E["Client engine<br/>dispatches"]
    E --> F["Frontend UI<br/>shows country"]
    F --> G["PDF branding<br/>configured"]
    G --> H["Tests pass"]
    H --> I["Seed updated"]
```
