# NutriHub

Sistema de gestão para nutricionistas — dashboard web para o profissional + app mobile para o paciente.

Projeto pessoal de **Ismael**, **Plinio** e **Joice**. Nasce sob medida para o consultório da Joice (nutricionista), com arquitetura pensada desde o início para virar SaaS multitenant.

## Por que existe

Mapeamos um concorrente (Dietbox) e vamos construir uma versão própria, evoluindo além do que ele oferece. Ver `docs/mapeamento-dietbox.md` para o levantamento funcional completo que guia o roadmap.

## Estrutura do monorepo

```
apps/
  web/      Next.js 14 — painel da nutricionista (pacientes, agenda, financeiro, planos alimentares)
  mobile/   Expo (React Native) — app do paciente, publicável nas app stores
services/
  api/      FastAPI — motor de cálculo nutricional, geração de PDF, integrações
packages/
  shared/   Tipos e lógica de domínio compartilhados entre web e mobile (TypeScript)
supabase/
  migrations/  Schema Postgres versionado (multi-tenant via RLS)
infra/
  docker-compose.yml  Sobe api + web + postgres local + redis para desenvolvimento
```

## Stack

- **Web**: Next.js 14 (App Router), TypeScript
- **Mobile**: Expo / React Native, TypeScript — compartilha `packages/shared` com o web
- **API**: FastAPI (Python) — regras de cálculo nutricional, geração de PDF de planos/anamneses, jobs que não fazem sentido em edge functions
- **Dados**: Supabase (Postgres + Auth + Storage), isolamento multi-tenant via Row Level Security (`tenant_id`)
- **Infra local**: Docker Compose (Postgres local espelhando o schema do Supabase, Redis para filas/cache, api e web containerizados)

Ver `ARCHITECTURE.md` para o racional de cada escolha e o modelo de dados multi-tenant.

## Rodando localmente

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up --build
```

- Web: http://localhost:3000
- API: http://localhost:8000/docs
- Postgres: localhost:5432

Para o mobile (roda fora do Docker, via Expo):

```bash
cd apps/mobile
npm install
npx expo start
```

## Status

Scaffold inicial — estrutura de pastas, contratos de API e schema de banco modelados; implementação das telas e regras de negócio é o próximo passo.
