-- Role de aplicação sem bypass de RLS + RLS real via GUC de sessão.
--
-- Até aqui a API só conectava como `nutrihub`, dona das tabelas — dono de tabela
-- sempre bypassa RLS no Postgres, então as policies de 0001/0002 nunca bloqueavam
-- nada de verdade: o isolamento multi-tenant era 100% o filtro `tenant_id` escrito à
-- mão em cada query. Esta migration separa duas roles: `nutrihub` continua sendo a
-- dona, usada só por app/routers/auth.py (signup precisa criar o primeiro registro
-- de um tenant novo; login precisa achar um profissional pelo e-mail entre todos os
-- tenants — as duas coisas são inerentemente cross-tenant, antes de existir sessão).
-- `nutrihub_app`, criada aqui, não é dona de nada e por isso fica sujeita a RLS de
-- verdade — é a role usada por toda rota autenticada (ver app/core/db.py::tenant_connection).
--
-- current_tenant_ids() deixa de olhar auth.uid() (nunca populado numa conexão asyncpg
-- direta, sem PostgREST/GoTrue no meio) e passa a ler a GUC de sessão
-- `app.current_tenant_id`, setada pela API a cada conexão emprestada do pool de app.

create role nutrihub_app login password 'nutrihub_app_dev_password';

grant usage on schema public to nutrihub_app;
grant usage on schema auth to nutrihub_app;
grant select, insert, update, delete on all tables in schema public to nutrihub_app;
alter default privileges in schema public grant select, insert, update, delete on tables to nutrihub_app;

create or replace function current_tenant_ids()
returns setof uuid
language sql
stable
as $$
  select nullif(current_setting('app.current_tenant_id', true), '')::uuid
$$;

-- FORCE não é necessário pra nutrihub_app (RLS já vale pra qualquer role não-dona),
-- mas garante que a policy também vale se algum dia uma query administrativa rodar
-- como `nutrihub` fora do fluxo de signup/login.
alter table professionals force row level security;
alter table locations force row level security;
alter table patients force row level security;
alter table tags force row level security;
alter table patient_tags force row level security;
alter table appointments force row level security;
alter table foods force row level security;
alter table recipes force row level security;
alter table diet_plans force row level security;
alter table meals force row level security;
alter table meal_items force row level security;
alter table financial_transactions force row level security;
alter table chat_messages force row level security;
alter table goals force row level security;
alter table questionnaire_templates force row level security;
alter table questionnaire_responses force row level security;
alter table lab_exam_requests force row level security;
alter table substitution_lists force row level security;
alter table pharmacies force row level security;
alter table prescriptions force row level security;
alter table notes_tasks force row level security;
