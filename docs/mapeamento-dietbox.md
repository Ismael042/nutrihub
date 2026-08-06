# Mapeamento funcional — Dietbox (referência de concorrente)

Levantamento feito navegando pela conta logada da Joice no Dietbox, sem inserir dados, sem enviar nada e sem aceitar integrações (o pop-up de conexão WhatsApp via WhatSync foi fechado sem ativar). Serve como baseline funcional para o roadmap do NutriHub — não é um objetivo de paridade 1:1, é o chão a partir do qual vamos melhorar.

## Painel inicial
Checklist de configuração da conta (cadastrar paciente, cadastrar anamnese, etc.), atalhos para adicionar/ver pacientes, agenda, financeiro, materiais e relatórios, resumo de agendamentos do dia, aniversariantes do mês, bloco "NutriPlan" (tarefas e notas), Diário, chat, envio de recados em massa, banners para Dietbox Academy e "Assistente Dietbox" (IA para montagem de planos alimentares), links para o app mobile.

## Pacientes
Listagem com abas ativos/todos/inativos, filtros por nome, local de atendimento e tags, envio de recado, cadastro de novo paciente.

## Agenda
Calendário completo (dia/semana/mês/lista), filtros por paciente e local, integração com Google Agenda, aviso de aniversariantes, previsão de retorno.

## Agendamento online + Site Profissional
Cadastro de locais de atendimento (incl. videoconferência) ligado a um construtor de página pública (temas visuais, endereço personalizado, apresentação do profissional).

## Financeiro
Fluxo de caixa, comparativo de entradas/saídas, pendências de pagamento por paciente.

## Fidelização
- **Chat**: conversas com pacientes (não lidas / todas).
- **Canva**: templates prontos de posts e materiais gráficos.
- **Materiais**: biblioteca própria + lâminas/materiais prontos do Dietbox.

## Meu conteúdo (montagem de planos)
Cardápios, Refeições, Receitas, Alimentos (bases: Taco, IBGE, USDA, TBCA, Tucunduva, Suplementos).

## Prescrições
Modelos próprios de prescrições, suplementos e fitoterápicos, com abas "meus" vs modelos Dietbox.

## Outros cadastros
Modelos de anamnese, questionário pré-consulta, metas, solicitações de exames laboratoriais, listas de substituição (com modelos prontos: fibra, hipercalórico, carboidratos, proteínas etc.), farmácias para orçamento, formulários offline (PDF sem internet), tags.

## Topo / global
Busca global (pacientes e recursos), NutriPlan (tarefas/notas), notificações, menu de perfil (dados da conta, assinatura via pay.dietbox.me, configurações, suporte), ajuda (central de ajuda, casos clínicos, tutoriais em vídeo).

## Como isso vira roadmap

O schema inicial (`supabase/migrations/0001_init.sql`) já modela: tenants, pacientes, locais de atendimento, agendamentos, planos alimentares/refeições, alimentos, transações financeiras, chat e tags — o núcleo do que está mapeado acima. Construtor de site público, Canva/materiais, assistente de IA e app mobile do paciente ficam para fases seguintes do roadmap em `ARCHITECTURE.md`.
