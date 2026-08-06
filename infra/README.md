# NutriHub — Infra local

```bash
cp ../.env.example ../.env
docker compose -f docker-compose.yml up --build
```

- `db`: Postgres 16, aplica `supabase/migrations/*.sql` automaticamente na primeira subida (via `docker-entrypoint-initdb.d`). Para reaplicar do zero: `docker compose down -v`.
- `redis`: cache/fila.
- `api`: FastAPI, build a partir de `services/api/Dockerfile` (contexto = raiz do repo, pra poder acessar `packages/shared` se precisar futuramente).
- `web`: Next.js standalone, build a partir de `apps/web/Dockerfile`.

O app mobile (`apps/mobile`) não entra aqui — roda via `npx expo start` no host, fora do Docker (ver `apps/mobile/README.md`).

Em produção, `db` deixa de existir no Compose: `api` e `web` passam a apontar para o Supabase gerenciado (cloud), via `.env` real. `api`/`web` seguem como os mesmos containers, só trocando variáveis de ambiente.

## Validado

Stack testada de ponta a ponta em 2026-08-05: `db` aplica as migrations e sobe saudável, `api` builda e responde em `/health` e `/docs`, `web` builda (Next.js standalone) e renderiza a home. Pré-requisito local: o drive onde o repo mora precisa estar habilitado em Docker Desktop → Settings → Resources → File Sharing; se o Compose falhar com `mkdir /run/desktop/mnt/host/...: file exists`, rode `wsl --shutdown` e deixe o Docker Desktop reiniciar sozinho.

**Pendência conhecida**: `apps/web/Dockerfile` usa `pnpm install` sem `--frozen-lockfile` porque ainda não existe `pnpm-lock.yaml` commitado (ninguém rodou `pnpm install` localmente ainda). Assim que isso acontecer, commitar o lockfile e trocar para `--frozen-lockfile` no Dockerfile, pra builds reprodutíveis.
