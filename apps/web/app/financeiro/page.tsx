"use client";

import { useEffect, useState } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";

interface Transaction {
  id: string;
  patient_id: string | null;
  patient_name: string | null;
  kind: "income" | "expense";
  amount_cents: number;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  category: string | null;
}

interface Summary {
  income_paid_cents: number;
  expense_paid_cents: number;
  balance_cents: number;
  pending_count: number;
  pending_cents: number;
}

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FinanceiroPage() {
  const professional = useRequireAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending">("all");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [summaryRes, listRes] = await Promise.all([
        authFetch("/financial-transactions/summary"),
        authFetch(`/financial-transactions${statusFilter === "all" ? "" : `?status=${statusFilter}`}`)
      ]);
      if (!summaryRes.ok || !listRes.ok) throw new Error("Não foi possível carregar o financeiro");
      setSummary(await summaryRes.json());
      setTransactions(await listRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    }
  }

  useEffect(() => {
    if (professional) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional, statusFilter]);

  async function markPaid(id: string) {
    const res = await authFetch(`/financial-transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ paid_at: new Date().toISOString() })
    });
    if (res.ok) load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir este lançamento?")) return;
    const res = await authFetch(`/financial-transactions/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  if (!professional) return null;

  return (
    <main className="page-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <div className="page-title-row">
        <h1>Financeiro</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/financeiro/relatorios">Relatórios</a>
          <a href="/financeiro/recorrentes">Recorrências</a>
          <a href="/financeiro/estoque">Estoque</a>
          <a href="/financeiro/novo" className="btn-primary">
            + Novo lançamento
          </a>
        </div>
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 16 }}>
          <div style={{ border: "1px solid #ddd", padding: 12 }}>
            <div style={{ color: "#666", fontSize: 14 }}>Entradas (pagas)</div>
            <div style={{ fontSize: 20 }}>{formatMoney(summary.income_paid_cents)}</div>
          </div>
          <div style={{ border: "1px solid #ddd", padding: 12 }}>
            <div style={{ color: "#666", fontSize: 14 }}>Saídas (pagas)</div>
            <div style={{ fontSize: 20 }}>{formatMoney(summary.expense_paid_cents)}</div>
          </div>
          <div style={{ border: "1px solid #ddd", padding: 12 }}>
            <div style={{ color: "#666", fontSize: 14 }}>Saldo</div>
            <div style={{ fontSize: 20, color: summary.balance_cents < 0 ? "crimson" : "inherit" }}>
              {formatMoney(summary.balance_cents)}
            </div>
          </div>
          <div style={{ border: "1px solid #ddd", padding: 12 }}>
            <div style={{ color: "#666", fontSize: 14 }}>Pendências ({summary.pending_count})</div>
            <div style={{ fontSize: 20 }}>{formatMoney(summary.pending_cents)}</div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        {(["all", "pending", "paid"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{ padding: "6px 12px", fontWeight: statusFilter === s ? 700 : 400 }}
          >
            {s === "all" ? "Todos" : s === "pending" ? "Pendentes" : "Pagos"}
          </button>
        ))}
      </div>

      <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
        {transactions.map((t) => (
          <li
            key={t.id}
            style={{
              padding: "10px 0",
              borderBottom: "1px solid #eee",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8
            }}
          >
            <div>
              <strong style={{ color: t.kind === "income" ? "green" : "crimson" }}>
                {t.kind === "income" ? "+" : "-"}
                {formatMoney(t.amount_cents)}
              </strong>
              {t.patient_name && <span style={{ color: "#666" }}> · {t.patient_name}</span>}
              {t.category && <span className="badge" style={{ marginLeft: 8 }}>{t.category}</span>}
              {t.due_date && <span style={{ color: "#666" }}> · vence {t.due_date}</span>}
              <span style={{ color: "#666" }}> · {t.paid_at ? "pago" : "pendente"}</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {!t.paid_at && <button onClick={() => markPaid(t.id)}>Marcar como pago</button>}
              <button onClick={() => remove(t.id)} style={{ color: "crimson" }}>
                Excluir
              </button>
            </div>
          </li>
        ))}
      </ul>
      {transactions.length === 0 && <p>Nenhum lançamento encontrado.</p>}
    </main>
  );
}
