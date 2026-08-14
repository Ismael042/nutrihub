"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import { formatDate, formatMoney } from "@nutrihub/shared";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import { IconRepeat } from "@/components/icons";

interface Patient {
  id: string;
  name: string;
}

interface RecurringCharge {
  id: string;
  patient_id: string | null;
  patient_name: string | null;
  kind: "income" | "expense";
  description: string;
  amount_cents: number;
  category: string | null;
  frequency: "weekly" | "monthly";
  next_due_date: string;
  active: boolean;
}

export default function CobrancaRecorrentePage() {
  const professional = useRequireAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [charges, setCharges] = useState<RecurringCharge[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"income" | "expense">("income");
  const [category, setCategory] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "monthly">("monthly");
  const [nextDueDate, setNextDueDate] = useState("");
  const [patientId, setPatientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [chargesRes, patientsRes] = await Promise.all([
      authFetch("/recurring-charges"),
      authFetch("/patients?status=active")
    ]);
    if (chargesRes.ok) setCharges(await chargesRes.json());
    if (patientsRes.ok) setPatients(await patientsRes.json());
  }

  useEffect(() => {
    if (professional) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    if (!description.trim() || !amountCents || !nextDueDate) {
      setError("Preencha descrição, valor e próxima data");
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch("/recurring-charges", {
        method: "POST",
        body: JSON.stringify({
          patient_id: patientId || null,
          kind,
          description: description.trim(),
          amount_cents: amountCents,
          category: category || null,
          frequency,
          next_due_date: nextDueDate
        })
      });
      if (!res.ok) {
        setError("Não foi possível salvar");
        return;
      }
      setDescription("");
      setAmount("");
      setCategory("");
      setNextDueDate("");
      setPatientId("");
      toast.success("Cobrança recorrente criada.");
      load();
    } finally {
      setSaving(false);
    }
  }

  async function generate(id: string) {
    const res = await authFetch(`/recurring-charges/${id}/generate`, { method: "POST" });
    if (res.ok) {
      toast.success("Lançamento pendente criado no Financeiro.");
      load();
    }
  }

  async function toggleActive(charge: RecurringCharge) {
    const res = await authFetch(`/recurring-charges/${charge.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !charge.active })
    });
    if (res.ok) load();
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Excluir esta cobrança recorrente?", danger: true, confirmLabel: "Excluir" }))) return;
    const res = await authFetch(`/recurring-charges/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Cobrança recorrente excluída.");
      load();
    }
  }

  if (!professional) return null;

  return (
    <div className="content-stack">
      <a href="/financeiro" className="back-link">← Financeiro</a>
      <h1>Cobrança recorrente</h1>
      <p className="page-subtitle">
        Pacotes/mensalidades. Não processa pagamento — gera um lançamento pendente no Financeiro que você marca como
        pago manualmente quando receber (ex: Pix, dinheiro).
      </p>

      <details className="card" style={{ marginBottom: "var(--space-5)" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>+ Nova cobrança recorrente</summary>
        <form onSubmit={handleSubmit} style={{ marginTop: "var(--space-4)" }}>
          <div className="field">
            <label className="field-label field-required" htmlFor="description">
              Descrição
            </label>
            <input id="description" placeholder="Ex: Pacote mensal" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="kind">
                Tipo
              </label>
              <select id="kind" value={kind} onChange={(e) => setKind(e.target.value as "income" | "expense")}>
                <option value="income">Entrada</option>
                <option value="expense">Saída</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label field-required" htmlFor="amount">
                Valor
              </label>
              <input id="amount" placeholder="200.00" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="frequency">
                Frequência
              </label>
              <select id="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as "weekly" | "monthly")}>
                <option value="monthly">Mensal</option>
                <option value="weekly">Semanal</option>
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="category">
                Categoria
              </label>
              <input id="category" placeholder="Opcional" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label field-required" htmlFor="nextDueDate">
                Próxima data
              </label>
              <input id="nextDueDate" type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="patient">
              Paciente
            </label>
            <select id="patient" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Sem paciente vinculado</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: "var(--space-4)" }}>
              <p>{error}</p>
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </form>
      </details>

      {charges.length === 0 ? (
        <EmptyState icon={<IconRepeat />} title="Nenhuma cobrança recorrente" description="Cadastre pacotes ou mensalidades que se repetem — você gera o lançamento quando quiser." />
      ) : (
        <div className="table-wrap">
          <table>
            <tbody>
              {charges.map((c) => (
                <tr key={c.id} style={{ opacity: c.active ? 1 : 0.55 }}>
                  <td className="table-num" style={{ color: c.kind === "income" ? "var(--color-success)" : "var(--color-error)", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {c.kind === "income" ? "+" : "-"}
                    {formatMoney(c.amount_cents)}
                  </td>
                  <td>
                    {c.description}
                    {c.patient_name && <span style={{ color: "var(--color-text-muted)" }}> · {c.patient_name}</span>}
                    <div className="text-caption">
                      {c.frequency === "monthly" ? "mensal" : "semanal"} · próxima: {formatDate(c.next_due_date)}
                    </div>
                  </td>
                  <td className="table-actions">
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <button onClick={() => generate(c.id)} className="btn-sm btn-primary">
                        Gerar agora
                      </button>
                      <button onClick={() => toggleActive(c)} className="btn-sm btn-secondary">
                        {c.active ? "Pausar" : "Reativar"}
                      </button>
                      <button onClick={() => remove(c.id)} className="btn-sm btn-danger">
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
