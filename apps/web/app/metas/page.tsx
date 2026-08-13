"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";

interface Patient {
  id: string;
  name: string;
}

interface Goal {
  id: string;
  patient_id: string;
  patient_name: string;
  description: string;
  target_date: string | null;
  achieved: boolean;
}

export default function MetasPage() {
  const professional = useRequireAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [patientId, setPatientId] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [patientsRes, goalsRes] = await Promise.all([
      authFetch("/patients?status=all"),
      authFetch("/goals")
    ]);
    if (patientsRes.ok) setPatients(await patientsRes.json());
    if (goalsRes.ok) setGoals(await goalsRes.json());
  }

  useEffect(() => {
    if (professional) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!patientId) {
      setError("Selecione um paciente");
      return;
    }
    const res = await authFetch("/goals", {
      method: "POST",
      body: JSON.stringify({ patient_id: patientId, description, target_date: targetDate || null })
    });
    if (!res.ok) {
      setError("Não foi possível salvar");
      return;
    }
    setDescription("");
    setTargetDate("");
    load();
  }

  async function toggleAchieved(goal: Goal) {
    await authFetch(`/goals/${goal.id}`, { method: "PATCH", body: JSON.stringify({ achieved: !goal.achieved }) });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta meta?")) return;
    await authFetch(`/goals/${id}`, { method: "DELETE" });
    load();
  }

  if (!professional) return null;

  return (
    <main className="page-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <h1>Metas</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        <select value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
          <option value="">Selecione o paciente...</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Descrição da meta (ex: Perder 5kg)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" style={{ padding: 10 }}>
          Adicionar meta
        </button>
      </form>

      <ul style={{ listStyle: "none", padding: 0, marginTop: 20 }}>
        {goals.map((g) => (
          <li
            key={g.id}
            style={{ padding: "10px 0", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}
          >
            <div>
              <span style={{ textDecoration: g.achieved ? "line-through" : "none" }}>{g.description}</span>
              <span style={{ color: "#666" }}> · {g.patient_name}</span>
              {g.target_date && <span style={{ color: "#666" }}> · até {g.target_date}</span>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => toggleAchieved(g)}>{g.achieved ? "Reabrir" : "Concluir"}</button>
              <button onClick={() => remove(g.id)} style={{ color: "crimson" }}>
                Excluir
              </button>
            </div>
          </li>
        ))}
      </ul>
      {goals.length === 0 && <p>Nenhuma meta cadastrada.</p>}
    </main>
  );
}
