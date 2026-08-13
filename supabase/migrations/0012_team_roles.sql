-- Multi-profissional por tenant: até aqui um tenant só existia com um profissional
-- (criado no signup). `role` diferencia quem pode convidar/gerenciar a equipe
-- (admin) de quem só atende (nutritionist) ou só apoia agenda/financeiro (assistant).
-- Quem faz signup vira admin do próprio tenant automaticamente.

alter table professionals add column role text not null default 'admin'
  check (role in ('admin', 'nutritionist', 'assistant'));
