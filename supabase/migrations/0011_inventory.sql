-- Estoque simples de produtos/suplementos pra venda no consultório — diferenciação
-- de mercado (nenhum concorrente de nutrição pesquisado tem isso nativo).

create table inventory_items (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  unit text not null default 'unidade',
  quantity numeric not null default 0,
  unit_price_cents bigint not null default 0,
  created_at timestamptz not null default now()
);

alter table inventory_items enable row level security;
alter table inventory_items force row level security;

create policy tenant_isolation on inventory_items
  for all using (tenant_id in (select current_tenant_ids()));
