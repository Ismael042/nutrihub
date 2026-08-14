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

- **Decisão de arquitetura (2026-08-13): tudo passa pela FastAPI, não Supabase direto.**
  O plano original desta seção era web/mobile falarem direto com o Supabase
  (`@supabase/supabase-js`) para CRUD simples, e a API só cobrir cálculo/PDF/integrações.
  Na prática, desde o primeiro módulo (Pacientes), 100% do CRUD sempre passou pela
  FastAPI — o SDK do Supabase nunca chegou a ser importado em nenhum código, só ficava
  como dependência não usada em `apps/web`, `apps/mobile` e `services/api/requirements.txt`.
  Formalizamos isso como decisão, não desvio: **`services/api` é o único cliente do
  Postgres**, tanto pro painel da nutricionista quanto pro app do paciente
  (`/patient-portal/*`, `/patient-auth/*`). Removemos o SDK das dependências dos três
  lugares. Motivo de manter assim (não voltar pro plano original): a API já cobre auth
  própria, RLS de verdade (ver seção seguinte) e toda a lógica de negócio num único
  lugar — duplicar esse caminho com Supabase direto criaria duas fontes de verdade pra
  autorização.
- **`packages/shared`**: tipos TypeScript (espelhando o JSON real que cada router
  devolve, não uma forma aspiracional) e constantes de marca (`colors.ts`) usados tanto
  pelo `web` quanto pelo `mobile`, para não divergir a forma dos dados entre as duas
  telas. Cobre hoje as ~25 entidades do domínio (Patient, Appointment, DietPlan,
  FinancialTransaction, TeamMember, ChatMessage, RecurringCharge, InventoryItem,
  BookingRequest etc. — ver `packages/shared/src/types.ts`).
- **Supabase (gerenciado) continua sendo o Postgres em produção** — só que acessado
  exclusivamente pela FastAPI, nunca pelo navegador/app diretamente. Storage (fotos,
  PDFs) fica como candidato natural pra uso futuro via `supabase_service_role_key` no
  backend, se/quando precisar — não pelo cliente.

## Design/UI: tokens globais em CSS, não estilo por página

Paleta da marca (`packages/shared/src/colors.ts` — fonte única, consumida também pelo
`apps/mobile`): `primary #0F9D74` (verde), `dark #252525`, `white #FFFFFF`,
`accent #B08D57` (dourado).

No `apps/web`, os tokens viram variáveis CSS em `app/globals.css`, com estilo aplicado
direto nos elementos HTML nativos (`body`, `a`, `button`, `input`, `h1`) — não em cada
página. Como a maioria das ~26 páginas usa `style={{}}` só para layout (padding, gap,
display) e não define cor, isso cascateia automaticamente pra todo o app sem precisar
editar página por página. Existe uma classe `.btn-primary` (verde, texto branco) pra
CTAs principais (submit de formulário, "+ Novo X") — o `<button>` nativo sem essa classe
já sai neutro (branco/borda cinza) por padrão, então botões secundários (excluir,
cancelar) não precisam de tratamento especial.

**How to apply:** telas novas não devem definir cor via `style={{color: "#..."}}` pros
elementos que já têm tratamento global (`h1`, `a`, `button`, `input`) — só usar
`className="btn-primary"` no CTA principal da página. Cores fora da paleta (ex.
`crimson` pra erro/exclusão, `#666` pra texto secundário) continuam sendo definidas
inline caso a caso, isso é esperado e não faz parte da paleta de marca.

Utilitários adicionais em `globals.css`, usados primeiro no dashboard (2026-08-06) e
reaproveitáveis em qualquer tela nova: `.app-header` (cabeçalho fixo escuro com marca +
ações, quebra em duas linhas no celular via `flex-wrap`), `.card` (bloco com borda que
realça em verde no hover — usar pra qualquer agrupamento de conteúdo, não só o grid de
navegação do dashboard), `.dashboard-grid` (1 coluna celular / 2 tablet / 4 desktop —
contagem fixa pensada pros 4 grupos de hoje, não `auto-fit`, ver comentário no
`globals.css` se o número de grupos mudar), `.page-container` (960px, centralizado,
padding responsivo via `clamp` — telas de listagem/conteúdo) e `.form-container` (440px,
centralizado — telas de formulário único, evita input esticando 900px+ de largura).

Dois utilitários novos (2026-08-06, tela "Listas de substituição" — primeira página do
refinamento visual pós-branding): `.card-grid` (grid de cards com contagem variável —
`repeat(auto-fill, minmax(280px, 1fr))` — usar em vez de `.dashboard-grid` sempre que o
número de itens vier de dados, não de uma lista fixa de grupos) e `.badge` (selo pequeno
arredondado pra rótulos curtos tipo "modelo padrão" — reaproveitável pra qualquer status/
marcação pontual, ex. "pago"/"pendente" no financeiro se for revisitado).

**`.page-title-row`** (2026-08-06 — bugfix real, não só estética): substitui o padrão
`<div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>`
usado pra "h1 + botão/link de ação" no topo de Pacientes, Agenda, Financeiro, Planos
alimentares, Anamnese/Questionário e detalhe do Plano. Sem `flex-wrap: wrap`, título e
CTA não quebravam linha — em título mais longo ("Anamnese / Questionário") ou tela
estreita, o botão chegava a **sobrepor visualmente o texto do `<h1>`** em vez de cair pra
baixo. Confirmado com Playwright (viewport 360px) antes/depois de corrigir. Página nova
com esse padrão (h1 + CTA lado a lado) deve usar `className="page-title-row"`, nunca a
`<div style={{}}>` inline sem wrap.

**Todas as ~26 páginas usam `.page-container` ou `.form-container` no `<main>`**
(2026-08-06) — nenhuma define `maxWidth` manual via `style={{}}`. Isso corrigiu um bug
real: `maxWidth` sem `margin: "0 auto"` deixa o bloco grudado na esquerda em vez de
centralizado — era o padrão em quase toda página antiga. Página nova nunca deve voltar a
usar `maxWidth` manual no `<main>`, sempre uma dessas duas classes.

## Auth — estado atual: shim local, não é o Supabase Auth ainda

O plano original desta seção era o Supabase Auth (JWT + `auth.users` gerenciados pelo
Supabase/GoTrue). Como ainda não existe um projeto Supabase real conectado, o
`apps/web` (`/cadastro`, `/login`, `/dashboard`) e a `services/api`
(`app/routers/auth.py`) usam por enquanto um **auth próprio, simplificado**:

- Senha com hash bcrypt (`passlib` + `bcrypt==4.0.1` — pinado porque `bcrypt` 4.1+ quebra
  a autodetecção de backend do `passlib` 1.7.4) guardada em `professionals.password_hash`.
- JWT emitido pela própria API (`app/core/security.py`, `HS256`, segredo
  `API_SECRET_KEY`) — não é o JWT do Supabase.
- `POST /auth/signup` cria, numa transação (`app/core/db.py`, pool `asyncpg`): a linha em
  `auth.users` (só para satisfazer a FK de `professionals.user_id`), o `tenant` novo
  ("Consultório de {nome}") e o `professional`. Ou seja: **todo cadastro novo já cria um
  tenant próprio** — o comportamento multi-tenant funciona desde o primeiro usuário.
- `POST /auth/login` verifica a senha e reemite o JWT.
- Front-end guarda o token em `localStorage` (`nutrihub_token`) — aceitável para o shim
  local, não é o padrão para quando isso virar Supabase Auth (nesse caso o
  `@supabase/ssr` cuida de cookies/sessão).

**Por que esse desvio:** dar ao usuário uma URL de login/cadastro funcionando hoje, sem
depender de criar um projeto Supabase (conta externa) nem subir a stack completa do
Supabase self-hosted (Kong+GoTrue+PostgREST) localmente — decisão de escopo, não mudança
de plano de longo prazo.

**Como isso muda quando entrar o Supabase Auth de verdade:** trocar
`app/routers/auth.py`/`security.py` por chamadas ao Supabase Auth, remover
`professionals.password_hash` (Supabase/GoTrue passa a ser dono da credencial), e a
criação de tenant no signup vira um trigger Postgres em `auth.users` (padrão
"handle_new_user"). Continua sendo a FastAPI o único cliente do Postgres (ver decisão
de arquitetura acima) — Supabase Auth trocaria só quem emite/valida o JWT, não abriria
acesso direto do browser ao banco.

### Duas roles de Postgres: `nutrihub` (dono) e `nutrihub_app` (RLS de verdade)

Desde `0003_app_role_rls.sql` (2026-08-13) a API usa **duas conexões distintas**
(`app/core/db.py`):

- **`pool()`** — conecta como `nutrihub`, dona das tabelas, bypassa RLS
  incondicionalmente. Uso restrito a `app/routers/auth.py` (signup/login) e
  `app/routers/patient_auth.py` (login de paciente) — as únicas operações que
  legitimamente precisam olhar entre tenants antes de existir uma sessão.
- **`tenant_connection(tenant_id)`** — conecta como `nutrihub_app`, não é dona de nada,
  fica sujeita a RLS de verdade. **Toda rota autenticada usa isso, nunca `pool()`.**
  Seta a GUC de sessão `app.current_tenant_id` (que `current_tenant_ids()` lê — trocou
  de `auth.uid()`, que nunca é populado numa conexão `asyncpg` direta sem
  PostgREST/GoTrue no meio) e sempre reseta antes de devolver a conexão ao pool, pra um
  tenant nunca vazar pra próxima request que reusar a mesma conexão física.

**RLS agora é uma segunda camada de defesa real, não só documentada.** Verificado com
teste automatizado (`tests/test_tenant_isolation.py::test_rls_blocks_cross_tenant_even_without_app_filter`):
uma query sem `where tenant_id = ...` na role `nutrihub_app` não vaza dado de outro
tenant — o Postgres bloqueia sozinho. Isso não dispensa o filtro manual (continua sendo
a primeira linha de defesa, mais barata de auditar em code review), mas agora um
esquecimento tem rede de segurança.

**Pegadinha real encontrada e corrigida (0004_delete_policies.sql):** `foods` e
`substitution_lists` usam um padrão de policy diferente do resto (`_read`/`_write`/`_update`
separados, pra permitir leitura pública de `tenant_id is null`) — 0001/0002 nunca
criaram policy de `DELETE` porque os endpoints não tinham `DELETE` ainda. Ao padronizar
CRUD (adicionar `DELETE` nesses dois routers), RLS passou a bloquear silenciosamente a
exclusão de registro **do próprio tenant**, por falta de policy pro comando — não é bug
de aplicação, é ausência de policy. **How to apply:** toda tabela nova com policy
separada por comando (em vez de `for all`) precisa de uma policy explícita por
operação que o router vier a expor — checar isso ao adicionar `PATCH`/`DELETE` a um
router que só tinha `GET`/`POST`.

### Rotas protegidas da API

Todo endpoint que precisa de um profissional logado usa a dependency
`get_current_professional` (`app/core/deps.py`): decodifica o JWT do header
`Authorization: Bearer <token>` e devolve `professional_id`/`tenant_id`/`email`/`role`.
Endpoints que exigem admin usam `Depends(require_admin)` (ver seção "Multi-profissional").
Padrão em todo router: `Depends(get_current_professional)` + `db.tenant_connection(current.tenant_id)`
+ filtrar toda query Postgres por `tenant_id = current.tenant_id` explicitamente (RLS é
a segunda camada, não substitui o filtro).

Endpoints do **paciente** usam `get_current_patient` → `CurrentPatient`, token JWT
separado (claim `"kind": "patient"`, ver `app/core/security.py::create_patient_access_token`)
— um token de paciente não abre nenhuma rota de profissional e vice-versa (testado em
`tests/test_patient_portal.py`). Tokens emitidos antes dessa claim existir (sem `kind`
no payload) continuam válidos como profissional — tratamento de compatibilidade em
`get_current_professional`.

**How to apply:** ao escrever uma query nova na API, sempre incluir `tenant_id = $N` no
`WHERE` (primeira linha de defesa) — RLS (segunda linha) cobre o esquecimento, mas não
é motivo pra parar de escrever o filtro manual.

### JSONB precisa de codec explícito no asyncpg

Colunas `jsonb` (`questionnaire_templates.fields`, `questionnaire_responses.answers`,
`substitution_lists.items`) exigem um codec registrado em `app/core/db.py`
(`_init_connection`, via `conn.set_type_codec`) — sem isso, `asyncpg` devolve o valor
como `str` bruto (JSON não decodificado) em vez de `dict`/`list` Python, e passar um
`dict`/`list` como parâmetro em `INSERT` falha silenciosamente ou grava errado. Com o
codec registrado, os routers passam/recebem objetos Python nativos direto — nunca fazer
`json.dumps`/`json.loads` manual nas queries, o codec já cobre isso.

**How to apply:** qualquer coluna `jsonb` nova continua funcionando automaticamente (o
codec é por tipo Postgres, não por tabela) — não precisa registrar de novo por coluna.

## Migrations: aplicar no banco rodando, não recriar o volume

`supabase/migrations/*.sql` só roda automaticamente via `docker-entrypoint-initdb.d` na
**primeira** subida do container `db` (volume vazio). A partir do momento em que existe
dado real no volume (ex: o cadastro da Joice), `docker compose down -v` **apaga esse
dado** — não é uma opção segura pra aplicar uma migration nova depois desse ponto.

**Como aplicar uma migration nova sem perder dado:**
```bash
docker compose -f infra/docker-compose.yml exec -T db psql -U nutrihub -d nutrihub < supabase/migrations/000X_nome.sql
```
Isso roda o SQL direto no Postgres já em execução, preservando tudo que já existe. É
assim que `0002_content_modules.sql` foi aplicado (2026-08-06).

**How to apply:** todo migration novo a partir de agora segue esse fluxo — nunca `down -v`
partindo do princípio de "é só recriar", sempre checar primeiro se há dado real no
volume (`select * from professionals`) antes de qualquer operação que possa destruir o
volume do `db`.

## Multi-tenant

Cada nutricionista (ou clínica, no futuro) é um `tenant`. Todas as tabelas operacionais têm `tenant_id` e Row Level Security no Postgres garante isolamento — o mesmo padrão usado no Gestão Varejo. Isso significa que, embora o MVP sirva só a Joice, o schema já nasce pronto para múltiplos tenants sem migração de arquitetura depois.

Ver `supabase/migrations/0001_init.sql` (núcleo: tenants, pacientes, agenda, financeiro)
e `0002_content_modules.sql` (metas, anamnese/questionário, exames, listas de
substituição, farmácias, prescrições, NutriPlan) para o modelo de dados original, e
`0003` a `0015` para tudo que veio depois (RLS real, exames/prescrições estruturados,
antropometria, base de alimentos ampliada, login de paciente, categorias financeiras,
cobrança recorrente, estoque, papéis de equipe, página pública/agendamento, diário
alimentar — cada arquivo tem um comentário de cabeçalho explicando o porquê).

## Mobile e app stores

Expo foi escolhido em vez de React Native puro porque:
- Build gerenciado (EAS Build) publica para App Store e Google Play sem precisar de Xcode/Android Studio configurados localmente.
- Atualizações OTA (EAS Update) permitem corrigir bugs de JS sem passar por novo review de loja.
- Mesma linguagem (TypeScript) e mesmos tipos de `packages/shared` usados no dashboard web.

**pnpm + Expo, duas pegadinhas resolvidas (2026-08-13):**
1. `"main": "node_modules/expo/AppEntry.js"` (default do template Expo) resolve `../../App`
   por caminho relativo assumindo `node_modules` "achatado" (hoisted, padrão npm/yarn).
   Sob pnpm, `expo` fica dentro de `node_modules/.pnpm/expo@.../node_modules/expo/`, um
   nível a mais de profundidade — o caminho relativo aponta pro lugar errado e o Metro
   falha com "Unable to resolve module ../../App". Resolvido com `apps/mobile/index.js`
   próprio (`registerRootComponent` direto) + `"main": "index.js"`.
2. `@babel/runtime` precisa ser dependência explícita de `apps/mobile` — várias libs RN
   assumem que ele está disponível via hoisting (npm/yarn), o que pnpm não faz por
   padrão.

**How to apply:** qualquer app Expo novo neste monorepo pnpm deve partir desse mesmo
padrão (`index.js` próprio + `@babel/runtime` explícito), não do template padrão do
`create-expo-app`.

## Docker

`infra/docker-compose.yml` modela a execução local:
- `db`: Postgres 16, schema aplicado a partir de `supabase/migrations/`
- `redis`: cache e fila (ex. lembretes de agendamento, processamento de PDF assíncrono) — declarado mas nenhum código consome ainda
- `api`: FastAPI containerizado
- `web`: Next.js containerizado (build de produção)

Em produção, `db`/`auth`/`storage` passam a ser o Supabase gerenciado (cloud) — o Postgres local do Compose existe só para desenvolvimento offline e paridade de schema. `api` e `web` usam a mesma imagem Docker tanto localmente quanto no deploy (Fly.io, Railway ou VPS próprio).

**Bug real encontrado e corrigido (2026-08-13): faltava `.dockerignore`.** Sem ele, o
`COPY . .` do estágio `build` do `apps/web/Dockerfile` copiava o `node_modules` do host
por cima do `node_modules` recém-instalado (corretamente, pra Linux) pelo estágio
`deps` — quebrava com `Error: Cannot find module '.../next/dist/bin/next'` porque
`node_modules` instalado no Windows não é compatível com o container Linux. Esse bug
era **latente** até agora: nunca ninguém tinha rodado `pnpm install` neste repo antes
desta sessão (não havia `pnpm-lock.yaml`), então o `node_modules` do host nunca existiu
pra vazar pro build. Adicionado `.dockerignore` na raiz excluindo `node_modules`,
`.next`, `.expo`, `.turbo`, `.git`. **How to apply:** todo `COPY . .` num Dockerfile
deste monorepo depende desse `.dockerignore` existir — não remover.

**Portas do host configuráveis (`DB_HOST_PORT`/`API_HOST_PORT`, 2026-08-13)**: `db` e
`api` publicam `${DB_HOST_PORT:-5432}:5432` e `${API_HOST_PORT:-8000}:8000` — default
continua 5432/8000 (o que `.env.example` documenta), mas dá pra sobrescrever via `.env`
sem editar o `docker-compose.yml` quando outra coisa na máquina já usa essas portas
(aconteceu com um projeto "vitrine" não relacionado rodando em paralelo). **Lembrete de
uso**: com `.env` na raiz e comando rodado de lá, o Docker Compose usado neste projeto
não carrega esse `.env` sozinho para substituição de variável dentro do compose file
(`${VAR}`) — só via `env_file:` (isso injeta no container, não resolve `${VAR}` no
arquivo). Sempre passar `--env-file .env` explícito:
```bash
docker compose -f infra/docker-compose.yml --env-file .env up -d
```

## Túnel público (Cloudflare Tunnel) — nutrihub.isdev.online

Instância pública de demonstração, criada 2026-08-13 no domínio pessoal do Ismael
(`isdev.online`, já gerenciado via Cloudflare nesta máquina — mesmo padrão dos túneis
`vitrine`/`site-mei`/`wksolutions`, ver `~/.cloudflared/`). **Não faz parte do
`docker-compose.yml` nem de nenhum arquivo do repo** — é infraestrutura local desta
máquina, criada via CLI:

- Tunnel `nutrihub` (id `d338dc2a-5d68-4f7d-8234-690927377e58`), config em
  `~/.cloudflared/config-nutrihub.yml` (fora do repo, não versionado):
  - `nutrihub.isdev.online` → `http://localhost:3000` (web)
  - `api-nutrihub.isdev.online` → `http://localhost:8002` (api — porta 8002, não 8000,
    por causa do conflito de porta com o projeto vitrine nesta máquina; ver
    `DB_HOST_PORT`/`API_HOST_PORT` acima)
- Roda com `cloudflared tunnel --config ~/.cloudflared/config-nutrihub.yml run nutrihub`
  — processo separado do Docker, precisa estar rodando pro domínio responder. **Não é
  serviço gerenciado (systemd/task scheduler) ainda** — se a máquina reiniciar ou o
  processo for encerrado, o domínio para de responder até rodar o comando de novo.
- **Segredos rotacionados especificamente pra essa exposição pública** (senha da role
  `nutrihub_app`, `API_SECRET_KEY`) — diferentes dos valores de desenvolvimento local
  puro anteriores a 2026-08-13. Vivem só em `.env` (gitignored), nunca no repo.
- `apps/web/Dockerfile` ganhou `ARG NEXT_PUBLIC_API_URL` (default
  `http://localhost:8000`, preserva o build local de sempre) — `docker-compose.yml`
  passa isso como `build.args` a partir de `.env`, porque `NEXT_PUBLIC_*` é inlined no
  bundle do client no momento do `next build`, não lido em runtime do container.
- Páginas públicas de marketing: `/` (pitch pro nutricionista, CTA cadastro/login) e
  `/paciente` (explica o app do paciente; deixa claro que o acesso é liberado pelo
  nutricionista, não self-signup — o app ainda não está publicado nas lojas).

**How to apply:** pra replicar esse tipo de exposição pública num projeto novo —
`cloudflared tunnel create <nome>`, escrever `~/.cloudflared/config-<nome>.yml` com
`credentials-file` apontando pro JSON gerado, `cloudflared tunnel route dns <nome>
<hostname>` por hostname (pode falhar com "Tunnel not found" logo depois do `create` —
esperar alguns segundos e tentar de novo, ou usar o UUID em vez do nome), e rodar
`cloudflared tunnel --config ... run <nome>` como processo de longa duração.

## Módulos implementados (atualizado 2026-08-13)

**Core do consultório (2026-08-06):** Pacientes, Agenda, Locais de atendimento
(CRUD completo, não só criação), Financeiro (fluxo de caixa/pendências + categorias +
relatórios por categoria/mês), Tags (com vínculo tag↔paciente na UI), Alimentos (busca +
custom + ~90 itens de referência TACO, CRUD completo), Receitas (CRUD completo),
**Planos alimentares** (refeições + itens + PDF via `reportlab`), Prescrições
(estruturadas: item/dosagem/frequência/duração, não texto livre), Metas, Anamnese/
Questionário pré-consulta (modelos + respostas, CRUD completo), Solicitações de exames
laboratoriais (estruturadas: lista de exames, não texto livre), Listas de substituição
(4 modelos prontos + criação/edição/exclusão de listas próprias pela UI), Farmácias,
NutriPlan (tarefas/notas), **Antropometria** (medições estruturadas + evolução + IMC).

**Paciente com conta própria (2026-08-13):** login separado (`/patient-auth/login`,
JWT com claim `kind: patient`), portal (`/patient-portal/*`: perfil, planos alimentares
+ PDF, prescrições, metas), **chat** profissional↔paciente (ativa `chat_messages`, que
antes só existia no schema sem código), **diário alimentar** (registro manual pelo
paciente, leitura pelo profissional). Acesso ao portal é habilitado por paciente pelo
profissional (`POST /patients/{id}/portal-access`) — não é self-signup.

**App mobile do paciente (2026-08-13):** deixou de ser scaffold vazio — Expo/React
Native funcional com login, 4 abas (Plano, Diário, Chat, Mais/Prescrições+Metas),
`AsyncStorage` pra sessão persistente. Ver `apps/mobile/README.md` pra rodar.

**Financeiro avançado (2026-08-13):** cobrança recorrente (bookkeeping — gera lançamento
pendente sob demanda, sem processar pagamento real) e estoque/venda de produtos
(decrementa estoque + lança entrada financeira automaticamente).

**Multi-profissional (2026-08-13):** `professionals.role` (admin/nutritionist/assistant),
convite de equipe (`/team/invite`, só admin), sempre precisa sobrar 1 admin no tenant.

**Página pública + agendamento online (2026-08-13):** página fixa por slug
(`/p/{slug}`) com bio + formulário de solicitação de horário; profissional aprova/recusa
em `/agenda/solicitacoes` — aprovar cria paciente (se novo) + agendamento automaticamente.

Todos seguem o padrão de `app/core/deps.py::get_current_professional` (ou
`get_current_patient`) + `db.tenant_connection()` + filtro `tenant_id` (ver seção
"Rotas protegidas da API" acima). Todo `GET` de listagem tem `limit`/`offset`
(default sensato, teto 500–1000 conforme o endpoint) — nenhum devolve mais a tabela
inteira sem paginação.

## Explicitamente fora de escopo — não construir sem revisitar a decisão

Atualizado 2026-08-13, depois do refactor pro blueprint "melhor ERP" (ver artifact
"NutriHub 2.0" linkado na memória do projeto). Continuam fora porque dependem de
credencial/conta externa que este ambiente não tem acesso — **não** por falta de tempo:

- **Stripe (billing do próprio SaaS, pagamento online real)**: cobrança recorrente
  existe como bookkeeping (`recurring_charges` + `/generate`), mas não processa
  pagamento — precisa de conta Stripe + chaves.
- **WhatsApp Business API**: lembretes automáticos de agendamento, formulários
  pós-consulta por WhatsApp — precisa de app Meta registrado.
- **Faturamento TISS (convênios)**: precisa de credenciamento com operadoras de saúde,
  processo majoritariamente institucional/de negócio, não só código.
- **Certificado digital ICP-Brasil**: assinatura digital certificada de documentos
  clínicos (exigência da Resolução CFN 594/2017 pra alguns casos) — precisa de
  certificado comprado.
- **Google Calendar / Apple Health / Google Fit**: sincronização de agenda e wearables
  — precisam de app OAuth registrado em cada plataforma.
- **IA própria** (rascunho de plano, leitura de exame, transcrição de consulta, body
  scan por foto, reconhecimento de refeição por foto): precisa de `ANTHROPIC_API_KEY`
  (ou equivalente) configurada no ambiente de produção — não está disponível neste
  ambiente de desenvolvimento. Continua sendo iniciativa própria (não replicar
  "Assistente Dietbox"), só que sem a chave não dá pra implementar e testar de verdade.
- **Vídeo-chamada nativa (telessaúde)**: precisa de provedor externo (Daily.co, Twilio
  etc.).
- **NFS-e (nota fiscal)**: precisa de integração com prefeitura/certificado.
- **Curvas de crescimento OMS/CDC com escore-Z (pediatria)**: não implementado — não é
  bloqueio de credencial, é escopo grande por si só (tabelas de referência LMS +
  cálculo de z-score corretos, com implicação clínica real se saírem errados). A
  antropometria estruturada (peso/altura/IMC/circunferências + evolução) que existe
  hoje é a base sobre a qual isso entraria depois.
- **Canva**: é produto/marca de terceiro, não replicar.

**How to apply:** se qualquer um desses virar prioridade, a build em si é factível — só
falta a credencial/conta/decisão de negócio correspondente. Não assumir "esqueceram de
implementar".

## Testes automatizados (2026-08-13)

`services/api/tests/` (pytest + pytest-asyncio + httpx `ASGITransport`, sem subir um
servidor real) — 34 testes cobrindo auth, CRUD de pacientes, isolamento RLS
(incluindo o teste que prova a segunda camada de defesa — ver seção RLS acima), CRUD de
conteúdo (foods/substitution-lists com a regressão do bug de policy de DELETE), login
de paciente, chat, relatórios financeiros, cobrança recorrente, estoque, equipe/papéis,
página pública/agendamento e diário alimentar.

**Como rodar** (precisa da stack subida via `docker compose up db`):
```bash
docker compose -f infra/docker-compose.yml run --rm \
  -v "$(pwd)/services/api:/app" \
  -e DATABASE_URL=postgresql://nutrihub:nutrihub@db:5432/nutrihub \
  -e TENANT_DATABASE_URL=postgresql://nutrihub_app:nutrihub_app_dev_password@db:5432/nutrihub \
  -e API_SECRET_KEY=qualquer-valor-so-pra-teste \
  api pytest -v
```
O `-v "$(pwd)/services/api:/app"` monta os testes por cima da imagem já buildada (a
imagem de produção não inclui `tests/`, de propósito). **No Git Bash do Windows, prefixar
com `MSYS_NO_PATHCONV=1`** — sem isso, o Git Bash reescreve o `:/app` do lado direito do
`-v` como se fosse um caminho Windows e o mount falha silenciosamente (nenhum teste é
coletado). `services/api/pytest.ini` fixa `asyncio_default_fixture_loop_scope = function`
— cada teste abre/fecha seu próprio pool de conexão porque o pool do asyncpg fica preso
ao event loop em que foi criado, e o pytest-asyncio (modo strict) roda cada teste num
loop novo por padrão.

Web/mobile: `pnpm --filter @nutrihub/web typecheck` e `pnpm --filter @nutrihub/mobile
typecheck` (sem suíte de testes de componente ainda — típecheck + build são a validação
hoje).

## Roadmap de arquitetura

1. ~~MVP mono-tenant funcional para a Joice~~ — feito.
2. ~~App mobile do paciente~~ — feito (2026-08-13): login, plano alimentar, chat, diário,
   prescrições/metas. Falta publicar nas lojas de verdade (EAS Build/Submit — precisa de
   conta Apple/Google Developer, fora do que dá pra fazer neste ambiente).
3. ~~Multi-profissional (papéis)~~ — feito (2026-08-13). Falta: convite por e-mail (hoje
   o admin define a senha temporária diretamente, não existe envio de e-mail).
4. **Multi-tenant comercial**: onboarding self-service (parcialmente pronto — signup já
   cria tenant; falta plano gratuito/pago) + billing do próprio SaaS (Stripe — bloqueado
   por credencial).
5. **IA própria** (plano assistido, leitura de exame, transcrição, body scan) —
   bloqueado por `ANTHROPIC_API_KEY` de produção.
6. **Curvas de crescimento OMS/CDC (pediatria)** — não bloqueado por credencial, mas
   escopo grande por si só; ver "Explicitamente fora de escopo".
