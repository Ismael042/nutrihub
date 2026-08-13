-- 0003 deu `usage` no schema auth pra nutrihub_app mas não grant nas tabelas dele —
-- suficiente enquanto só auth.py (conexão de dono) inseria em auth.users. Agora
-- app/routers/team.py insere um profissional novo (com user_id novo) usando a conexão
-- de tenant (nutrihub_app) — precisa de INSERT/SELECT em auth.users também.

grant select, insert on auth.users to nutrihub_app;
