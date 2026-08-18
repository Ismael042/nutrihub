"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import { formatDate } from "@nutrihub/shared";
import { useConfirm } from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { IconTarget } from "@/components/icons";

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
  const confirm = useConfirm();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientId, setPatientId] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [patientsRes, goalsRes] = await Promise.all([
        authFetch("/patients?status=all"),
        authFetch("/goals")
      ]);
      if (patientsRes.ok) setPatients(await patientsRes.json());
      if (goalsRes.ok) setGoals(await goalsRes.json());
    } finally {
      setLoading(false);
    }
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
    if (!(await confirm({ title: "Excluir esta meta?", danger: true, confirmLabel: "Excluir" }))) return;
    await authFetch(`/goals/${id}`, { method: "DELETE" });
    load();
  }

  if (!professional) return null;

  return (
    <div className="page-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <h1>Metas</h1>

      <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
        <div className="field">
          <label className="field-label field-required" htmlFor="goal-patient">
            Paciente
          </label>
          <select id="goal-patient" value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
            <option value="">Selecione o paciente...</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field-row">
          <div className="field">
            <label className="field-label field-required" htmlFor="goal-description">
              Descrição da meta
            </label>
            <input
              id="goal-description"
              placeholder="ex: Perder 5kg"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="field field-sm">
            <label className="field-label" htmlFor="goal-target-date">
              Prazo
            </label>
            <input id="goal-target-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
        </div>
        {error && (
          <div className="alert alert-error" style={{ marginBottom: "var(--space-4)" }}>
            <p>{error}</p>
          </div>
        )}
        <button type="submit" className="btn-primary">
          Adicionar meta
        </button>
      </form>

      {loading && (
        <div style={{ marginTop: 20 }}>
          <SkeletonRows count={3} />
        </div>
      )}

      {!loading && goals.length === 0 && (
        <EmptyState icon={<IconTarget />} title="Nenhuma meta cadastrada" description="Defina uma meta para um paciente acima." />
      )}

      {!loading && goals.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 20 }}>
          {goals.map((g) => (
            <li
              key={g.id}
              style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between" }}
            >
              <div>
                <span style={{ textDecoration: g.achieved ? "line-through" : "none" }}>{g.description}</span>
                <span style={{ color: "var(--color-text-muted)" }}> · {g.patient_name}</span>
                {g.target_date && <span style={{ color: "var(--color-text-muted)" }}> · até {formatDate(g.target_date)}</span>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => toggleAchieved(g)}>{g.achieved ? "Reabrir" : "Concluir"}</button>
                <button onClick={() => remove(g.id)} style={{ color: "var(--color-error)" }}>
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
