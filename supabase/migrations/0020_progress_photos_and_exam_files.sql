-- Etapa 2 das imagens: fotos de evolução na antropometria e anexo de resultado de exame.
--
-- Tabelas-filhas em vez de coluna jsonb (como exams/prescriptions.items fazem): aqui
-- cada arquivo é uma entidade com identidade própria — você apaga a foto nº 2, não
-- reescreve a lista inteira. Também ganha cascade e RLS de graça, e evita dois clientes
-- editando a lista simultaneamente sobrescreverem um ao outro.
--
-- Ambos guardam a CHAVE do objeto no bucket privado (mesma regra de 0019): a URL é
-- assinada na leitura e expira. Foto de evolução corporal e resultado de exame são
-- dados de saúde — não podem ficar acessíveis por link permanente.

create table measurement_photos (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  measurement_id uuid not null references anthropometric_measurements(id) on delete cascade,
  storage_key text not null,
  -- Ângulo da foto: permite comparar "frente de janeiro" com "frente de março" em vez
  -- de comparar fotos de ângulos diferentes. Nullable pra não travar quem só quer
  -- jogar a foto sem classificar.
  kind text check (kind is null or kind in ('front', 'side', 'back')),
  created_at timestamptz not null default now()
);

alter table measurement_photos enable row level security;
alter table measurement_photos force row level security;

create policy tenant_isolation on measurement_photos
  for all using (tenant_id in (select current_tenant_ids()));

-- Anexo de exame: diferente das fotos, aceita PDF. PDF não passa pelo re-encode do
-- Pillow, então não ganha a mesma garantia de "re-encodar prova que é imagem" — a
-- mitigação é o bucket privado + URL assinada + content_type fixado no upload (o
-- objeto é servido com o tipo que a API gravou, não com o que o cliente alegou).
create table lab_exam_attachments (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  request_id uuid not null references lab_exam_requests(id) on delete cascade,
  storage_key text not null,
  -- Nome original só pra exibir na lista; nunca é usado pra montar a chave do objeto
  -- (que é uuid) nem pra caminho de arquivo.
  filename text not null,
  content_type text not null,
  size_bytes integer not null,
  created_at timestamptz not null default now()
);

alter table lab_exam_attachments enable row level security;
alter table lab_exam_attachments force row level security;

create policy tenant_isolation on lab_exam_attachments
  for all using (tenant_id in (select current_tenant_ids()));
