-- Login de paciente: pré-requisito pro app mobile do paciente, chat e diário
-- alimentar. Paciente não tem `auth.users`/tenant próprio (ele já é um registro
-- gerenciado por um profissional) — só ganha credencial quando o profissional
-- habilita "acesso ao portal" explicitamente (ver POST /patients/{id}/portal-access).
--
-- `password_hash` nulo = paciente sem acesso ao portal (comportamento atual,
-- inalterado). Índice único parcial: só exige e-mail único entre pacientes que TÊM
-- login — dois tenants podem ter pacientes com o mesmo e-mail se nenhum dos dois usa
-- o portal; no momento em que o portal é habilitado, o e-mail vira a chave de login
-- (precisa ser globalmente único porque o login não pede tenant, só e-mail+senha).

alter table patients add column password_hash text;

create unique index patients_email_when_portal_enabled
  on patients (email)
  where password_hash is not null;
