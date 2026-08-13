-- Página pública do profissional + agendamento online. Decisão de escopo original
-- (ARCHITECTURE.md) tratava isso como "iniciativa grande, adiada" por ser um
-- construtor de página completo — o que construímos aqui é mais estreito: uma página
-- pública fixa (nome + bio) com formulário de solicitação de horário, sem builder
-- visual nem domínio próprio. `public_slug` só é setado quando o profissional
-- explicitamente habilita (public_booking_enabled) — sem isso, nada fica exposto.

alter table professionals add column public_slug text unique;
alter table professionals add column bio text;
alter table professionals add column public_booking_enabled boolean not null default false;

-- Pedido de horário não vira agendamento direto — o profissional aprova/recusa (ver
-- app/routers/booking_requests.py), pra formulário público não poder criar
-- compromisso na agenda sem revisão humana.
create table booking_requests (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  professional_id uuid not null references professionals(id) on delete cascade,
  patient_name text not null,
  patient_email text,
  patient_phone text,
  requested_at timestamptz not null,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table booking_requests enable row level security;
alter table booking_requests force row level security;

create policy tenant_isolation on booking_requests
  for all using (tenant_id in (select current_tenant_ids()));
