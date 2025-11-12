# HEX Ops - SaaS B2B Chiffrage CVC/Plomberie

Automatisez et fiabilisez votre chiffrage avec HEX Ops : import DPGF, mapping vers catalogue standard, résolution des prix, calcul MO/PV, exports signables et suivi des offres.

## Stack Technique

### Monorepo
- **Turborepo** : orchestration des builds et tasks
- **npm workspaces** : gestion des dépendances partagées

### Frontend Web
- **Next.js 16** (App Router)
- **React 19** (avec React Compiler)
- **TypeScript** (strict mode)
- **Tailwind CSS v4** + shadcn/ui
- **TanStack Query v5** (data fetching)
- **tRPC v11** (type-safe API)
- **AG Grid Community/Enterprise** (data grids)

### Frontend Mobile
- **Expo SDK 51** (React Native)
- **Expo Router** (file-based routing)
- **NativeWind** (Tailwind for React Native)
- **React Native Web** (cross-platform)

### Backend
- **Supabase** (PostgreSQL + Auth + Storage + Edge Functions)
- **Row Level Security (RLS)** (multi-tenant)
- **tRPC** (type-safe API endpoints)
- **Zod** (schema validation)

### DevOps
- **TypeScript** (tout le projet)
- **ESLint + Prettier** (code quality)
- **Vitest** (unit tests)
- **Playwright** (E2E tests web)
- **Maestro** (E2E tests mobile)

## Structure du Projet

```
hex/
├── apps/
│   ├── web/                  # Next.js 16 (desktop B2B)
│   │   ├── src/
│   │   │   ├── app/         # Pages et layouts
│   │   │   ├── components/  # Composants React
│   │   │   ├── lib/         # Utilitaires
│   │   │   └── styles/      # CSS/Tailwind
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.ts
│   │   └── tailwind.config.ts
│   └── mobile/              # Expo (React Native)
│       ├── app/            # Expo Router pages
│       ├── src/            # Composants RN
│       ├── app.json
│       └── package.json
├── packages/
│   ├── api/                 # tRPC router + Zod schemas
│   │   ├── src/
│   │   │   ├── router.ts   # tRPC procedures
│   │   │   ├── schemas.ts  # Zod validation
│   │   │   └── types.ts    # Type definitions
│   │   └── package.json
│   ├── db/                  # Supabase clients + helpers
│   │   ├── src/
│   │   │   ├── client.ts   # Supabase client setup
│   │   │   └── types.ts    # Database types
│   │   └── package.json
│   └── business/            # Règles métier (calculs MO/PV, quality flags)
│       ├── src/
│       │   ├── pricing.ts  # Logique de calcul
│       │   ├── quality.ts  # Flags qualité
│       │   └── types.ts    # Types métier
│       └── package.json
├── supabase/
│   ├── migrations/          # SQL migrations DDL
│   ├── functions/           # Edge Functions Deno
│   └── seed.sql            # Données test
├── package.json            # Root + workspaces
├── turbo.json              # Configuration Turborepo
└── README.md
```

## Démarrage

### Prérequis
- **Node.js** ≥ 20.0.0
- **npm** ≥ 10.0.0
- **Docker** (pour Supabase local)

### Installation

```bash
# 1. Cloner et installer
git clone <repo>
cd hex
npm install

# 2. Démarrer Supabase local
cd supabase
docker-compose up -d
# Ou: npx supabase start

# 3. Configuration env
cp .env.example .env.local

# 4. Lancer le dev
npm run dev

# Web : http://localhost:3000
# Mobile : expo start
```

### Dev Commands

```bash
# Tout en dev (web + mobile + packages)
npm run dev

# Build production
npm run build

# Tests
npm run test

# Linting
npm run lint

# Type checking
npm run type-check

# Formatting
npm run format
```

## Architecture API

### tRPC Routers (packages/api)

```
├── auth
│   ├── login
│   ├── signup
│   ├── logout
│   └── me
├── imports
│   ├── create
│   ├── list
│   └── getStatus
├── catalogue
│   ├── list
│   ├── create
│   ├── update
│   └── delete
├── prices
│   ├── listByCatalogue
│   ├── create
│   └── update
├── indices
│   ├── listByMaterial
│   └── create
├── quotes
│   ├── list
│   ├── create
│   └── getDetail
├── pricingParams
│   ├── list
│   └── upsert
└── audit
    └── list (admin only)
```

## Règles Métier (packages/business)

### Calcul MO/PV
- **Coût d'achat unitaire** : min(prix_net valide) OU coût_base × coef_indice
- **MO unitaire** : Temps_U_h × Taux_Horaire
- **PV unitaire** : (Coût_achat_U + MO_U) / (1 - marge%)
- **Total ligne** : Quantité × PV_U

### Flags Qualité
- `prix_obsolete` : prix valide depuis >90 jours
- `prix_manquant` : aucun prix fournisseur valide ET pas d'indice
- `temps_manquant` : temps unitaire absent
- `incoherence_um` : problème unité de mesure

## Base de Données (Supabase)

### Tables Multi-tenant
- `tenants` : clients
- `profiles` : utilisateurs (1:1 avec auth.users)
- `tenant_memberships` : affiliations (rôles : admin, engineer, readonly)

### Tables Métier
- `catalogue_items` : produits avec HEX_CODE
- `supplier_prices` : prix fournisseurs (brut, remise, net)
- `material_indices` : coefficients matières (historique)
- `dpgf_imports` : imports de fichiers
- `dpgf_rows_raw` : données brutes post-parsing
- `dpgf_rows_mapped` : données mappées avec HEX_CODE
- `quotes` : devis générés
- `quote_lines` : lignes calculées
- `pricing_params` : taux horaires et marges
- `mapping_memory` : apprentissage des libellés par tenant
- `audit_logs` : journal d'audit (trigger INSERT/UPDATE/DELETE)

### Sécurité
- **RLS activé** sur toutes les tables
- **Isolation par tenant_id** automatique
- **Triggers audit** sur changements sensibles
- **Rôles** appliqués via token JWT Supabase

## Roadmap MVP (8 Sprints)

| Sprint | Thème | Durée |
|--------|-------|-------|
| 0 | Socle & Auth | 1 sem |
| 1 | Schéma DB + RLS + Audit | 1 sem |
| 2 | Import DPGF Hybride | 2 sem |
| 3 | Mapping & Mémoire | 2 sem |
| 4 | Catalogue & Pricebook | 1 sem |
| 5 | Moteur de Calcul | 1 sem |
| 6 | Exports PDF/Excel | 1 sem |
| 7 | Mobile Lite | 1 sem |
| 8 | Finitions & Deploy | 1 sem |

**Total : 11 semaines production-ready**

## Dépendances Clés

### Web (apps/web)
- next@canary, react@rc, react-dom@rc
- @tanstack/react-query
- @trpc/client, @trpc/react-query
- ag-grid-community, ag-grid-react
- tailwindcss@4.0-alpha
- shadcn/ui via class-variance-authority

### Mobile (apps/mobile)
- expo@51
- expo-router@3.4
- react-native@0.74-rc
- nativewind@2.1
- @tanstack/react-query (query état)
- @trpc/client (API call)

### Partagé
- @trpc/server
- zod
- @supabase/supabase-js
- typescript@5.9

## Documentation

- [API Routes](./docs/api.md) (à créer)
- [Database Schema](./docs/database.md) (à créer)
- [Business Logic](./docs/business.md) (à créer)
- [Deployment](./docs/deployment.md) (à créer)

## Support

Pour des questions ou problèmes, créez une issue ou consultez la documentation.

---

**Version** : 0.1.0 (MVP Sprint 0)
**Dernière MAJ** : Nov 2024
