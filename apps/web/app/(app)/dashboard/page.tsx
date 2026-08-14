"use client";

import { useEffect, useState } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import { formatMoney } from "@nutrihub/shared";
import { SkeletonStatGrid } from "@/components/Skeleton";
import { IconAlertCircle, IconCalendar, IconTrendUp, IconUsers, IconWallet } from "@/components/icons";

interface Appointment {
  id: string;
  patient_id: string;
  patient_name: string;
  location_name: string | null;
  scheduled_at: string;
  status: "scheduled" | "completed" | "canceled" | "no_show";
}

interface Summary {
  income_paid_cents: number;
  expense_paid_cents: number;
  balance_cents: number;
  pending_count: number;
  pending_cents: number;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}

const QUICK_ACTIONS = [
  { href: "/pacientes/novo", label: "Novo paciente" },
  { href: "/agenda/novo", label: "Novo agendamento" },
  { href: "/financeiro/novo", label: "Novo lançamento" },
  { href: "/conteudo/planos/novo", label: "Novo plano alimentar" }
];

export default function DashboardPage() {
  const professional = useRequireAuth();
  const [loading, setLoading] = useState(true);
  const [activePatients, setActivePatients] = useState(0);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    if (!professional) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [patientsRes, appointmentsRes, summaryRes, requestsRes] = await Promise.all([
        authFetch("/patients?status=active"),
        authFetch("/appointments?status=scheduled"),
        authFetch("/financial-transactions/summary"),
        authFetch("/booking-requests?status=pending")
      ]);
      if (cancelled) return;
      if (patientsRes.ok) setActivePatients((await patientsRes.json()).length);
      if (appointmentsRes.ok) setAppointments(await appointmentsRes.json());
      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (requestsRes.ok) setPendingRequests((await requestsRes.json()).length);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [professional]);

  if (!professional) return null;

  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const todayAppointments = appointments.filter((a) => isSameDay(new Date(a.scheduled_at), now));
  const weekAppointments = appointments.filter((a) => {
    const d = new Date(a.scheduled_at);
    return d >= weekStart && d < weekEnd;
  });
  const upcoming = appointments
    .filter((a) => new Date(a.scheduled_at) >= now)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 5);

  const todayLabel = now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div className="content-stack">
      <div>
        <h1>Olá, {professional.name.split(" ")[0]}</h1>
        <p className="page-subtitle" style={{ textTransform: "capitalize" }}>
          {todayLabel}
        </p>
      </div>

      {pendingRequests > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: "var(--space-6)" }}>
          <span className="alert-icon">
            <IconAlertCircle width={13} height={13} />
          </span>
          <p>
            Você tem {pendingRequests} solicitação{pendingRequests > 1 ? "ões" : ""} de horário aguardando resposta.{" "}
            <a href="/agenda/solicitacoes">Ver solicitações</a>
          </p>
        </div>
      )}

      {loading ? (
        <SkeletonStatGrid count={4} />
      ) : (
        <div className="stat-grid" style={{ marginBottom: "var(--space-8)" }}>
          <div className="stat-card">
            <span className="stat-card-label">Pacientes ativos</span>
            <span className="stat-card-value">{activePatients}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-label">Agendamentos hoje</span>
            <span className="stat-card-value">{todayAppointments.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-label">Agendamentos esta semana</span>
            <span className="stat-card-value">{weekAppointments.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-label">Pendências financeiras</span>
            <span className="stat-card-value">{summary ? formatMoney(summary.pending_cents) : "—"}</span>
            {summary && summary.pending_count > 0 && (
              <span className="stat-card-delta neutral">
                {summary.pending_count} lançamento{summary.pending_count > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="dashboard-columns">
        <section>
          <div className="page-title-row" style={{ marginBottom: "var(--space-3)" }}>
            <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconCalendar /> Próximos agendamentos
            </h2>
            <a href="/agenda" className="btn-ghost btn-sm">
              Ver agenda
            </a>
          </div>

          {!loading && upcoming.length === 0 && (
            <div className="empty-state" style={{ padding: "var(--space-8)" }}>
              <div className="empty-state-icon">
                <IconCalendar />
              </div>
              <h3>Nada agendado por enquanto</h3>
              <p>Que tal marcar o próximo atendimento?</p>
              <a href="/agenda/novo" className="btn-primary">
                Novo agendamento
              </a>
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="table-wrap">
              <table>
                <tbody>
                  {upcoming.map((a) => (
                    <tr key={a.id}>
                      <td style={{ whiteSpace: "nowrap", color: "var(--color-text-muted)", fontSize: 13 }}>
                        {new Date(a.scheduled_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}{" "}
                        {new Date(a.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td>
                        <a href={`/pacientes/${a.patient_id}`}>{a.patient_name}</a>
                      </td>
                      <td style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{a.location_name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--space-3)" }}>
            <IconTrendUp /> Ações rápidas
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {QUICK_ACTIONS.map((action) => (
              <a key={action.href} href={action.href} className="btn-secondary btn-block" style={{ justifyContent: "flex-start" }}>
                {action.label}
              </a>
            ))}
          </div>

          <div className="card" style={{ marginTop: "var(--space-5)" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <IconWallet width={14} height={14} /> Financeiro
            </h3>
            {summary && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--color-text-muted)" }}>Entradas (pagas)</span>
                  <strong>{formatMoney(summary.income_paid_cents)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--color-text-muted)" }}>Saldo</span>
                  <strong style={{ color: summary.balance_cents < 0 ? "var(--color-error)" : "var(--color-success)" }}>
                    {formatMoney(summary.balance_cents)}
                  </strong>
                </div>
              </div>
            )}
            <a href="/financeiro" className="btn-ghost btn-sm" style={{ marginTop: 10 }}>
              Ver financeiro →
            </a>
          </div>

          <div className="card" style={{ marginTop: "var(--space-4)" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <IconUsers width={14} height={14} /> Pacientes
            </h3>
            <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: 0 }}>
              {activePatients} paciente{activePatients !== 1 ? "s" : ""} ativo{activePatients !== 1 ? "s" : ""} no momento.
            </p>
            <a href="/pacientes" className="btn-ghost btn-sm" style={{ marginTop: 10 }}>
              Ver pacientes →
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
