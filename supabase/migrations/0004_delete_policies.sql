-- `foods` e `substitution_lists` usam split de policy (pública de leitura + tenant só
-- pode escrever a própria) em vez do `tenant_isolation ... for all` do resto do schema.
-- 0001/0002 nunca criaram uma policy de DELETE pra essas duas — não fazia falta, porque
-- os routers não expunham DELETE ainda. Agora que app/routers/foods.py e
-- app/routers/substitution_lists.py ganharam DELETE (padronização de CRUD), RLS bloqueia
-- silenciosamente a exclusão de um registro do próprio tenant, sem policy nenhuma pra
-- casar com o comando — Postgres nega por padrão quando não há policy pro comando.

create policy foods_delete on foods
  for delete using (tenant_id in (select current_tenant_ids()));

create policy substitution_lists_delete on substitution_lists
  for delete using (tenant_id in (select current_tenant_ids()));
