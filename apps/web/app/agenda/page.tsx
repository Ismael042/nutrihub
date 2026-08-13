"use client";

import { useEffect, useState } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";

interface Appointment {
  id: string;
  patient_id: string;
  patient_name: string;
  location_id: string | null;
  location_name: string | null;
  scheduled_at: string;
  status: "scheduled" | "completed" | "canceled" | "no_show";
}

const STATUS_LABEL: Record<Appointment["status"], string> = {
  scheduled: "Agendado",
  completed: "Concluído",
  canceled: "Cancelado",
  no_show: "Faltou"
};

function formatDateHeading(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function AgendaPage() {
  const professional = useRequireAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/appointments");
      if (!res.ok) throw new Error("Não foi possível carregar a agenda");
      setAppointments(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (professional) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional]);

  async function updateStatus(id: string, status: Appointment["status"]) {
    const res = await authFetch(`/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    if (res.ok) load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir este agendamento?")) return;
    const res = await authFetch(`/appointments/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  if (!professional) return null;

  const groups = appointments.reduce<Record<string, Appointment[]>>((acc, appt) => {
    const day = appt.scheduled_at.slice(0, 10);
    (acc[day] ??= []).push(appt);
    return acc;
  }, {});

  return (
    <main className="page-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <div className="page-title-row">
        <h1>Agenda</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/agenda/solicitacoes">Solicitações</a>
          <a href="/agenda/novo" className="btn-primary">
            + Novo agendamento
          </a>
        </div>
      </div>

      {loading && <p>Carregando...</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {!loading && !error && appointments.length === 0 && <p style={{ marginTop: 16 }}>Nenhum agendamento ainda.</p>}

      {Object.entries(groups).map(([day, items]) => (
        <section key={day} style={{ marginTop: 24 }}>
          <h3 style={{ textTransform: "capitalize" }}>{formatDateHeading(items[0].scheduled_at)}</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {items.map((appt) => (
              <li
                key={appt.id}
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid #eee",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8
                }}
              >
                <div>
                  <strong>{formatTime(appt.scheduled_at)}</strong> — {appt.patient_name}
                  {appt.location_name && <span style={{ color: "#666" }}> · {appt.location_name}</span>}
                  <span style={{ color: "#666" }}> · {STATUS_LABEL[appt.status]}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {appt.status === "scheduled" && (
                    <>
                      <button onClick={() => updateStatus(appt.id, "completed")}>Concluir</button>
                      <button onClick={() => updateStatus(appt.id, "no_show")}>Faltou</button>
                      <button onClick={() => updateStatus(appt.id, "canceled")}>Cancelar</button>
                    </>
                  )}
                  <button onClick={() => remove(appt.id)} style={{ color: "crimson" }}>
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
