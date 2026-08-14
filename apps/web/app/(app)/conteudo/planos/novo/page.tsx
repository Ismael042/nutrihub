"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authFetch, useRequireAuth } from "@/lib/auth";

interface Patient {
  id: string;
  name: string;
}

export default function NovoPlanoPage() {
  const professional = useRequireAuth();
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    if (!patientId) {
      setError("Selecione um paciente");
      return;
    }
    const res = await authFetch("/diet-plans", {
      method: "POST",
      body: JSON.stringify({ patient_id: patientId, name })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail ?? "Não foi possível criar o plano");
      return;
    }
    router.push(`/conteudo/planos/${data.id}`);
  }

  return (
    <main className="form-container">
      <a href="/conteudo/planos" className="back-link">← Planos alimentares</a>
      <h1>Novo plano alimentar</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <select value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
          <option value="">Selecione o paciente...</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Nome do plano (ex: Plano Semana 1)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        {error && <p style={{ color: "var(--color-error)" }}>{error}</p>}
        <button type="submit" className="btn-primary">
          Criar plano
        </button>
      </form>
    </main>
  );
}
