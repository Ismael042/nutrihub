-- Antropometria estruturada: uma linha por medição/consulta, permite evolução ao
-- longo do tempo (gráfico) em vez de só o texto livre de anamnese que já existia.

create table anthropometric_measurements (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  measured_at date not null default current_date,
  weight_kg numeric,
  height_cm numeric,
  body_fat_pct numeric,
  waist_cm numeric,
  hip_cm numeric,
  neck_cm numeric,
  notes text,
  created_at timestamptz not null default now()
);

alter table anthropometric_measurements enable row level security;
alter table anthropometric_measurements force row level security;

create policy tenant_isolation on anthropometric_measurements
  for all using (tenant_id in (select current_tenant_ids()));
