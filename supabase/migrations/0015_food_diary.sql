-- Diário alimentar básico do paciente — registro manual (sem reconhecimento de foto
-- por IA, que depende de credencial/modelo externo, fora do que dá pra construir sem
-- conta). O profissional só lê; quem escreve é o paciente pelo app.

create table food_diary_entries (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  logged_at timestamptz not null default now(),
  meal_kind text check (meal_kind in ('breakfast', 'lunch', 'dinner', 'snack')),
  description text not null,
  created_at timestamptz not null default now()
);

alter table food_diary_entries enable row level security;
alter table food_diary_entries force row level security;

create policy tenant_isolation on food_diary_entries
  for all using (tenant_id in (select current_tenant_ids()));
