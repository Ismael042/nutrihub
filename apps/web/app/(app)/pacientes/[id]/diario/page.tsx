"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { authFetch, useRequireAuth } from "@/lib/auth";
import type { Patient } from "@nutrihub/shared";

interface DiaryEntry {
  id: string;
  logged_at: string;
  meal_kind: string | null;
  description: string;
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Café da manhã",
  lunch: "Almoço",
  dinner: "Jantar",
  snack: "Lanche"
};

export default function DiarioPacientePage() {
  const professional = useRequireAuth();
  const params = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);

  useEffect(() => {
    if (!professional) return;
    authFetch(`/patients/${params.id}`).then(async (res) => {
      if (res.ok) setPatient(await res.json());
    });
    authFetch(`/patients/${params.id}/diary`).then(async (res) => {
      if (res.ok) setEntries(await res.json());
    });
  }, [professional, params.id]);

  if (!professional) return null;

  return (
    <div className="page-container">
      <a href={`/pacientes/${params.id}`} className="back-link">← {patient?.name ?? "Paciente"}</a>
      <h1>Diário alimentar</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>Registros feitos pelo próprio paciente no app.</p>

      {entries.length > 0 && (
        <ul className="list-rows">
          {entries.map((e) => (
            <li key={e.id} className="list-row" style={{ display: "block" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {e.meal_kind && <span className="badge">{MEAL_LABELS[e.meal_kind] ?? e.meal_kind}</span>}
                <span style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
                  {new Date(e.logged_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <div style={{ marginTop: 4 }}>{e.description}</div>
            </li>
          ))}
        </ul>
      )}
      {entries.length === 0 && <p>O paciente ainda não registrou nada.</p>}
    </div>
  );
}
