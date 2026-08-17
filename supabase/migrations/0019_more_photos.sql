-- Imagens em mais campos: foto do paciente, foto da receita e logo do consultório.
--
-- Regra de privacidade: só vai pro bucket PÚBLICO o que é renderizado na página
-- pública sem autenticação (hoje só a foto do profissional, ver 0018). Todo o resto
-- vai pro bucket PRIVADO e é servido por URL assinada temporária, gerada pela API
-- depois de conferir o acesso — foto de paciente identifica alguém como paciente de
-- nutricionista, não pode ficar acessível por link permanente.
--
-- Por isso estas colunas guardam a CHAVE do objeto, não a URL: a URL é derivada na
-- leitura e expira. (professionals.photo_url, de 0018, guarda a URL completa porque é
-- pública e imutável — inconsistência assumida; a regra daqui pra frente é guardar a
-- chave.)

-- tenants tinha `enable row level security` desde 0001 mas nenhuma policy e sem force.
-- Postgres nega por padrão quando não existe policy pro comando, então a role
-- nutrihub_app (usada por toda rota autenticada via db.tenant_connection) não conseguia
-- nem ler a própria linha do tenant. Passava despercebido porque o único código que
-- tocava em tenants era o signup, que usa db.pool() (role dona, bypassa RLS).
--
-- Atenção: o predicado usa `id`, não `tenant_id` — tenants é a única tabela onde a
-- chave do tenant é a própria PK.
alter table tenants force row level security;
create policy tenant_isolation on tenants
  for all using (id in (select current_tenant_ids()));

-- Logo do consultório: bucket privado. Só aparece no cabeçalho do PDF do plano
-- alimentar, que é gerado no servidor — o que importa são os bytes, não uma URL
-- pública. O preview nas configurações usa URL assinada, igual às outras.
alter table tenants add column logo_key text;

alter table patients add column photo_key text;
alter table recipes add column photo_key text;
