# Global Green Tax

**Multi-tenant, multi-jurisdictional SaaS platform for calculating carbon taxes and green subsidies.**

Each country is a pluggable data module - add a JSON schema + strategy class and the entire stack (API, engine, frontend, PDF reports) adapts automatically.

---

## Architecture Overview

```mermaid
graph TB
    subgraph Client["Frontend — Next.js 15"]
        UI[Simulation Page<br/>Shadcn/UI + Sliders]
        EC[Engine Client<br/>Instant Preview]
        PDF[PDF Report<br/>@react-pdf/renderer]
    end

    subgraph API["API — NestJS"]
        GW[REST Gateway<br/>api/v1/tax/*]
        AUTH[Clerk Auth Guard]
        TENANT[Tenant Guard]
        ZOD[Zod Validation Pipe]
    end

    subgraph Engine["Calculation Engine"]
        ENG[GreenTaxEngine]
        REG[StrategyRegistry]
        LU[Luxembourg2026Strategy]
        FR[France2026Strategy]
        NEXT["...future strategies"]
    end

    subgraph Data["Data Layer"]
        PG[(PostgreSQL 16<br/>Multi-tenant)]
        RD[(Redis 7<br/>LRU Cache)]
        JSON["/data/schemas/<br/>LU-2026.json<br/>FR-2026.json"]
    end

    UI --> EC
    UI --> PDF
    UI -->|POST /api/v1/tax/calculate| GW
    GW --> AUTH --> TENANT --> ZOD --> ENG
    ENG --> REG
    REG --> LU
    REG --> FR
    REG --> NEXT
    ENG --> PG
    ENG --> RD
    JSON -.->|seed| PG

    style Client fill:#e8f5e9,stroke:#2e7d32
    style API fill:#e3f2fd,stroke:#1565c0
    style Engine fill:#fff3e0,stroke:#ef6c00
    style Data fill:#fce4ec,stroke:#c62828
```

## Strategy Pattern

```mermaid
classDiagram
    class JurisdictionStrategy {
        <<interface>>
        +countryCode: string
        +name: string
        +fiscalYear: number
        +currency: CurrencyCode
        +calculate(input) CalculationLineItem[]
        +validateInput(input)? void
    }

    class GreenTaxEngine {
        -registry: StrategyRegistry
        +calculate(input) CalculationResult
    }

    class StrategyRegistry {
        -strategies: Map
        +register(strategy) void
        +get(country, year) JurisdictionStrategy
        +has(country, year) boolean
        +listRegistered() string[]
    }

    class Luxembourg2026Strategy {
        +countryCode = "LU"
        +fiscalYear = 2026
        -calculateCO2Tax()
        -calculateCorporateTax()
        -calculateKlimabonusPV()
        -calculateEVGrants()
        -calculateWallbox()
        -calculateFit4Sustainability()
        -calculateEnergySavings()
    }

    class France2026Strategy {
        +countryCode = "FR"
        +fiscalYear = 2026
        -calculateCCE()
        -calculateCorporateTax()
        -calculatePrimeAutoconsommation()
        -calculateBonusEcologique()
        -calculateAdemeTreemplin()
        -calculateEnergySavings()
    }

    JurisdictionStrategy <|.. Luxembourg2026Strategy
    JurisdictionStrategy <|.. France2026Strategy
    GreenTaxEngine --> StrategyRegistry
    StrategyRegistry --> JurisdictionStrategy
```

## Request Flow

```mermaid
sequenceDiagram
    actor User
    participant Web as Next.js Frontend
    participant API as NestJS API
    participant Clerk as Clerk Auth
    participant Engine as GreenTaxEngine
    participant Redis as Redis Cache
    participant DB as PostgreSQL

    User->>Web: Adjust sliders
    Web->>Web: simulateLocally() [instant]
    Web-->>User: Real-time preview

    User->>Web: Click "Sauvegarder"
    Web->>API: POST /api/v1/tax/calculate
    API->>Clerk: Verify JWT
    Clerk-->>API: userId
    API->>DB: Resolve tenant
    DB-->>API: organizationId + countryCode
    API->>API: Zod validate body
    API->>Redis: Check cache
    alt Cache hit
        Redis-->>API: Cached result
    else Cache miss
        API->>Engine: engine.calculate(input)
        Engine->>Engine: Resolve strategy (FR:2026)
        Engine->>Engine: Run jurisdiction calc
        Engine-->>API: CalculationResult
        API->>DB: Persist calculation
        API->>Redis: Cache result (1h TTL)
    end
    API-->>Web: CalculationResult
    Web-->>User: Display results

    User->>Web: Click "Exporter PDF"
    Web->>Web: Generate PDF client-side
    Web-->>User: Download rapport-fiscal-vert.pdf
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Monorepo** | Turborepo + npm workspaces | Build orchestration, caching |
| **Frontend** | Next.js 15, React 19, Shadcn/UI | SSR, interactive simulation |
| **API** | NestJS 10, Prisma 6 | REST endpoints, ORM |
| **Engine** | TypeScript (pure) | Jurisdiction calculations |
| **Auth** | Clerk | SSO, JWT, multi-tenant |
| **Database** | PostgreSQL 16 | Multi-tenant data, JSONB |
| **Cache** | Redis 7 | LRU result caching |
| **Validation** | Zod | Runtime schema validation |
| **PDF** | @react-pdf/renderer | Client-side report generation |
| **Proxy** | Traefik v3 | Reverse proxy, Let's Encrypt |
| **Testing** | Vitest | Unit tests for engine |

---

## Project Structure

```
Global-Green-Tax/
├── apps/
│   ├── api/                    # NestJS REST API
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Multi-tenant data model
│   │   │   └── seed.ts         # Database seeder (LU + FR)
│   │   ├── src/
│   │   │   ├── common/         # Guards, middleware, services
│   │   │   │   ├── guards/     # ClerkAuth + Tenant guards
│   │   │   │   ├── middleware/ # Zod validation pipe
│   │   │   │   ├── prisma.*    # Database module/service
│   │   │   │   └── redis.*     # Cache module/service
│   │   │   └── modules/
│   │   │       ├── auth/       # Authentication module
│   │   │       └── tax/        # Tax calculation module
│   │   └── Dockerfile
│   └── web/                    # Next.js 15 Frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── dashboard/
│       │   │   │   └── simulate/  # Simulation page
│       │   │   ├── sign-in/       # Clerk sign-in
│       │   │   └── sign-up/       # Clerk sign-up
│       │   ├── components/
│       │   │   ├── result-card.tsx # Tax/subsidy results display
│       │   │   └── ui/            # Shadcn/UI components
│       │   └── lib/
│       │       ├── api.ts            # API client
│       │       ├── engine-client.ts  # Client-side calc engine
│       │       └── pdf/              # PDF report generation
│       └── Dockerfile
├── packages/
│   ├── engine/                 # Calculation engine (pure TS)
│   │   ├── src/
│   │   │   ├── engine.ts            # GreenTaxEngine orchestrator
│   │   │   ├── strategy-registry.ts # Strategy pattern registry
│   │   │   ├── jurisdiction-strategy.ts  # Interface
│   │   │   ├── strategies/
│   │   │   │   ├── luxembourg-2026.ts    # LU implementation
│   │   │   │   └── france-2026.ts        # FR implementation
│   │   │   └── __tests__/               # Vitest test suites
│   │   └── vitest.config.ts
│   ├── shared/                 # Shared types & Zod schemas
│   │   └── src/
│   │       ├── types.ts        # CalculationInput, LineItem, etc.
│   │       └── schemas.ts      # Zod validation schemas
│   └── ui/                     # Shared UI utilities
├── data/
│   └── schemas/                # Country tax rule definitions
│       ├── _template.json      # Template for new countries
│       ├── LU-2026.json        # Luxembourg 2026 rules
│       └── FR-2026.json        # France 2026 rules
├── docker-compose.yml          # Full-stack deployment
├── turbo.json                  # Turborepo pipeline config
└── package.json                # Root workspace config
```

---

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.8.0
- Docker & Docker Compose (for database and cache)

### 1. Clone & Install

```bash
git clone <repository-url>
cd Global-Green-Tax
npm install
```

### 2. Start Infrastructure

```bash
docker compose up -d postgres redis
```

### 3. Configure Environment

```bash
# apps/api/.env
DATABASE_URL="postgresql://ggt_user:ggt_secure_password_2026@localhost:5432/global_green_tax"
REDIS_URL="redis://localhost:6379"
CLERK_SECRET_KEY="sk_test_..."
CORS_ORIGIN="http://localhost:3000"
API_PORT=4000

# apps/web/.env.local
NEXT_PUBLIC_API_URL="http://localhost:4000"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
```

### 4. Setup Database

```bash
npm run db:generate
npm run db:push
npx -w apps/api prisma db seed
```

### 5. Run Development

```bash
npm run dev
```

This starts both the API (port 4000) and frontend (port 3000) via Turborepo.

### 6. Run Tests

```bash
npm test
```

---

## Supported Jurisdictions

### Luxembourg 2026

| Module | Type | Details |
|--------|------|---------|
| CO2 Tax | Tax | Progressive: 45/65/85/120 EUR/t |
| IRC + Taxe Commerciale | Tax | ~24.94% effective rate |
| Klimabonus PV | Subsidy | 800 EUR/kWp (max 10k EUR, >= 50% self-consumption) |
| PRIMe Car-e (EV) | Subsidy | 6,000/3,000 EUR by consumption tier |
| PRIMe Car-e (Wallbox) | Subsidy | 1,200 EUR + 450 EUR smart charging |
| Fit 4 Sustainability | Subsidy | 80/60/50% by enterprise size |
| Energy Savings | Savings | 950 kWh/kWp, grid + feed-in |

### France 2026

| Module | Type | Details |
|--------|------|---------|
| CCE (Contribution Climat Energie) | Tax | Flat rate 44.60 EUR/t |
| IS + CVAE | Tax | 25% standard / 15% PME + CVAE 0.09% |
| Prime Autoconsommation PV | Subsidy | Tiered: 80/140/70 EUR/kWp |
| Bonus Ecologique | Subsidy | VP 3,000 EUR / VUL 4,000 EUR |
| ADEME Tremplin | Subsidy | 50%/30% SME (max 200k EUR) |
| Energy Savings | Savings | 1,100 kWh/kWp, grid + surplus |

---

## Adding a New Country

The system is designed for zero-core-change extensibility:

```mermaid
flowchart LR
    A["1. Copy _template.json<br/>as XX-2026.json"] --> B["2. Create<br/>XX2026Strategy.ts"]
    B --> C["3. Register in<br/>engine/index.ts"]
    C --> D["4. Add to<br/>engine-client.ts"]
    D --> E["5. Update seed +<br/>frontend selector"]

    style A fill:#fff3e0
    style B fill:#e8f5e9
    style C fill:#e3f2fd
    style D fill:#f3e5f5
    style E fill:#fce4ec
```

1. **Data schema**: Copy `data/schemas/_template.json` as `{CODE}-{YEAR}.json`
2. **Strategy class**: Create `packages/engine/src/strategies/{country}-{year}.ts` implementing `JurisdictionStrategy`
3. **Register**: Export from `packages/engine/src/index.ts`, register in `TaxService`
4. **Client engine**: Add dispatch case in `apps/web/src/lib/engine-client.ts`
5. **Frontend**: Add country to `COUNTRIES` array, add branding to `pdf/country-branding.ts`

See [Architecture Guide](./docs/architecture.md) for detailed instructions.

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture Guide](./docs/architecture.md) | System design, data flow, patterns |
| [API Reference](./docs/api.md) | REST endpoints, schemas, examples |
| [Deployment Guide](./docs/deployment.md) | Docker, cloud, CI/CD |
| [Troubleshooting](./docs/troubleshooting.md) | Common issues and solutions |

---

## Data Model

```mermaid
erDiagram
    Organization ||--o{ User : "has members"
    Organization ||--o{ Calculation : "owns"
    Organization }o--|| Country : "operates in"

    Organization {
        uuid id PK
        string name
        string countryCode FK
        string vatNumber
        string sector
        datetime createdAt
        datetime updatedAt
    }

    User {
        uuid id PK
        string clerkId UK
        string email UK
        string firstName
        string lastName
        enum role "OWNER|ADMIN|MEMBER|VIEWER"
        uuid organizationId FK
    }

    Country {
        uuid id PK
        string code UK "ISO 3166-1"
        string name
        string currency
        boolean isActive
        jsonb taxRules "Full tax schema"
    }

    Calculation {
        uuid id PK
        uuid organizationId FK
        string countryCode
        int fiscalYear
        jsonb input
        jsonb result
        decimal netAmount
        string currency
        string engineVersion
        datetime createdAt
    }
```

---

## License

Proprietary. All rights reserved.
