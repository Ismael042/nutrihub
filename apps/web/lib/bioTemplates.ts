export interface BioTemplate {
  id: string;
  label: string;
  text: string;
}

// Copy estático de produto: a pessoa escolhe um, o texto cai no textarea da bio e ela
// edita livremente antes de salvar. Nada disso é persistido como "modelo escolhido" —
// depois de aplicar, é só texto. Os colchetes são placeholders óbvios de propósito,
// pra ninguém publicar a bio sem personalizar.
//
// Constante no front em vez de tabela no banco: é copy cujo único trabalho é preencher
// um campo no cliente. Em banco exigiria migration + RLS + endpoint + fetch com loading,
// e um deploy da API pra corrigir um typo — mesmo custo do deploy de front, menos tudo isso.
export const BIO_TEMPLATES: BioTemplate[] = [
  {
    id: "clinica-geral",
    label: "Clínica geral",
    text: "Sou [seu nome], nutricionista clínica ([CRN X/00000]), com [X anos] de experiência em atendimento individualizado em [cidade]. Acredito que não existe dieta única: monto cada plano alimentar a partir da sua rotina, dos seus exames e daquilo que você realmente gosta de comer. Meu objetivo é que você saia da consulta com um caminho claro e possível de seguir no dia a dia."
  },
  {
    id: "emagrecimento",
    label: "Emagrecimento e reeducação alimentar",
    text: "Sou [seu nome], nutricionista ([CRN X/00000]) com foco em emagrecimento e reeducação alimentar. Trabalho sem dietas restritivas, sem alimentos proibidos e sem promessa milagrosa — o que a gente constrói aqui são hábitos que continuam de pé depois que a meta chega. Acompanho cada etapa de perto, ajustando o plano conforme seu corpo e sua rotina mudam."
  },
  {
    id: "esportiva",
    label: "Nutrição esportiva",
    text: "Sou [seu nome], nutricionista esportiva ([CRN X/00000]), e ajudo atletas e praticantes de atividade física a comer de acordo com o próprio treino. Trabalho com avaliação de composição corporal, periodização alimentar e suplementação baseada em evidência — do corredor de fim de semana ao atleta de competição. Se você treina firme mas sente que a alimentação não acompanha, é aqui que a gente ajusta."
  },
  {
    id: "materno-infantil",
    label: "Materno-infantil",
    text: "Sou [seu nome], nutricionista materno-infantil ([CRN X/00000]). Acompanho mulheres na gestação, no pós-parto e na amamentação, além de bebês e crianças na introdução alimentar e nas fases de crescimento. Cada etapa tem uma necessidade nutricional diferente, e meu trabalho é traduzir isso em orientação prática, sem culpa e sem terrorismo alimentar. Atendo em [cidade] há [X anos]."
  },
  {
    id: "vegetariana",
    label: "Vegetariana e vegana",
    text: "Sou [seu nome], nutricionista ([CRN X/00000]) especializada em alimentação vegetariana e vegana. Ajudo quem já não come carne — ou quer parar de comer — a fazer essa transição com segurança, cuidando dos pontos que costumam passar batido: B12, ferro, proteína, cálcio e ômega-3. O plano é feito com comida de verdade e receitas que cabem na sua rotina, não com uma lista de suplementos."
  },
  {
    id: "comportamental",
    label: "Comportamental e relação com a comida",
    text: "Sou [seu nome], nutricionista ([CRN X/00000]) com formação em nutrição comportamental. Atendo pessoas que vivem há anos no ciclo de dieta, compulsão e culpa e que querem uma relação mais tranquila com a comida. Trabalho sem contagem obsessiva de calorias e sem a balança como medida de valor, em conjunto com psicólogo e psiquiatra sempre que o caso pede. Aqui o objetivo é você voltar a comer em paz."
  },
  {
    id: "clinica-cronicos",
    label: "Oncologia e doenças crônicas",
    text: "Sou [seu nome], nutricionista clínica ([CRN X/00000]) com experiência no cuidado de pessoas em tratamento oncológico e com doenças crônicas como diabetes, hipertensão e doença renal. Adapto a alimentação aos sintomas, aos efeitos colaterais do tratamento e às restrições de cada quadro, sempre em diálogo com a equipe médica. O objetivo é preservar força, peso e qualidade de vida ao longo de todo o tratamento."
  },
  {
    id: "online",
    label: "Atendimento online",
    text: "Sou [seu nome], nutricionista ([CRN X/00000]), e atendo 100% online, de qualquer lugar do Brasil. A consulta é por videochamada e você recebe o plano alimentar, a lista de compras e as orientações direto no seu portal, com acompanhamento por mensagem entre as consultas. Se sua rotina é corrida ou não existe nutricionista perto de casa, esse formato foi feito pra você."
  }
];
