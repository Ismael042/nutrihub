"use client";

import { useEffect, useState } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import EmptyState from "@/components/EmptyState";
import { IconTrendUp } from "@/components/icons";

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
    <div className="content-stack">
      <a href="/financeiro" className="back-link">← Financeiro</a>
      <h1>Relatórios financeiros</h1>
      <p className="page-subtitle">Considera apenas lançamentos já pagos/recebidos.</p>

      <h2 style={{ fontSize: 16, marginTop: "var(--space-4)" }}>Por categoria</h2>
      {byCategory.length === 0 ? (
        <EmptyState icon={<IconTrendUp />} title="Sem lançamentos pagos ainda" description="Assim que você marcar lançamentos como pagos, o relatório aparece aqui." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Tipo</th>
                <th>Lançamentos</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map((row, i) => (
                <tr key={i}>
                  <td>{row.category}</td>
                  <td>
                    <span className={`badge ${row.kind === "income" ? "badge-success" : "badge-error"}`}>
                      {row.kind === "income" ? "Entrada" : "Saída"}
                    </span>
                  </td>
                  <td className="table-num">{row.count}</td>
                  <td className="table-num" style={{ fontWeight: 600 }}>
                    {formatMoney(row.total_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ fontSize: 16, marginTop: "var(--space-8)" }}>Por mês</h2>
      {byMonth.length === 0 ? (
        <p className="text-caption">Sem lançamentos pagos ainda.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
          {byMonth.map((row) => (
            <div key={row.month}>
              <div className="text-small" style={{ marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                <strong style={{ color: "var(--color-text-primary)" }}>{row.month}</strong>
                <span>
                  entradas {formatMoney(row.income_cents)} · saídas {formatMoney(row.expense_cents)}
                </span>
              </div>
              <div style={{ display: "flex", height: 8, background: "var(--color-bg-subtle)", borderRadius: 4, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${(row.income_cents / maxMonthly) * 100}%`,
                    background: "var(--color-success)"
                  }}
                />
              </div>
              <div style={{ display: "flex", height: 8, marginTop: 3, background: "var(--color-bg-subtle)", borderRadius: 4, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${(row.expense_cents / maxMonthly) * 100}%`,
                    background: "var(--color-error)"
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
