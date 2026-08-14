FROM node:20-slim AS base
WORKDIR /repo
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --filter @nutrihub/web...

FROM base AS build
# NEXT_PUBLIC_* precisa existir no ambiente de `next build` (é inlined no bundle do
# client, não lido em runtime) — por isso vira build arg, não só env de runtime do
# container. Default preserva o comportamento local de sempre (localhost:8000).
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY --from=deps /repo /repo
COPY . .
RUN pnpm --filter @nutrihub/web... build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
