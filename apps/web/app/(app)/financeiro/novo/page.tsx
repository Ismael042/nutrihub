"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authFetch, useRequireAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";

interface Patient {
  id: string;
  name: string;
}

export default function NovoLancamentoPage() {
  const professional = useRequireAuth();
  const router = useRouter();
  const toast = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [kind, setKind] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!professional) return;
    authFetch("/patients?status=active").then(async (res) => {
      if (res.ok) setPatients(await res.json());
    });
  }, [professional]);

  if (!professional) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    if (!amountCents || amountCents <= 0) {
      setError("Informe um valor válido");
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch("/financial-transactions", {
        method: "POST",
        body: JSON.stringify({
          patient_id: patientId || null,
          kind,
          amount_cents: amountCents,
          category: category || null,
          due_date: dueDate || null,
          paid_at: alreadyPaid ? new Date().toISOString() : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Não foi possível salvar o lançamento");
      toast.success("Lançamento salvo.");
      router.push("/financeiro");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="form-container">
      <a href="/financeiro" className="back-link">← Financeiro</a>
      <h1>Novo lançamento</h1>
      <form onSubmit={handleSubmit}>
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
            <input id="amount" placeholder="150.00" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="category">
            Categoria
          </label>
          <input id="category" placeholder="Ex: consulta, aluguel, material" value={category} onChange={(e) => setCategory(e.target.value)} />
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

        <div className="field">
          <label className="field-label" htmlFor="dueDate">
            Vencimento
          </label>
          <input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--space-4)" }}>
          <input
            type="checkbox"
            checked={alreadyPaid}
            onChange={(e) => setAlreadyPaid(e.target.checked)}
            style={{ width: "auto" }}
          />
          Já foi pago/recebido
        </label>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "var(--space-4)" }}>
            <p>{error}</p>
          </div>
        )}
        <button type="submit" disabled={loading} className="btn-primary btn-block">
          {loading ? "Salvando..." : "Salvar lançamento"}
        </button>
      </form>
    </main>
  );
}
