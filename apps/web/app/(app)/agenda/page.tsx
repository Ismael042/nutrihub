"use client";

import { useEffect, useState } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { IconCalendar } from "@/components/icons";

interface Appointment {
  id: string;
  patient_id: string;
  patient_name: string;
  location_id: string | null;
  location_name: string | null;
  scheduled_at: string;
  status: "scheduled" | "completed" | "canceled" | "no_show";
}

const STATUS_BADGE: Record<Appointment["status"], string> = {
  scheduled: "badge-info",
  completed: "badge-success",
  canceled: "badge-neutral",
  no_show: "badge-warning"
};

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
  const confirm = useConfirm();
  const toast = useToast();
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
    if (!(await confirm({ title: "Excluir este agendamento?", danger: true, confirmLabel: "Excluir" }))) return;
    const res = await authFetch(`/appointments/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Agendamento excluído.");
      load();
    }
  }

  if (!professional) return null;

  const groups = appointments.reduce<Record<string, Appointment[]>>((acc, appt) => {
    const day = appt.scheduled_at.slice(0, 10);
    (acc[day] ??= []).push(appt);
    return acc;
  }, {});

  return (
    <div className="content-stack">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <div className="page-title-row">
        <h1>Agenda</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/agenda/solicitacoes" className="btn-ghost">
            Solicitações
          </a>
          <a href="/agenda/novo" className="btn-primary">
            + Novo agendamento
          </a>
        </div>
      </div>

      {loading && <SkeletonRows count={4} />}
      {!loading && error && (
        <div className="alert alert-error">
          <p>{error}</p>
        </div>
      )}
      {!loading && !error && appointments.length === 0 && (
        <EmptyState
          icon={<IconCalendar />}
          title="Nenhum agendamento ainda"
          description="Marque o primeiro atendimento pra começar a preencher sua agenda."
          actionLabel="Novo agendamento"
          actionHref="/agenda/novo"
        />
      )}

      {!loading &&
        Object.entries(groups).map(([day, items]) => (
          <section key={day} style={{ marginTop: 8 }}>
            <h3 style={{ textTransform: "capitalize", color: "var(--color-text-muted)", fontSize: 14 }}>
              {formatDateHeading(items[0].scheduled_at)}
            </h3>
            <div className="table-wrap" style={{ marginBottom: "var(--space-4)" }}>
              <table>
                <tbody>
                  {items.map((appt) => (
                    <tr key={appt.id}>
                      <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{formatTime(appt.scheduled_at)}</td>
                      <td>
                        <a href={`/pacientes/${appt.patient_id}`}>{appt.patient_name}</a>
                        {appt.location_name && (
                          <span style={{ color: "var(--color-text-muted)" }}> · {appt.location_name}</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[appt.status]}`}>{STATUS_LABEL[appt.status]}</span>
                      </td>
                      <td className="table-actions">
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          {appt.status === "scheduled" && (
                            <>
                              <button className="btn-sm btn-secondary" onClick={() => updateStatus(appt.id, "completed")}>
                                Concluir
                              </button>
                              <button className="btn-sm btn-secondary" onClick={() => updateStatus(appt.id, "no_show")}>
                                Faltou
                              </button>
                              <button className="btn-sm btn-secondary" onClick={() => updateStatus(appt.id, "canceled")}>
                                Cancelar
                              </button>
                            </>
                          )}
                          <button className="btn-sm btn-danger" onClick={() => remove(appt.id)}>
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
    </div>
  );
}
