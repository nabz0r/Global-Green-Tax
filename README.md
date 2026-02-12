# Global Green Tax

**Multi-tenant, multi-jurisdictional SaaS platform for calculating carbon taxes and green subsidies.**

Each country is a pluggable data module — add a JSON schema + strategy class and the entire stack (API, engine, frontend, PDF reports) adapts automatically.

---

## What Is Global Green Tax?

Global Green Tax (GGT) is a **B2B SaaS platform** purpose-built for fiduciaries, SMEs, and large enterprises navigating the complex landscape of European environmental taxation. With carbon taxes rising and green subsidy programs multiplying across jurisdictions, organizations struggle to:

1. **Quantify their net fiscal position** — balancing carbon levies against available green subsidies
2. **Simulate scenarios** — projecting the ROI of investments in solar, EVs, energy efficiency
3. **Stay compliant** — each jurisdiction has unique rules, thresholds, and eligibility criteria
4. **Report and decide** — generating audit-ready PDF reports for stakeholders and boards

GGT solves this with a **unified calculation engine** that encapsulates each country's tax law as a pluggable strategy module. Organizations get instant simulations, 10-year ROI projections, and branded PDF exports — all in one platform.

### Who Is It For?

| Segment | Use Case |
|---------|----------|
| **PME / SMEs** | Simulate their green tax position, discover subsidies they qualify for |
| **Fiduciaries & Accountants** | White-label platform for multi-client portfolio management |
| **Large Enterprises** | Multi-country consolidation, API integration with ERP/finance systems |
| **ESG Consultants** | Data-driven advisory using real-time scenario modeling |

---

## Economic Model & Monetization

Global Green Tax follows a **tiered SaaS subscription model** designed to scale from single-country SMEs to multi-national enterprises.

### Pricing Plans

| | Freemium | Starter | Professional | Enterprise |
|---|---------|---------|-------------|------------|
| **Target** | Découverte | PME / SMEs | Fiduciaries & Accountants | Large Enterprises |
| **Price** | **0 €** | **99 €/mois** | **499 €/mois** | **Sur mesure** |
| **Countries** | 1 jurisdiction | 1 jurisdiction | All jurisdictions | All jurisdictions |
| **Simulations** | 3 / month | 5 / month | Unlimited | Unlimited |
| **PDF Export** | — (blocked) | 5 / month | Unlimited | Unlimited |
| **Fiscal Deep Dive** | — (blocked) | — | Full analysis | Full analysis |
| **White-label** | — | — | Branded PDF & portal | Full white-label |
| **API Access** | — | — | REST API | REST + Webhooks + SDK |
| **SSO** | — | — | — | SAML / OIDC SSO |
| **Support** | — | Email | Priority email + chat | Dedicated CSM |
| **Deployment** | Cloud | Cloud | Cloud | Cloud / On-premise |
| **Users** | 1 seat | 2 seats | 10 seats | Unlimited |
| **SLA** | — | — | 99.5% uptime | 99.9% + custom SLA |

### Revenue Drivers

```mermaid
graph LR
    subgraph Acquisition
        FREE["Freemium<br/>0€ — 3 sims/mois"]
        STARTER["Starter<br/>99€/mois"]
    end

    subgraph Expansion
        PRO["Professional<br/>499€/mois"]
    end

    subgraph Enterprise
        ENT["Enterprise<br/>Custom"]
    end

    FREE -->|"Conversion:<br/>PDF, Deep Dive"| STARTER
    STARTER -->|"Upsell:<br/>multi-pays, API"| PRO
    PRO -->|"Upsell:<br/>SSO, on-prem"| ENT

    style FREE fill:#f5f5f5
    style STARTER fill:#c8e6c9
    style PRO fill:#a5d6a7
    style ENT fill:#66bb6a,color:#fff
```

### Key Metrics (Targets)

| Metric | Target |
|--------|--------|
| **Freemium → Starter conversion** | > 15% |
| **MRR per Starter** | 99 € |
| **MRR per Professional** | 499 € |
| **ACV Enterprise** | 15,000 – 50,000 € |
| **Churn rate** | < 5% monthly |
| **LTV/CAC ratio** | > 3:1 |
| **Gross margin** | > 85% (pure SaaS) |

---

## Architecture Overview

```mermaid
graph TB
    subgraph Client["Frontend — Next.js 15"]
        UI[Dashboard<br/>Recharts + Framer Motion]
        SIM[Simulation Page<br/>Shadcn/UI + Sliders]
        EC[Engine Client<br/>Instant Preview]
        PDF[PDF Report<br/>@react-pdf/renderer]
        ADMIN_UI[Admin Dashboard<br/>KPIs + Charts + Users]
    end

    subgraph API["API — NestJS"]
        GW[REST Gateway<br/>api/v1/tax/*]
        AUTH[Clerk Auth Guard]
        TENANT[Tenant Guard]
        QUOTA[Subscription Guard<br/>Quota + Feature Gating]
        ZOD[Zod Validation Pipe]
        ADMIN_API[Admin API<br/>api/admin/*]
        ADMIN_G[Admin Guard<br/>Role ADMIN/OWNER]
    end

    subgraph Engine["Calculation Engine"]
        ENG[GreenTaxEngine]
        REG[StrategyRegistry]
        LU[Luxembourg 2026]
        FR[France 2026]
        DE[Germany 2026]
        BE[Belgium 2026]
        ES[Spain 2026]
        PT[Portugal 2026]
    end

    subgraph Data["Data Layer"]
        PG[(PostgreSQL 16<br/>Multi-tenant)]
        RD[(Redis 7<br/>LRU Cache)]
        DL[(MarketAnalytic<br/>Data Lake)]
        JSON["/data/schemas/<br/>6 country schemas"]
    end

    subgraph AI["AI / ML Pipeline"]
        EXPORT[export-analytics.ts<br/>JSONL Export]
    end

    UI --> EC
    SIM --> EC
    SIM --> PDF
    SIM -->|POST /api/v1/tax/calculate| GW
    GW --> AUTH --> TENANT --> QUOTA --> ZOD --> ENG
    ADMIN_UI -->|GET /api/admin/*| ADMIN_API
    ADMIN_API --> AUTH --> ADMIN_G
    ENG --> REG
    REG --> LU & FR & DE & BE & ES & PT
    ENG --> PG
    ENG --> RD
    ENG -.->|analytics ingestion| DL
    DL -.->|batch export| EXPORT
    JSON -.->|seed| PG

    style Client fill:#e8f5e9,stroke:#2e7d32
    style API fill:#e3f2fd,stroke:#1565c0
    style Engine fill:#fff3e0,stroke:#ef6c00
    style Data fill:#fce4ec,stroke:#c62828
    style AI fill:#f3e5f5,stroke:#7b1fa2
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
    }

    class France2026Strategy {
        +countryCode = "FR"
        +fiscalYear = 2026
    }

    class Germany2026Strategy {
        +countryCode = "DE"
        +fiscalYear = 2026
    }

    class Belgium2026Strategy {
        +countryCode = "BE"
        +fiscalYear = 2026
    }

    class Spain2026Strategy {
        +countryCode = "ES"
        +fiscalYear = 2026
    }

    class Portugal2026Strategy {
        +countryCode = "PT"
        +fiscalYear = 2026
    }

    JurisdictionStrategy <|.. Luxembourg2026Strategy
    JurisdictionStrategy <|.. France2026Strategy
    JurisdictionStrategy <|.. Germany2026Strategy
    JurisdictionStrategy <|.. Belgium2026Strategy
    JurisdictionStrategy <|.. Spain2026Strategy
    JurisdictionStrategy <|.. Portugal2026Strategy
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
    participant Sub as SubscriptionGuard
    participant Engine as GreenTaxEngine
    participant Redis as Redis Cache
    participant DB as PostgreSQL
    participant DL as MarketAnalytic

    User->>Web: Adjust sliders
    Web->>Web: simulateLocally() [instant]
    Web-->>User: Real-time preview

    User->>Web: Click "Sauvegarder"
    Web->>API: POST /api/v1/tax/calculate
    API->>Clerk: Verify JWT
    Clerk-->>API: userId
    API->>DB: Resolve tenant
    DB-->>API: organizationId + countryCode
    API->>Sub: Check subscription quota
    alt Quota exceeded
        Sub-->>API: 402 Payment Required
        API-->>Web: Upgrade required
    else Quota OK
        Sub->>Sub: Increment usage counter
    end
    API->>API: Zod validate body
    API->>Redis: Check cache
    alt Cache hit
        Redis-->>API: Cached result
    else Cache miss
        API->>Engine: engine.calculate(input)
        Engine->>Engine: Resolve strategy
        Engine->>Engine: Run jurisdiction calc
        Engine-->>API: CalculationResult
        API->>DB: Persist calculation
        API->>DL: Ingest MarketAnalytic (async)
        API->>Redis: Cache result (1h TTL)
    end
    API-->>Web: CalculationResult
    Web-->>User: Display results

    User->>Web: Click "Exporter PDF"
    alt Freemium plan
        Web->>API: Check PDF quota
        API-->>Web: 403 Upgrade Required
    else Paid plan
        Web->>Web: Generate PDF client-side
        Web-->>User: Download rapport-fiscal-vert.pdf
    end
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Monorepo** | Turborepo + npm workspaces | Build orchestration, caching |
| **Frontend** | Next.js 15, React 19, Shadcn/UI | SSR, interactive simulation |
| **Dashboard** | Recharts, Framer Motion | Charts, animations, transitions |
| **Admin** | Recharts (Area/Pie/Bar) | Admin KPIs, trends, user management |
| **Theme** | next-themes | Dark/light mode, emerald/slate palette |
| **API** | NestJS 10, Prisma 6 | REST endpoints, ORM |
| **Engine** | TypeScript (pure) | Jurisdiction calculations |
| **Auth** | Clerk | SSO, JWT, multi-tenant |
| **Database** | PostgreSQL 16 | Multi-tenant data, JSONB |
| **Data Lake** | PostgreSQL (MarketAnalytic) | Analytics ingestion, market intelligence |
| **Cache** | Redis 7 | LRU result caching |
| **Validation** | Zod | Runtime schema validation |
| **PDF** | @react-pdf/renderer | Client-side report generation |
| **AI/ML** | JSONL export script | Fine-tuning data pipeline |
| **Proxy** | Traefik v3 | Reverse proxy, Let's Encrypt |
| **Testing** | Vitest | Unit tests for engine |

---

## Project Structure

```
Global-Green-Tax/
├── apps/
│   ├── api/                    # NestJS REST API
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Multi-tenant data model + MarketAnalytic
│   │   │   └── seed.ts         # Database seeder (6 countries, 4 plans, analytics)
│   │   ├── src/
│   │   │   ├── common/         # Guards, middleware, services
│   │   │   │   ├── guards/     # ClerkAuth + Tenant + Subscription + Admin guards
│   │   │   │   ├── middleware/ # Zod validation pipe
│   │   │   │   ├── prisma.*    # Database module/service
│   │   │   │   └── redis.*     # Cache module/service
│   │   │   └── modules/
│   │   │       ├── auth/       # Authentication module
│   │   │       ├── tax/        # Tax calculation + analytics ingestion
│   │   │       ├── subscription/ # Plan & quota management (Freemium gating)
│   │   │       └── admin/      # Admin dashboard API (summary, users, plans)
│   │   └── Dockerfile
│   └── web/                    # Next.js 15 Frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── admin/              # Admin dashboard (role-protected)
│       │   │   │   ├── layout.tsx      # Admin layout with role check
│       │   │   │   ├── page.tsx        # KPIs, charts, trends
│       │   │   │   └── users/
│       │   │   │       └── page.tsx    # User management DataTable
│       │   │   ├── dashboard/
│       │   │   │   ├── page.tsx        # Overview (charts, KPIs)
│       │   │   │   ├── simulate/       # Simulation page
│       │   │   │   ├── documents/      # PDF document listing
│       │   │   │   └── settings/       # Organization settings
│       │   │   ├── sign-in/            # Clerk sign-in
│       │   │   └── sign-up/            # Clerk sign-up
│       │   ├── components/
│       │   │   ├── dashboard/          # Sidebar, page transitions
│       │   │   ├── result-card.tsx     # Tax/subsidy results display
│       │   │   └── ui/                 # Shadcn/UI + skeleton loaders
│       │   └── lib/
│       │       ├── api.ts              # API client
│       │       ├── engine-client.ts    # Client-side calc engine
│       │       └── pdf/                # PDF report generation
│       └── Dockerfile
├── packages/
│   ├── engine/                 # Calculation engine (pure TS)
│   │   ├── src/
│   │   │   ├── engine.ts            # GreenTaxEngine orchestrator
│   │   │   ├── strategy-registry.ts # Strategy pattern registry
│   │   │   ├── jurisdiction-strategy.ts  # Interface
│   │   │   ├── strategies/          # 6 country implementations
│   │   │   └── __tests__/           # Vitest test suites
│   │   └── vitest.config.ts
│   ├── shared/                 # Shared types & Zod schemas
│   │   └── src/
│   │       ├── types.ts        # CalculationInput, LineItem, etc.
│   │       └── schemas.ts      # Zod validation schemas
│   └── ui/                     # Shared UI utilities
├── scripts/
│   └── export-analytics.ts    # JSONL export for AI/ML fine-tuning
├── data/
│   └── schemas/                # Country tax rule definitions (6 countries)
├── docs/
│   └── architecture.md         # System design, data flow, economic model
├── docker-compose.yml          # Full-stack deployment
├── turbo.json                  # Turborepo pipeline config
└── package.json                # Root workspace config
```

---

## Supported Jurisdictions

### Luxembourg 2026 🇱🇺

| Module | Type | Details |
|--------|------|---------|
| CO2 Tax | Tax | Progressive: 45/65/85/120 EUR/t |
| IRC + Taxe Commerciale | Tax | ~24.94% effective rate |
| Klimabonus PV | Subsidy | 800 EUR/kWp (max 10k EUR, >= 50% self-consumption) |
| PRIMe Car-e (EV) | Subsidy | 6,000/3,000 EUR by consumption tier |
| PRIMe Car-e (Wallbox) | Subsidy | 1,200 EUR + 450 EUR smart charging |
| Fit 4 Sustainability | Subsidy | 80/60/50% by enterprise size |
| Energy Savings | Savings | 950 kWh/kWp, grid + feed-in |

### France 2026 🇫🇷

| Module | Type | Details |
|--------|------|---------|
| CCE (Contribution Climat Energie) | Tax | Flat rate 44.60 EUR/t |
| IS + CVAE | Tax | 25% standard / 15% PME + CVAE 0.09% |
| Prime Autoconsommation PV | Subsidy | Tiered: 80/140/70 EUR/kWp |
| Bonus Ecologique | Subsidy | VP 3,000 EUR / VUL 4,000 EUR |
| ADEME Tremplin | Subsidy | 50%/30% SME (max 200k EUR) |
| Energy Savings | Savings | 1,100 kWh/kWp, grid + surplus |

### Germany 2026 🇩🇪

| Module | Type | Details |
|--------|------|---------|
| CO2-Steuer (BEHG) | Tax | 55 EUR/t national ETS |
| Gewerbesteuer + KSt | Tax | ~30% effective corporate |
| KfW Solarförderung | Subsidy | 600 EUR/kWp photovoltaic |
| Umweltbonus (EV) | Subsidy | 4,500/3,000 EUR by vehicle type |
| BAFA Energieberatung | Subsidy | 80% audit costs, max 6k EUR |
| Energy Savings | Savings | 1,000 kWh/kWp, grid + surplus |

### Belgium 2026 🇧🇪

| Module | Type | Details |
|--------|------|---------|
| Cotisation Fédérale Énergie | Tax | 35 EUR/t federal energy contribution |
| ISOC | Tax | 25% / 20% PME rate |
| Primes PV Wallonie | Subsidy | Wallonia solar premiums |
| Eco-bonus | Subsidy | EV fleet conversion |
| Déduction pour investissement | Subsidy | 25% green investment deduction |
| Energy Savings | Savings | 900 kWh/kWp |

### Spain 2026 🇪🇸

| Module | Type | Details |
|--------|------|---------|
| Impuesto sobre CO2 | Tax | 30 EUR/t national carbon tax |
| Impuesto de Sociedades | Tax | 25% / 23% reducida PYME |
| Subvención Autoconsumo | Subsidy | IDAE self-consumption solar |
| Plan MOVES III (EV) | Subsidy | EV acquisition & infrastructure |
| Deducción IBI Solar | Subsidy | 50% IBI property tax reduction |
| Energy Savings | Savings | 1,400 kWh/kWp (high irradiation) |

### Portugal 2026 🇵🇹

| Module | Type | Details |
|--------|------|---------|
| Taxa de Carbono | Tax | 38 EUR/t carbon tax |
| IRC | Tax | 21% / 17% PME first 25k EUR |
| Programa Edifícios | Subsidy | Building solar installation |
| Incentivo Mobilidade | Subsidy | EV conversion subsidy |
| IAPMEI Verde | Subsidy | Green SME investment fund |
| Energy Savings | Savings | 1,350 kWh/kWp |

---

## Admin Dashboard

The platform includes a protected admin interface at `/admin` accessible only to users with `ADMIN` or `OWNER` roles (verified via Clerk metadata).

### Features

| View | Description |
|------|-------------|
| **KPI Cards** | MRR, total users, simulations (30 days), data lake entries |
| **Simulation Trend** | Recharts AreaChart — 30-day daily simulation volume |
| **Plan Distribution** | PieChart — organizations by plan (Freemium/Starter/Pro/Enterprise) |
| **Top Investments** | Horizontal BarChart — most simulated investment types |
| **Country Volume** | Progress bars — simulation volume by country |
| **User Management** | Searchable DataTable with plan change dropdown per user |
| **Deployment Wizard** | Multi-step wizard to generate docker-compose, .env, deploy scripts |

### Deployment Wizard

The `/admin/deploy` route provides a 5-step guided wizard for generating production-ready deployment configurations:

| Step | Description |
|------|-------------|
| **1. Deployment Type** | Choose Cloud (AWS/GCP/Azure/Hetzner/OVH) or On-Premise |
| **2. Infrastructure** | Domain, PostgreSQL, Redis, Traefik, backups, monitoring |
| **3. Credentials** | Database passwords, Redis auth, Clerk API keys (client-side only) |
| **4. Application** | Ports, environment, admin email, logging, Sentry |
| **5. Generate** | Review & download docker-compose.yml, .env, deploy.sh, nginx.conf |

All secrets stay in the browser — nothing is transmitted to the server.

### Admin API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/analytics/summary` | Dashboard KPIs and chart data |
| `GET` | `/api/admin/users?search=&page=&limit=` | Paginated user list |
| `POST` | `/api/admin/users/:id/toggle-plan` | Change a user's organization plan |

All admin endpoints are protected by `ClerkAuthGuard` + `AdminGuard` (role verification in DB).

---

## MarketAnalytic Data Lake

Every simulation automatically ingests structured analytics into the `MarketAnalytic` table. This provides market intelligence data for:

- **Admin Dashboard** — aggregated KPIs, trends, and country/investment breakdowns
- **AI/ML Pipeline** — JSONL export for fine-tuning language models on green tax advisory
- **Business Intelligence** — investment type classification, subsidy volume tracking

### Investment Type Classification

The TaxService classifies each simulation's line items into categories using pattern matching:

| Type | Matched Codes |
|------|---------------|
| `SOLAR` | PV, SOLAR, KFW, EDIFICIO |
| `EV` | EV, MOVES, BONUS-ECO, UMWELT, FLEET, VE |
| `AUDIT` | F4S, ADEME, BAFA, AMURE, AUDIT, IAPMEI |
| `ENERGY_EFFICIENCY` | ENERGY, IBI, ECOPREMIE |
| `GENERAL` | Fallback when no pattern matches |

### AI/ML Export

Export the data lake to JSONL format for fine-tuning:

```bash
npx tsx scripts/export-analytics.ts --output analytics.jsonl --limit 10000
```

Each record produces a structured prompt/completion pair compatible with OpenAI and Vertex AI fine-tuning formats.

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
5. **Frontend**: Add country to `COUNTRY_CONFIG`, add branding to `pdf/country-branding.ts`

See [Architecture Guide](./docs/architecture.md) for detailed instructions.

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture Guide](./docs/architecture.md) | System design, data flow, economic model |
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
    Organization }o--|| Plan : "subscribes to"
    User ||--o{ MarketAnalytic : "generates"

    Plan {
        uuid id PK
        string name UK "FREEMIUM|STARTER|PROFESSIONAL|ENTERPRISE"
        int priceEuroCents "0|9900|49900|custom"
        int maxSimulationsPerMonth "3|5|null|null"
        int maxPdfExportsPerMonth "0|5|null|null"
        int maxCountries "1|1|null|null"
        boolean whiteLabel "false|false|true|true"
        boolean apiAccess "false|false|true|true"
        boolean ssoEnabled "false|false|false|true"
        boolean fiscalDeepDive "false|false|true|true"
    }

    Organization {
        uuid id PK
        string name
        string countryCode FK
        string vatNumber
        string sector
        string planId FK
        int simulationsUsedThisMonth
        int pdfExportsUsedThisMonth
        datetime currentPeriodStart
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

    MarketAnalytic {
        uuid id PK
        string countryCode "ISO 3166-1"
        string sector "optional"
        string investmentType "SOLAR|EV|AUDIT|ENERGY_EFFICIENCY"
        decimal amount
        decimal estimatedGrant
        decimal co2Tonnes "optional"
        int employeeCount "optional"
        decimal revenue "optional"
        uuid userId FK "optional"
        datetime createdAt
    }
```

---

## License

Proprietary. All rights reserved.
