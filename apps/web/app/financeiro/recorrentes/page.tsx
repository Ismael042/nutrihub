"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";

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

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CobrancaRecorrentePage() {
  const professional = useRequireAuth();
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
  const [message, setMessage] = useState<string | null>(null);

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
    load();
  }

  async function generate(id: string) {
    const res = await authFetch(`/recurring-charges/${id}/generate`, { method: "POST" });
    if (res.ok) {
      setMessage("Lançamento pendente criado no Financeiro.");
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
    if (!confirm("Excluir esta cobrança recorrente?")) return;
    const res = await authFetch(`/recurring-charges/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  if (!professional) return null;

  return (
    <main className="page-container">
      <a href="/financeiro" className="back-link">← Financeiro</a>
      <h1>Cobrança recorrente</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        Pacotes/mensalidades. Não processa pagamento — gera um lançamento pendente no Financeiro que você marca como
        pago manualmente quando receber (ex: Pix, dinheiro).
      </p>

      <details style={{ marginTop: 16 }}>
        <summary>+ Nova cobrança recorrente</summary>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <input placeholder="Descrição (ex: Pacote mensal)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <select value={kind} onChange={(e) => setKind(e.target.value as "income" | "expense")}>
              <option value="income">Entrada</option>
              <option value="expense">Saída</option>
            </select>
            <input placeholder="Valor (ex: 200.00)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ flex: 1 }} />
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as "weekly" | "monthly")}>
              <option value="monthly">Mensal</option>
              <option value="weekly">Semanal</option>
            </select>
          </div>
          <input placeholder="Categoria (opcional)" value={category} onChange={(e) => setCategory(e.target.value)} />
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Próxima data
            <input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
          </label>
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">Sem paciente vinculado</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {error && <p style={{ color: "crimson" }}>{error}</p>}
          <button type="submit" className="btn-primary" style={{ padding: 10 }}>Salvar</button>
        </form>
      </details>

      {message && <p style={{ marginTop: 12, color: "var(--color-primary, #0F9D74)" }}>{message}</p>}

      <ul style={{ listStyle: "none", padding: 0, marginTop: 20 }}>
        {charges.map((c) => (
          <li key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid #eee", opacity: c.active ? 1 : 0.5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong style={{ color: c.kind === "income" ? "green" : "crimson" }}>
                  {c.kind === "income" ? "+" : "-"}{formatMoney(c.amount_cents)}
                </strong>
                {" "}· {c.description}
                {c.patient_name && <span style={{ color: "#666" }}> · {c.patient_name}</span>}
                <span style={{ color: "#666" }}> · {c.frequency === "monthly" ? "mensal" : "semanal"} · próxima: {c.next_due_date}</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => generate(c.id)} className="btn-primary">Gerar agora</button>
                <button onClick={() => toggleActive(c)}>{c.active ? "Pausar" : "Reativar"}</button>
                <button onClick={() => remove(c.id)} style={{ color: "crimson" }}>Excluir</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {charges.length === 0 && <p>Nenhuma cobrança recorrente cadastrada.</p>}
    </main>
  );
}
