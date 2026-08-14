"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import type { LabExamRequest } from "@nutrihub/shared";
import EmptyState from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { IconFlask } from "@/components/icons";

interface Patient {
  id: string;
  name: string;
}

export default function ExamesPage() {
  const professional = useRequireAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [requests, setRequests] = useState<LabExamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientId, setPatientId] = useState("");
  const [examNames, setExamNames] = useState<string[]>([""]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [patientsRes, listRes] = await Promise.all([
        authFetch("/patients?status=all"),
        authFetch("/lab-exam-requests")
      ]);
      if (patientsRes.ok) setPatients(await patientsRes.json());
      if (listRes.ok) setRequests(await listRes.json());
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
    const exams = examNames.map((n) => n.trim()).filter(Boolean).map((name) => ({ name }));
    if (!patientId) {
      setError("Selecione um paciente");
      return;
    }
    if (exams.length === 0) {
      setError("Adicione ao menos um exame");
      return;
    }
    const res = await authFetch("/lab-exam-requests", {
      method: "POST",
      body: JSON.stringify({ patient_id: patientId, exams, notes: notes || null })
    });
    if (!res.ok) {
      setError("Não foi possível salvar");
      return;
    }
    setExamNames([""]);
    setNotes("");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta solicitação?")) return;
    await authFetch(`/lab-exam-requests/${id}`, { method: "DELETE" });
    load();
  }

  if (!professional) return null;

  return (
    <main className="page-container">
      <h1>Solicitações de exames</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        <select value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
          <option value="">Selecione o paciente...</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {examNames.map((name, i) => (
            <div key={i} style={{ display: "flex", gap: 8 }}>
              <input
                placeholder={`Exame ${i + 1} (ex: Hemograma completo)`}
                value={name}
                onChange={(e) => setExamNames(examNames.map((n, idx) => (idx === i ? e.target.value : n)))}
                style={{ flex: 1 }}
              />
              {examNames.length > 1 && (
                <button type="button" onClick={() => setExamNames(examNames.filter((_, idx) => idx !== i))}>
                  ×
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setExamNames([...examNames, ""])}>
            + Adicionar exame
          </button>
        </div>

        <input placeholder="Observações (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" className="btn-primary" style={{ padding: 10 }}>
          Solicitar
        </button>
      </form>

      {loading && (
        <div style={{ marginTop: 20 }}>
          <SkeletonRows count={3} />
        </div>
      )}

      {!loading && requests.length === 0 && (
        <EmptyState
          icon={<IconFlask />}
          title="Nenhuma solicitação de exame"
          description="Selecione um paciente e solicite exames laboratoriais acima."
        />
      )}

      {!loading && requests.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 20 }}>
          {requests.map((r) => (
            <li key={r.id} style={{ padding: "10px 0", borderBottom: "1px solid #eee" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{r.patient_name}</strong>
                <button onClick={() => remove(r.id)} style={{ color: "crimson" }}>
                  Excluir
                </button>
              </div>
              <div>{r.exams.map((e) => e.name).join(", ")}</div>
              <div style={{ color: "#666" }}>
                {r.requested_at}
                {r.notes && ` · ${r.notes}`}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
