# Supabase Setup pour HEX Ops

Configuration et gestion de Supabase (PostgreSQL + Auth + Storage) pour le MVP HEX Ops.

## Installation Locale (Docker)

### Prérequis
- Docker & Docker Compose
- Supabase CLI: `npm install -g supabase`

### 1. Initialiser Supabase Local

```bash
cd /path/to/hex
npx supabase init
# OU si déjà initialisé
npx supabase start
```

Cela lance :
- PostgreSQL 15 (port 54322)
- Supabase Studio (http://localhost:54323)
- Auth (port 9999)
- Storage (port 9000)

### 2. Appliquer les Migrations

Les migrations se trouvent dans `supabase/migrations/`:

1. **001_schema.sql** : Tables multi-tenant (tenants, catalogue, prix, etc.)
2. **002_rls.sql** : Row Level Security pour isolation par tenant
3. **003_audit_triggers.sql** : Triggers d'audit automatique

Pour appliquer les migrations :

```bash
# Les migrations s'appliquent automatiquement via Supabase CLI
# Si manuel:
psql postgresql://postgres:postgres@localhost:54322/postgres < migrations/001_schema.sql
psql postgresql://postgres:postgres@localhost:54322/postgres < migrations/002_rls.sql
psql postgresql://postgres:postgres@localhost:54322/postgres < migrations/003_audit_triggers.sql
```

### 3. Seed les Données Test

```bash
psql postgresql://postgres:postgres@localhost:54322/postgres < seed.sql
```

Cela crée:
- 2 tenants (HEX Demo + ABC Corp)
- 4 utilisateurs test avec rôles différents
- 8 produits catalogue
- Plusieurs prix fournisseurs
- Indices matières
- 3 devis exemple

### 4. Vérifier le Setup

Accéder à **Supabase Studio**: http://localhost:54323

- **User** : `supabase`
- **Password** : `password`
- **Project Ref** : `aaaaaaaaaaaaaaaa`

### 5. Récupérer les Credentials

Pour `.env.local` du projet:

```bash
npx supabase status
```

Vous obtiendrez:
- `SUPABASE_URL` : http://localhost:54321
- `SUPABASE_ANON_KEY` : (copier depuis Studio > Project Settings > API Keys)
- `SUPABASE_SERVICE_ROLE_KEY` : (copier depuis Studio)

## Migrations

### Créer une nouvelle migration

```bash
npx supabase migration new <nom_migration>
# Ex: npx supabase migration new add_custom_column
```

Éditer `migrations/<timestamp>_<nom>.sql`, puis appliquer:

```bash
npx supabase db push
```

### Vérifier le statut

```bash
npx supabase migration list
npx supabase db remote diff  # Comparer local vs remote
```

## RLS (Row Level Security)

### Tester l'isolation multi-tenant

Le setup RLS force l'isolation par tenant_id. Tester:

```sql
-- Se connecter comme utilisateur tenant 1
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

-- Voir ses données
SELECT * FROM catalogue_items;  -- ✅ Voir seulement tenant 1

-- Essayer d'accéder à un autre tenant
SELECT * FROM catalogue_items WHERE tenant_id = '22222222-2222-2222-2222-222222222222';
-- ❌ Aucune ligne (RLS bloque)
```

### Policies clés

- `is_admin_of()` : Vérifier rôle admin
- `is_member_of()` : Vérifier appartenance au tenant
- `get_user_tenant_id()` : Obtenir tenant_id de l'utilisateur courant

Voir `migrations/002_rls.sql` pour la liste complète.

## Audit Logs

Les triggers enregistrent automatiquement :
- **INSERT** : nouvelles données
- **UPDATE** : old_data et new_data
- **DELETE** : données supprimées

### Consulter les logs

```sql
-- Tous les changements pour un tenant
SELECT * FROM audit_logs WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
ORDER BY created_at DESC;

-- Changements par table
SELECT table_name, COUNT(*) as count FROM audit_logs
GROUP BY table_name;

-- Qui a modifié quoi
SELECT user_id, action, table_name, record_id, created_at FROM audit_logs
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

## Storage (Fichiers)

### Buckets

- `dpgf-uploads` : Fichiers DPGF importés (CSV, XLSX)
- `exports` : Exports générés (PDF, Excel)

### Créer un bucket

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('dpgf-uploads', 'dpgf-uploads', false);
```

### Upload depuis l'app

```typescript
// src/lib/storage.ts
const { data, error } = await supabase.storage
  .from('dpgf-uploads')
  .upload(`${tenantId}/dpgf/${filename}`, file);
```

## Production Supabase

Pour passer en production:

1. **Créer un projet** sur https://supabase.com
2. **Récupérer les credentials** (Project URL, Anon Key, Service Role Key)
3. **Configurer .env.production** :
   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_ANON_KEY=eyxx...
   SUPABASE_SERVICE_ROLE_KEY=eyxx...
   ```
4. **Appliquer les migrations** :
   ```bash
   npx supabase db push --db-url "postgresql://..."
   ```

## Troubleshooting

### RLS bloque tout
- Vérifier que l'utilisateur est dans `tenant_memberships`
- Vérifier le JWT contient le bon `sub` (user_id)

### Migrations ne s'appliquent pas
```bash
# Forcer une re-création
npx supabase db reset
npx supabase db push
```

### Erreur de connexion
```bash
# Vérifier que Docker tourne
docker ps | grep supabase

# Redémarrer
npx supabase stop && npx supabase start
```

## Références

- [Supabase Docs](https://supabase.com/docs)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Supabase Local Development](https://supabase.com/docs/guides/local-development)
