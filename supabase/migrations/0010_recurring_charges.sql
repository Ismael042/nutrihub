-- Cobrança recorrente — bookkeeping local (pacotes de sessões, aluguel mensal etc.),
-- NÃO processa pagamento real (isso depende de gateway externo, fora do que dá pra
-- construir sem credencial). O que existe: um modelo de cobrança recorrente que gera
-- um `financial_transactions` pendente sob demanda (endpoint /generate) e avança a
-- próxima data — não há scheduler/cron automático nesta fase.

create table recurring_charges (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  patient_id uuid references patients(id) on delete set null,
  kind text not null default 'income' check (kind in ('income', 'expense')),
  description text not null,
  amount_cents bigint not null,
  category text,
  frequency text not null check (frequency in ('weekly', 'monthly')),
  next_due_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table recurring_charges enable row level security;
alter table recurring_charges force row level security;

create policy tenant_isolation on recurring_charges
  for all using (tenant_id in (select current_tenant_ids()));
