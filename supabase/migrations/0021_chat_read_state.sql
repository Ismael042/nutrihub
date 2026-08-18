-- Estado de leitura do chat, pro inbox central mostrar não lidas (ver
-- services/api/app/routers/chat_inbox.py). Sem coluna "por profissional": o inbox é
-- compartilhado pelo tenant inteiro, mesmo princípio que já vale pro resto do
-- app (RLS é por tenant, não existe conceito de "meus pacientes" vs "pacientes de
-- outro profissional"). Quem abrir a conversa primeiro marca como lida pra todo mundo.

alter table chat_messages add column read_at timestamptz;
