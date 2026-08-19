"use client";

import { useEffect, useState } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import { formatDate, formatMoney } from "@nutrihub/shared";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import { SkeletonRows, SkeletonStatGrid } from "@/components/Skeleton";
import { IconWallet } from "@/components/icons";

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

const FILTERS = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Pendentes" },
  { key: "paid", label: "Pagos" }
] as const;

export default function FinanceiroPage() {
  const professional = useRequireAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
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
    } finally {
      setLoading(false);
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
    if (res.ok) {
      toast.success("Lançamento marcado como pago.");
      load();
    }
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Excluir este lançamento?", danger: true, confirmLabel: "Excluir" }))) return;
    const res = await authFetch(`/financial-transactions/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Lançamento excluído.");
      load();
    }
  }

  if (!professional) return null;

  return (
    <div className="content-stack">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <div className="page-title-row">
        <h1>Financeiro</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <a href="/financeiro/relatorios" className="btn-ghost">
            Relatórios
          </a>
          <a href="/financeiro/recorrentes" className="btn-ghost">
            Recorrências
          </a>
          <a href="/financeiro/estoque" className="btn-ghost">
            Estoque
          </a>
          <a href="/financeiro/novo" className="btn-primary">
            + Novo lançamento
          </a>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <SkeletonStatGrid count={4} />
      ) : (
        summary && (
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-card-label">Entradas (pagas)</span>
              <span className="stat-card-value">{formatMoney(summary.income_paid_cents)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Saídas (pagas)</span>
              <span className="stat-card-value">{formatMoney(summary.expense_paid_cents)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Saldo</span>
              <span
                className="stat-card-value"
                style={{ color: summary.balance_cents < 0 ? "var(--color-error)" : "var(--color-text-primary)" }}
              >
                {formatMoney(summary.balance_cents)}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Pendências</span>
              <span className="stat-card-value">{formatMoney(summary.pending_cents)}</span>
              {summary.pending_count > 0 && <span className="stat-card-delta neutral">{summary.pending_count} lançamentos</span>}
            </div>
          </div>
        )
      )}

      <div className="tabs" role="tablist" style={{ marginTop: "var(--space-4)" }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={statusFilter === f.key}
            className={`tab${statusFilter === f.key ? " active" : ""}`}
            onClick={() => setStatusFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <SkeletonRows count={5} />}

      {!loading && transactions.length === 0 && (
        <EmptyState
          icon={<IconWallet />}
          title="Nenhum lançamento encontrado"
          description="Registre entradas e saídas pra acompanhar o fluxo de caixa do consultório."
          actionLabel="Novo lançamento"
          actionHref="/financeiro/novo"
        />
      )}

      {!loading && transactions.length > 0 && (
        <div className="table-wrap table-responsive-cards">
          <table>
            <thead>
              <tr>
                <th>Valor</th>
                <th>Paciente</th>
                <th>Categoria</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td
                    className="table-num"
                    data-label="Valor"
                    style={{ color: t.kind === "income" ? "var(--color-success)" : "var(--color-error)", fontWeight: 600 }}
                  >
                    {t.kind === "income" ? "+" : "-"}
                    {formatMoney(t.amount_cents)}
                  </td>
                  <td data-label="Paciente">{t.patient_name ?? "—"}</td>
                  <td data-label="Categoria">{t.category ? <span className="badge">{t.category}</span> : "—"}</td>
                  <td data-label="Vencimento" style={{ color: "var(--color-text-muted)" }}>
                    {t.due_date ? formatDate(t.due_date) : "—"}
                  </td>
                  <td data-label="Status">
                    <span className={`badge ${t.paid_at ? "badge-success" : "badge-warning"}`}>
                      {t.paid_at ? "Pago" : "Pendente"}
                    </span>
                  </td>
                  <td className="table-actions" data-label="Ações">
                    <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
                      {!t.paid_at && (
                        <button className="btn-sm btn-secondary" onClick={() => markPaid(t.id)}>
                          Marcar pago
                        </button>
                      )}
                      <button className="btn-sm btn-danger" onClick={() => remove(t.id)}>
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
