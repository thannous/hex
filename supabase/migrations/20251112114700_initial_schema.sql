-- Enable extensions required for UUID generation and case-insensitive fields
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'role_type') then
    create type public.role_type as enum ('admin', 'engineer', 'viewer');
  end if;
  if not exists (select 1 from pg_type where typname = 'import_status') then
    create type public.import_status as enum ('pending', 'processing', 'parsed', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'quote_status') then
    create type public.quote_status as enum ('draft', 'sent', 'won', 'lost');
  end if;
end $$;

-- Core tenant tables
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug citext not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.role_type not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

-- Pricebook & catalogue
create table if not exists public.catalogue_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  hex_code text not null,
  designation text not null,
  temps_unitaire_h numeric,
  unite_mesure text,
  dn text,
  pn text,
  matiere text,
  connexion text,
  discipline text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, hex_code)
);

create table if not exists public.supplier_prices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  catalogue_item_id uuid not null references public.catalogue_items (id) on delete cascade,
  supplier_name text not null,
  prix_brut numeric not null,
  remise_pct numeric not null default 0,
  prix_net numeric generated always as (
    round(prix_brut * (1 - (coalesce(remise_pct, 0) / 100)), 4)
  ) stored,
  validite_fin date,
  delai_jours integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_indices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  matiere text not null,
  index_date date not null,
  coefficient numeric not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, matiere, index_date)
);

create table if not exists public.pricing_params (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  lot text default 'global',
  discipline text default 'global',
  taux_horaire_eur numeric not null,
  marge_pct numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, lot, discipline)
);

-- Imports & mapping
create table if not exists public.dpgf_imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  filename text not null,
  storage_path text not null,
  status public.import_status not null default 'pending',
  row_count integer,
  parsed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dpgf_rows_raw (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  import_id uuid not null references public.dpgf_imports (id) on delete cascade,
  row_index integer not null,
  raw_data jsonb not null,
  created_at timestamptz not null default now(),
  unique (import_id, row_index)
);

create table if not exists public.dpgf_rows_mapped (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  import_id uuid not null references public.dpgf_imports (id) on delete cascade,
  row_index integer not null,
  catalogue_item_id uuid references public.catalogue_items (id),
  hex_code text,
  quantity numeric,
  unit text,
  mapping_source text,
  confidence numeric,
  created_at timestamptz not null default now(),
  unique (import_id, row_index)
);

create table if not exists public.mapping_memory (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  normalized_label text not null,
  hex_code text not null,
  confidence numeric not null default 0,
  usage_count integer not null default 0,
  last_used_at timestamptz not null default now(),
  unique (tenant_id, normalized_label)
);

-- Quotes
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  reference text,
  status public.quote_status not null default 'draft',
  valid_until date,
  created_by uuid not null references auth.users (id),
  meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  catalogue_item_id uuid references public.catalogue_items (id),
  designation text not null,
  quantity numeric not null,
  unite text,
  cout_achat_u numeric,
  mo_u numeric,
  pv_u numeric,
  flags jsonb default '[]'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Audit logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid,
  action text not null,
  table_name text not null,
  record_id uuid not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

-- Updated_at helper
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.log_row_audit()
returns trigger as $$
declare
  tenant_id uuid;
  actor uuid := auth.uid();
begin
  if tg_op = 'DELETE' then
    tenant_id := old.tenant_id;
  else
    tenant_id := new.tenant_id;
  end if;

  insert into public.audit_logs (tenant_id, user_id, action, table_name, record_id, old_data, new_data)
  values (
    tenant_id,
    actor,
    tg_op,
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then old.id else new.id end), gen_random_uuid()),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Attach updated_at triggers
create trigger set_catalogue_items_updated_at
  before update on public.catalogue_items
  for each row execute function public.set_updated_at();

create trigger set_supplier_prices_updated_at
  before update on public.supplier_prices
  for each row execute function public.set_updated_at();

create trigger set_pricing_params_updated_at
  before update on public.pricing_params
  for each row execute function public.set_updated_at();

create trigger set_dpgf_imports_updated_at
  before update on public.dpgf_imports
  for each row execute function public.set_updated_at();

create trigger set_quotes_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

create trigger set_quote_lines_updated_at
  before update on public.quote_lines
  for each row execute function public.set_updated_at();

-- Attach audit triggers to tenant scoped tables
create trigger audit_catalogue_items
  after insert or update or delete on public.catalogue_items
  for each row execute function public.log_row_audit();

create trigger audit_supplier_prices
  after insert or update or delete on public.supplier_prices
  for each row execute function public.log_row_audit();

create trigger audit_material_indices
  after insert or update or delete on public.material_indices
  for each row execute function public.log_row_audit();

create trigger audit_pricing_params
  after insert or update or delete on public.pricing_params
  for each row execute function public.log_row_audit();

create trigger audit_dpgf_imports
  after insert or update or delete on public.dpgf_imports
  for each row execute function public.log_row_audit();

create trigger audit_dpgf_rows_mapped
  after insert or update or delete on public.dpgf_rows_mapped
  for each row execute function public.log_row_audit();

create trigger audit_quotes
  after insert or update or delete on public.quotes
  for each row execute function public.log_row_audit();

create trigger audit_quote_lines
  after insert or update or delete on public.quote_lines
  for each row execute function public.log_row_audit();

-- RLS policies
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.catalogue_items enable row level security;
alter table public.supplier_prices enable row level security;
alter table public.material_indices enable row level security;
alter table public.pricing_params enable row level security;
alter table public.dpgf_imports enable row level security;
alter table public.dpgf_rows_raw enable row level security;
alter table public.dpgf_rows_mapped enable row level security;
alter table public.mapping_memory enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_lines enable row level security;
alter table public.audit_logs enable row level security;

create policy tenant_view_policy on public.tenants
  for select using (
    exists (
      select 1 from public.tenant_memberships tm
      where tm.tenant_id = tenants.id and tm.user_id = auth.uid()
    )
  );

create policy profile_self_access on public.profiles
  for select using (id = auth.uid());

create policy memberships_by_user on public.tenant_memberships
  for select using (user_id = auth.uid());

create policy tenant_memberships_admin_insert on public.tenant_memberships
  for insert with check (
    exists (
      select 1 from public.tenant_memberships tm
      where tm.tenant_id = tenant_memberships.tenant_id
        and tm.user_id = auth.uid()
        and tm.role = 'admin'
    )
  );

create policy tenant_memberships_admin_update on public.tenant_memberships
  for update using (
    exists (
      select 1 from public.tenant_memberships tm
      where tm.tenant_id = tenant_memberships.tenant_id
        and tm.user_id = auth.uid()
        and tm.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from public.tenant_memberships tm
      where tm.tenant_id = tenant_memberships.tenant_id
        and tm.user_id = auth.uid()
        and tm.role = 'admin'
    )
  );

create policy tenant_memberships_admin_delete on public.tenant_memberships
  for delete using (
    exists (
      select 1 from public.tenant_memberships tm
      where tm.tenant_id = tenant_memberships.tenant_id
        and tm.user_id = auth.uid()
        and tm.role = 'admin'
    )
  );

-- Helper policy generator for tenant scoped tables
create or replace function public.is_member_of(tenant uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = tenant and tm.user_id = auth.uid()
  );
end;
$$ language plpgsql stable security definer;

create or replace function public.is_admin_of(tenant uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = tenant and tm.user_id = auth.uid() and tm.role = 'admin'
  );
end;
$$ language plpgsql stable security definer;

-- Apply generic policies
create policy tenant_table_select on public.catalogue_items
  for select using (public.is_member_of(tenant_id));
create policy tenant_table_mutate on public.catalogue_items
  for all using (public.is_member_of(tenant_id)) with check (public.is_member_of(tenant_id));

create policy tenant_table_select_supplier_prices on public.supplier_prices
  for select using (public.is_member_of(tenant_id));
create policy tenant_table_mutate_supplier_prices on public.supplier_prices
  for all using (public.is_member_of(tenant_id)) with check (public.is_member_of(tenant_id));

create policy tenant_table_select_material_indices on public.material_indices
  for select using (public.is_member_of(tenant_id));
create policy tenant_table_mutate_material_indices on public.material_indices
  for all using (public.is_member_of(tenant_id)) with check (public.is_member_of(tenant_id));

create policy tenant_table_select_pricing_params on public.pricing_params
  for select using (public.is_member_of(tenant_id));
create policy tenant_table_mutate_pricing_params on public.pricing_params
  for all using (public.is_member_of(tenant_id)) with check (public.is_member_of(tenant_id));

create policy tenant_table_select_imports on public.dpgf_imports
  for select using (public.is_member_of(tenant_id));
create policy tenant_table_mutate_imports on public.dpgf_imports
  for all using (public.is_member_of(tenant_id)) with check (public.is_member_of(tenant_id));

create policy tenant_table_select_rows_raw on public.dpgf_rows_raw
  for select using (public.is_member_of(tenant_id));
create policy tenant_table_mutate_rows_raw on public.dpgf_rows_raw
  for all using (public.is_member_of(tenant_id)) with check (public.is_member_of(tenant_id));

create policy tenant_table_select_rows_mapped on public.dpgf_rows_mapped
  for select using (public.is_member_of(tenant_id));
create policy tenant_table_mutate_rows_mapped on public.dpgf_rows_mapped
  for all using (public.is_member_of(tenant_id)) with check (public.is_member_of(tenant_id));

create policy tenant_table_select_memory on public.mapping_memory
  for select using (public.is_member_of(tenant_id));
create policy tenant_table_mutate_memory on public.mapping_memory
  for all using (public.is_member_of(tenant_id)) with check (public.is_member_of(tenant_id));

create policy tenant_table_select_quotes on public.quotes
  for select using (public.is_member_of(tenant_id));
create policy tenant_table_mutate_quotes on public.quotes
  for all using (public.is_member_of(tenant_id)) with check (public.is_member_of(tenant_id));

create policy tenant_table_select_quote_lines on public.quote_lines
  for select using (public.is_member_of(tenant_id));
create policy tenant_table_mutate_quote_lines on public.quote_lines
  for all using (public.is_member_of(tenant_id)) with check (public.is_member_of(tenant_id));

create policy audit_logs_admin_only on public.audit_logs
  for select using (public.is_admin_of(tenant_id));
