-- password_hash vira nullable: contas via Google não têm senha própria.
-- /auth/login precisa checar password_hash is null antes de chamar verify_password
-- (mesmo padrão já usado em patient_auth.py).
alter table professionals alter column password_hash drop not null;

-- Linka a conta a um Google Account (claim "sub" do ID token).
alter table professionals add column google_id text unique;

-- Gate de login do fluxo e-mail/senha. Contas via Google chegam já true (o Google
-- já verificou o e-mail antes de emitir o ID token).
alter table professionals add column email_verified boolean not null default false;

-- Backfill: profissionais que já existiam antes desta migration já estavam logando
-- normalmente — sem isso, todo mundo ficaria trancado fora no primeiro deploy (a
-- coluna nasce false pra todo mundo, inclusive quem nunca passou por um fluxo de
-- verificação porque ele não existia ainda). Só cadastros novos, a partir daqui,
-- nascem com false de verdade e precisam confirmar o código.
update professionals set email_verified = true;

-- CPF: dígitos-only, obrigatório em contas novas (aplicado na API, não na constraint —
-- profissionais existentes têm cpf null e não há como backfillar retroativamente).
alter table professionals add constraint professionals_cpf_format
  check (cpf is null or cpf ~ '^[0-9]{11}$');
alter table professionals add constraint professionals_cpf_unique unique (cpf);

-- Código de verificação de e-mail: uma linha por profissional (upsert a cada reenvio,
-- não precisa histórico de códigos antigos).
create table email_verification_codes (
  professional_id uuid primary key references professionals(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
