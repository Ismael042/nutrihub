"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authFetch, useRequireAuth } from "@/lib/auth";

interface Patient {
  id: string;
  name: string;
}

export default function NovoLancamentoPage() {
  const professional = useRequireAuth();
  const router = useRouter();
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
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Tipo
          <select value={kind} onChange={(e) => setKind(e.target.value as "income" | "expense")}>
            <option value="income">Entrada</option>
            <option value="expense">Saída</option>
          </select>
        </label>

        <input
          placeholder="Valor (ex: 150.00)"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />

        <input
          placeholder="Categoria (ex: consulta, aluguel, material)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Paciente (opcional)
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">Sem paciente vinculado</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Vencimento (opcional)
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={alreadyPaid} onChange={(e) => setAlreadyPaid(e.target.checked)} />
          Já foi pago/recebido
        </label>

        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary" style={{ padding: 10 }}>
          {loading ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </main>
  );
}
