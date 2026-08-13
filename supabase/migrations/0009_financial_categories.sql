-- Categorização de lançamentos financeiros — hoje só existe kind (income/expense) e
-- o resumo agregado; sem categoria não dá pra fazer relatório por tipo de receita/despesa.

alter table financial_transactions add column category text;
