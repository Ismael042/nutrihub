-- NutriHub — schema inicial, multi-tenant via RLS
-- Cada nutricionista/clínica é um tenant; toda tabela operacional carrega tenant_id.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Tenants e profissionais
-- ---------------------------------------------------------------------------

create table tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  plan text not null default 'trial',
  created_at timestamptz not null default now()
);

-- Um profissional pertence a um tenant e está ligado a um usuário de auth.users.
create table professionals (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  password_hash text not null,
  cpf text,
  phone text,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Pacientes, locais de atendimento, agenda
-- ---------------------------------------------------------------------------

create table locations (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  kind text not null default 'in_person' check (kind in ('in_person', 'video')),
  address text,
  created_at timestamptz not null default now()
);

create table patients (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  birth_date date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create table tags (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  unique (tenant_id, name)
);

create table patient_tags (
  patient_id uuid not null references patients(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (patient_id, tag_id)
);

create table appointments (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'canceled', 'no_show')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Alimentos, cardápios, planos alimentares
-- ---------------------------------------------------------------------------

-- tenant_id nulo = base pública compartilhada (Taco, IBGE, USDA, TBCA, Tucunduva).
create table foods (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade,
  source text not null check (source in
    ('taco', 'ibge', 'usda', 'tbca', 'tucunduva', 'supplement', 'custom')),
  name text not null,
  kcal numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0
);

create table recipes (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  instructions text,
  created_at timestamptz not null default now()
);

create table diet_plans (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  name text not null,
  pdf_url text,
  created_at timestamptz not null default now()
);

create table meals (
  id uuid primary key default uuid_generate_v4(),
  diet_plan_id uuid not null references diet_plans(id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create table meal_items (
  id uuid primary key default uuid_generate_v4(),
  meal_id uuid not null references meals(id) on delete cascade,
  food_id uuid not null references foods(id),
  quantity numeric not null,
  unit text not null default 'g'
);

-- ---------------------------------------------------------------------------
-- Financeiro, chat
-- ---------------------------------------------------------------------------

create table financial_transactions (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  patient_id uuid references patients(id) on delete set null,
  kind text not null check (kind in ('income', 'expense')),
  amount_cents bigint not null,
  due_date date,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table chat_messages (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  sender text not null check (sender in ('professional', 'patient')),
  content text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security — isolamento multi-tenant
-- ---------------------------------------------------------------------------

create or replace function current_tenant_ids()
returns setof uuid
language sql
stable
as $$
  select tenant_id from professionals where user_id = auth.uid();
$$;

alter table tenants enable row level security;
alter table professionals enable row level security;
alter table locations enable row level security;
alter table patients enable row level security;
alter table tags enable row level security;
alter table patient_tags enable row level security;
alter table appointments enable row level security;
alter table foods enable row level security;
alter table recipes enable row level security;
alter table diet_plans enable row level security;
alter table meals enable row level security;
alter table meal_items enable row level security;
alter table financial_transactions enable row level security;
alter table chat_messages enable row level security;

create policy tenant_isolation on professionals
  for all using (tenant_id in (select current_tenant_ids()));

create policy tenant_isolation on locations
  for all using (tenant_id in (select current_tenant_ids()));

create policy tenant_isolation on patients
  for all using (tenant_id in (select current_tenant_ids()));

create policy tenant_isolation on tags
  for all using (tenant_id in (select current_tenant_ids()));

create policy tenant_isolation on appointments
  for all using (tenant_id in (select current_tenant_ids()));

create policy tenant_isolation on recipes
  for all using (tenant_id in (select current_tenant_ids()));

create policy tenant_isolation on diet_plans
  for all using (tenant_id in (select current_tenant_ids()));

create policy tenant_isolation on financial_transactions
  for all using (tenant_id in (select current_tenant_ids()));

create policy tenant_isolation on chat_messages
  for all using (tenant_id in (select current_tenant_ids()));

-- foods: tenant_id nulo (base pública) é sempre legível; tenant_id próprio, restrito ao dono.
create policy foods_read on foods
  for select using (tenant_id is null or tenant_id in (select current_tenant_ids()));

create policy foods_write on foods
  for insert with check (tenant_id in (select current_tenant_ids()));

create policy foods_update on foods
  for update using (tenant_id in (select current_tenant_ids()));

-- meals/meal_items/patient_tags herdam isolamento via join com a tabela pai.
create policy tenant_isolation on meals
  for all using (
    diet_plan_id in (select id from diet_plans where tenant_id in (select current_tenant_ids()))
  );

create policy tenant_isolation on meal_items
  for all using (
    meal_id in (
      select m.id from meals m
      join diet_plans dp on dp.id = m.diet_plan_id
      where dp.tenant_id in (select current_tenant_ids())
    )
  );

create policy tenant_isolation on patient_tags
  for all using (
    patient_id in (select id from patients where tenant_id in (select current_tenant_ids()))
  );
