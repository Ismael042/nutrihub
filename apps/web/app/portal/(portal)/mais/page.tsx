"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearPatientSession, patientFetch, useRequirePatientAuth } from "@/lib/patientAuth";

interface Goal {
  id: string;
  description: string;
  target_date: string | null;
  achieved: boolean;
}

interface PrescriptionItem {
  description: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
}

interface Prescription {
  id: string;
  kind: "supplement" | "phytotherapic";
  items: PrescriptionItem[];
}

export default function PatientMaisPage() {
  const router = useRouter();
  const patient = useRequirePatientAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);

  useEffect(() => {
    if (!patient) return;
    patientFetch("/patient-portal/goals").then(async (res) => {
      if (res.ok) setGoals(await res.json());
    });
    patientFetch("/patient-portal/prescriptions").then(async (res) => {
      if (res.ok) setPrescriptions(await res.json());
    });
  }, [patient]);

  function handleLogout() {
    clearPatientSession();
    router.push("/portal/entrar");
  }

  if (!patient) return null;

  return (
    <div className="page-container">
      <h1>{patient?.name ?? "Minha conta"}</h1>
      <p className="text-caption" style={{ marginBottom: 20 }}>
        {patient?.email}
      </p>

      <h3 style={{ textTransform: "none", letterSpacing: 0, color: "var(--color-text-primary)", fontSize: 15 }}>
        Metas
      </h3>
      {goals.length === 0 && <p className="text-caption">Nenhuma meta cadastrada.</p>}
      <div className="card-grid" style={{ marginBottom: 24 }}>
        {goals.map((g) => (
          <div key={g.id} className="card card-static">
            <span style={{ textDecoration: g.achieved ? "line-through" : "none" }}>{g.description}</span>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--color-text-muted)" }}>
              {g.achieved ? "✓ Concluída" : "Em andamento"}
              {g.target_date && ` · até ${new Date(g.target_date).toLocaleDateString("pt-BR")}`}
            </p>
          </div>
        ))}
      </div>

      <h3 style={{ textTransform: "none", letterSpacing: 0, color: "var(--color-text-primary)", fontSize: 15 }}>
        Prescrições
      </h3>
      {prescriptions.length === 0 && <p className="text-caption">Nenhuma prescrição ainda.</p>}
      <div className="card-grid" style={{ marginBottom: 24 }}>
        {prescriptions.map((p) => (
          <div key={p.id} className="card card-static">
            <span className="badge badge-neutral">
              {p.kind === "supplement" ? "Suplemento" : "Fitoterápico"}
            </span>
            <ul style={{ marginTop: 10 }}>
              {p.items.map((item, i) => (
                <li key={i} style={{ fontSize: 14 }}>
                  {item.description}
                  {[item.dosage, item.frequency, item.duration].filter(Boolean).length > 0 &&
                    ` — ${[item.dosage, item.frequency, item.duration].filter(Boolean).join(", ")}`}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <button onClick={handleLogout} className="btn-danger">
        Sair
      </button>
    </div>
  );
}
