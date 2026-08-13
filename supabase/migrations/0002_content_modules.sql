-- NutriHub — módulos de conteúdo clínico: metas, anamnese/questionário, exames,
-- listas de substituição, farmácias, prescrições, NutriPlan (tarefas/notas).

-- ---------------------------------------------------------------------------
-- Metas
-- ---------------------------------------------------------------------------

create table goals (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  description text not null,
  target_date date,
  achieved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Anamnese / questionário pré-consulta: modelos + respostas preenchidas
-- ---------------------------------------------------------------------------

create table questionnaire_templates (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  kind text not null check (kind in ('anamnesis', 'pre_consultation')),
  name text not null,
  fields jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table questionnaire_responses (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  template_id uuid not null references questionnaire_templates(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  answers jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Solicitações de exames laboratoriais
-- ---------------------------------------------------------------------------

create table lab_exam_requests (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  exams text not null,
  notes text,
  requested_at date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Listas de substituição (tenant_id nulo = modelo padrão do sistema, visível a todos)
-- ---------------------------------------------------------------------------

create table substitution_lists (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade,
  category text not null,
  name text not null,
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Farmácias (orçamento de suplementos/fitoterápicos)
-- ---------------------------------------------------------------------------

create table pharmacies (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Prescrições (suplementos / fitoterápicos)
-- ---------------------------------------------------------------------------

create table prescriptions (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  kind text not null check (kind in ('supplement', 'phytotherapic')),
  content text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- NutriPlan: tarefas e notas do profissional
-- ---------------------------------------------------------------------------

create table notes_tasks (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  kind text not null check (kind in ('task', 'note')),
  content text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS — mesmo padrão de 0001 (isolamento por tenant via current_tenant_ids())
-- ---------------------------------------------------------------------------

alter table goals enable row level security;
alter table questionnaire_templates enable row level security;
alter table questionnaire_responses enable row level security;
alter table lab_exam_requests enable row level security;
alter table substitution_lists enable row level security;
alter table pharmacies enable row level security;
alter table prescriptions enable row level security;
alter table notes_tasks enable row level security;

create policy tenant_isolation on goals
  for all using (tenant_id in (select current_tenant_ids()));

create policy tenant_isolation on questionnaire_templates
  for all using (tenant_id in (select current_tenant_ids()));

create policy tenant_isolation on questionnaire_responses
  for all using (tenant_id in (select current_tenant_ids()));

create policy tenant_isolation on lab_exam_requests
  for all using (tenant_id in (select current_tenant_ids()));

create policy tenant_isolation on pharmacies
  for all using (tenant_id in (select current_tenant_ids()));

create policy tenant_isolation on prescriptions
  for all using (tenant_id in (select current_tenant_ids()));

create policy tenant_isolation on notes_tasks
  for all using (tenant_id in (select current_tenant_ids()));

-- substitution_lists: tenant_id nulo (modelo do sistema) sempre legível; tenant_id
-- próprio restrito ao dono — mesmo padrão de `foods` em 0001.
create policy substitution_lists_read on substitution_lists
  for select using (tenant_id is null or tenant_id in (select current_tenant_ids()));

create policy substitution_lists_write on substitution_lists
  for insert with check (tenant_id in (select current_tenant_ids()));

create policy substitution_lists_update on substitution_lists
  for update using (tenant_id in (select current_tenant_ids()));

-- ---------------------------------------------------------------------------
-- Seed: 4 modelos prontos de lista de substituição (mapeados do Dietbox)
-- ---------------------------------------------------------------------------

insert into substitution_lists (tenant_id, category, name, items) values
  (null, 'fibra', 'Lista de substituição — Fibras', '[
    {"name": "Aveia em flocos", "portion": "3 colheres de sopa"},
    {"name": "Feijão cozido", "portion": "1 concha média"},
    {"name": "Maçã com casca", "portion": "1 unidade média"},
    {"name": "Pão integral", "portion": "2 fatias"},
    {"name": "Brócolis cozido", "portion": "4 colheres de sopa"}
  ]'::jsonb),
  (null, 'hipercalorico', 'Lista de substituição — Hipercalórico', '[
    {"name": "Pasta de amendoim", "portion": "2 colheres de sopa"},
    {"name": "Abacate", "portion": "1/2 unidade"},
    {"name": "Granola", "portion": "4 colheres de sopa"},
    {"name": "Castanha do Pará", "portion": "5 unidades"},
    {"name": "Azeite de oliva", "portion": "1 colher de sopa"}
  ]'::jsonb),
  (null, 'carboidratos', 'Lista de substituição — Carboidratos', '[
    {"name": "Arroz branco cozido", "portion": "4 colheres de sopa"},
    {"name": "Batata doce cozida", "portion": "1 unidade média"},
    {"name": "Macarrão cozido", "portion": "1 escumadeira"},
    {"name": "Pão francês", "portion": "1 unidade"},
    {"name": "Mandioca cozida", "portion": "2 pedaços médios"}
  ]'::jsonb),
  (null, 'proteinas', 'Lista de substituição — Proteínas', '[
    {"name": "Peito de frango grelhado", "portion": "1 filé médio (120g)"},
    {"name": "Ovo cozido", "portion": "2 unidades"},
    {"name": "Filé de tilápia", "portion": "1 filé médio (120g)"},
    {"name": "Queijo cottage", "portion": "4 colheres de sopa"},
    {"name": "Tofu firme", "portion": "100g"}
  ]'::jsonb);

-- ---------------------------------------------------------------------------
-- Seed: alguns alimentos de exemplo (base 'taco', valores por 100g) — não é a
-- base Taco completa, só um punhado pra deixar Planos alimentares testável.
-- Popular a base real fica para quando houver fonte de dados oficial integrada.
-- ---------------------------------------------------------------------------

insert into foods (tenant_id, source, name, kcal, protein_g, carbs_g, fat_g) values
  (null, 'taco', 'Arroz branco cozido', 128, 2.5, 28.1, 0.2),
  (null, 'taco', 'Feijão carioca cozido', 76, 4.8, 13.6, 0.5),
  (null, 'taco', 'Peito de frango grelhado', 159, 32.0, 0, 2.5),
  (null, 'taco', 'Ovo de galinha cozido', 146, 13.3, 0.6, 9.5),
  (null, 'taco', 'Banana prata', 98, 1.3, 26.0, 0.1),
  (null, 'taco', 'Batata doce cozida', 77, 0.6, 18.4, 0.1),
  (null, 'taco', 'Brócolis cozido', 25, 2.1, 4.4, 0.3),
  (null, 'taco', 'Aveia em flocos', 394, 13.9, 67.0, 8.5),
  (null, 'taco', 'Azeite de oliva', 884, 0, 0, 100.0),
  (null, 'taco', 'Leite integral', 61, 2.9, 4.3, 3.5);
