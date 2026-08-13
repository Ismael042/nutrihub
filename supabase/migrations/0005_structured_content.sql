-- Exames e prescrições eram texto livre (`lab_exam_requests.exams`,
-- `prescriptions.content`) — dificulta relatório/busca estruturada e não separa
-- dosagem/frequência/duração da prescrição. Estrutura como jsonb, preservando dado
-- existente (cada linha de texto livre vira um item único na lista nova, então nada
-- se perde — só não fica retroativamente "quebrado" em itens separados).

alter table lab_exam_requests add column exams_structured jsonb not null default '[]';

update lab_exam_requests
set exams_structured = jsonb_build_array(jsonb_build_object('name', exams))
where exams is not null and length(trim(exams)) > 0;

alter table lab_exam_requests drop column exams;
alter table lab_exam_requests rename column exams_structured to exams;

alter table prescriptions add column items jsonb not null default '[]';

update prescriptions
set items = jsonb_build_array(
  jsonb_build_object('description', content, 'dosage', null, 'frequency', null, 'duration', null)
)
where content is not null and length(trim(content)) > 0;

alter table prescriptions drop column content;
