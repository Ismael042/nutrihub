"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authFetch, useRequireAuth } from "@/lib/auth";

interface Patient {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
}

export default function NovoAgendamentoPage() {
  const professional = useRequireAuth();
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [patientId, setPatientId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!professional) return;
    async function loadOptions() {
      const [patientsRes, locationsRes] = await Promise.all([
        authFetch("/patients?status=active"),
        authFetch("/locations")
      ]);
      if (patientsRes.ok) setPatients(await patientsRes.json());
      if (locationsRes.ok) setLocations(await locationsRes.json());
    }
    loadOptions();
  }, [professional]);

  if (!professional) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!patientId) {
      setError("Selecione um paciente");
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch("/appointments", {
        method: "POST",
        body: JSON.stringify({
          patient_id: patientId,
          location_id: locationId || null,
          scheduled_at: scheduledAt
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Não foi possível agendar");
      router.push("/agenda");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="form-container">
      <a href="/agenda" className="back-link">← Agenda</a>
      <h1>Novo agendamento</h1>

      {patients.length === 0 && (
        <p>
          Nenhum paciente ativo cadastrado ainda. <a href="/pacientes/novo">Cadastre um paciente</a> primeiro.
        </p>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Paciente
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
            <option value="">Selecione...</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Data e hora
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Local (opcional)
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">Sem local definido</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <p style={{ margin: 0, fontSize: 14 }}>
          <a href="/locais/novo?returnTo=/agenda/novo">+ Cadastrar novo local de atendimento</a>
        </p>

        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary" style={{ padding: 10 }}>
          {loading ? "Agendando..." : "Agendar"}
        </button>
      </form>
    </main>
  );
}
