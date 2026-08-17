-- CPF opcional do paciente (diferente do CPF do profissional em 0016: aqui não é
-- obrigatório nem único — não há regra de negócio pra impedir dois pacientes com o
-- mesmo CPF, ex: dependentes cadastrados pelo responsável).
alter table patients add column cpf text;
alter table patients add constraint patients_cpf_format
  check (cpf is null or cpf ~ '^[0-9]{11}$');
