# NutriHub — Supabase

`migrations/0001_init.sql` modela o schema multi-tenant inicial (tenants, profissionais, pacientes, agenda, alimentos/cardápios/planos, financeiro, chat), com Row Level Security isolando cada tenant.

Em dev local (Docker Compose), essa migration é aplicada direto no Postgres local via `docker-entrypoint-initdb.d`. Em produção, aplicar no projeto Supabase real:

```bash
supabase link --project-ref <ref>
supabase db push
```
