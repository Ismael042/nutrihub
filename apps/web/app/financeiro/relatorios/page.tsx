"use client";

import { useEffect, useState } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";

interface CategoryRow {
  category: string;
  kind: "income" | "expense";
  total_cents: number;
  count: number;
}

interface MonthRow {
  month: string;
  income_cents: number;
  expense_cents: number;
}

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function RelatoriosFinanceiroPage() {
  const professional = useRequireAuth();
  const [byCategory, setByCategory] = useState<CategoryRow[]>([]);
  const [byMonth, setByMonth] = useState<MonthRow[]>([]);

  useEffect(() => {
    if (!professional) return;
    authFetch("/financial-transactions/reports/by-category").then(async (res) => {
      if (res.ok) setByCategory(await res.json());
    });
    authFetch("/financial-transactions/reports/by-month").then(async (res) => {
      if (res.ok) setByMonth(await res.json());
    });
  }, [professional]);

  if (!professional) return null;

  const maxMonthly = Math.max(1, ...byMonth.map((m) => Math.max(m.income_cents, m.expense_cents)));

  return (
    <main className="page-container">
      <a href="/financeiro" className="back-link">← Financeiro</a>
      <h1>Relatórios financeiros</h1>
      <p style={{ color: "#666", fontSize: 14 }}>Considera apenas lançamentos já pagos/recebidos.</p>

      <h2 style={{ fontSize: 15, marginTop: 24 }}>Por categoria</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Categoria</th>
            <th>Tipo</th>
            <th>Lançamentos</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {byCategory.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
              <td>{row.category}</td>
              <td style={{ color: row.kind === "income" ? "green" : "crimson" }}>
                {row.kind === "income" ? "Entrada" : "Saída"}
              </td>
              <td>{row.count}</td>
              <td>{formatMoney(row.total_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {byCategory.length === 0 && <p style={{ marginTop: 8 }}>Sem lançamentos pagos ainda.</p>}

      <h2 style={{ fontSize: 15, marginTop: 32 }}>Por mês</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        {byMonth.map((row) => (
          <div key={row.month}>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>
              {row.month} · entradas {formatMoney(row.income_cents)} · saídas {formatMoney(row.expense_cents)}
            </div>
            <div style={{ display: "flex", gap: 4, height: 10 }}>
              <div
                style={{
                  width: `${(row.income_cents / maxMonthly) * 100}%`,
                  background: "var(--color-primary, #0F9D74)",
                  borderRadius: 3
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 4, height: 10, marginTop: 2 }}>
              <div
                style={{
                  width: `${(row.expense_cents / maxMonthly) * 100}%`,
                  background: "crimson",
                  borderRadius: 3
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {byMonth.length === 0 && <p style={{ marginTop: 8 }}>Sem lançamentos pagos ainda.</p>}
    </main>
  );
}
