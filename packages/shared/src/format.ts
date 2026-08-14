export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Formata uma data no formato YYYY-MM-DD (sem horário) sem o shift de fuso horário que
 * `new Date("YYYY-MM-DD")` introduz — o construtor nativo interpreta essa string como
 * UTC meia-noite, o que pode exibir o dia anterior em fusos negativos (ex: Brasil).
 */
export function formatDate(dateOnly: string): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  if (!year || !month || !day) return dateOnly;
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}
