# Arquitetura — NutriHub

## Visão geral

```
                    ┌─────────────────┐
                    │   Supabase       │
                    │  Postgres+Auth   │
                    │  +Storage (RLS)  │
                    └───┬─────────┬───┘
                        │         │
              ┌─────────┘         └─────────┐
              │                             │
      ┌───────▼───────┐             ┌───────▼───────┐
      │  apps/web      │             │ services/api   │
      │  Next.js 14    │◄───REST────┤  FastAPI       │
      │  (nutricionista)│            │  (cálculo,PDF) │
      └────────────────┘             └───────┬───────┘
                                              │
      ┌────────────────┐                     │
      │  apps/mobile    │◄────REST/Supabase──┘
      │  Expo (paciente)│
      └────────────────┘
```

## Por que essa divisão

- **Supabase como fonte de verdade dos dados**: reaproveita o padrão já validado no projeto Gestão Varejo (Next.js + Supabase multi-empresa). Auth, Storage (fotos, PDFs, materiais) e RLS multi-tenant saem prontos, sem reescrever o que já funciona.
- **Web e mobile falam direto com o Supabase** para CRUD simples (pacientes, agenda, chat) via `@supabase/supabase-js` — menos latência, menos código de API para manter.
- **FastAPI só entra onde Supabase não resolve sozinho**: cálculo de necessidades nutricionais, geração de PDF de planos alimentares/anamneses, e qualquer integração externa (ex. envio de recados em massa, futura integração WhatsApp). Isso mantém a API pequena e focada, em vez de duplicar um CRUD que o Supabase já expõe.
- **`packages/shared`**: tipos TypeScript e regras de negócio (ex. cálculo de macros básico, formatação) usados tanto pelo `web` quanto pelo `mobile`, para não divergir a lógica entre as duas telas.

## Multi-tenant

Cada nutricionista (ou clínica, no futuro) é um `tenant`. Todas as tabelas operacionais têm `tenant_id` e Row Level Security no Postgres garante isolamento — o mesmo padrão usado no Gestão Varejo. Isso significa que, embora o MVP sirva só a Joice, o schema já nasce pronto para múltiplos tenants sem migração de arquitetura depois.

Ver `supabase/migrations/0001_init.sql` para o modelo de dados completo.

## Mobile e app stores

Expo foi escolhido em vez de React Native puro porque:
- Build gerenciado (EAS Build) publica para App Store e Google Play sem precisar de Xcode/Android Studio configurados localmente.
- Atualizações OTA (EAS Update) permitem corrigir bugs de JS sem passar por novo review de loja.
- Mesma linguagem (TypeScript) e mesmos tipos de `packages/shared` usados no dashboard web.

## Docker

`infra/docker-compose.yml` modela a execução local:
- `db`: Postgres 16, schema aplicado a partir de `supabase/migrations/`
- `redis`: cache e fila (ex. lembretes de agendamento, processamento de PDF assíncrono)
- `api`: FastAPI containerizado
- `web`: Next.js containerizado (build de produção)

Em produção, `db`/`auth`/`storage` passam a ser o Supabase gerenciado (cloud) — o Postgres local do Compose existe só para desenvolvimento offline e paridade de schema. `api` e `web` usam a mesma imagem Docker tanto localmente quanto no deploy (Fly.io, Railway ou VPS próprio).

## Roadmap de arquitetura

1. **MVP mono-tenant funcional** para a Joice (pacientes, agenda, planos alimentares, PDF).
2. **Multi-tenant real**: onboarding self-service de novos profissionais, billing (Stripe), plano gratuito/pago.
3. **App mobile do paciente** publicado nas lojas (visão do plano alimentar, chat, agendamento).
4. **App mobile da nutricionista** (opcional, se o dashboard web não bastar em mobilidade).
