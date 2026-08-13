"use client";

import { useEffect, useState } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";

interface BookingRequest {
  id: string;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string | null;
  requested_at: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
}

export default function SolicitacoesPage() {
  const professional = useRequireAuth();
  const [requests, setRequests] = useState<BookingRequest[]>([]);

  async function load() {
    const res = await authFetch("/booking-requests?status=pending");
    if (res.ok) setRequests(await res.json());
  }

  useEffect(() => {
    if (professional) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional]);

  async function approve(id: string) {
    const res = await authFetch(`/booking-requests/${id}/approve`, { method: "POST" });
    if (res.ok) load();
  }

  async function reject(id: string) {
    const res = await authFetch(`/booking-requests/${id}/reject`, { method: "POST" });
    if (res.ok) load();
  }

  if (!professional) return null;

  return (
    <main className="page-container">
      <a href="/agenda" className="back-link">← Agenda</a>
      <h1>Solicitações de horário</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        Pedidos recebidos pela sua <a href="/configuracoes/pagina-publica">página pública</a>.
      </p>

      <ul style={{ listStyle: "none", padding: 0, marginTop: 20 }}>
        {requests.map((r) => (
          <li key={r.id} style={{ padding: "12px 0", borderBottom: "1px solid #eee" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <strong>{r.patient_name}</strong>
                <div style={{ color: "#666", fontSize: 14 }}>
                  {new Date(r.requested_at).toLocaleString("pt-BR")}
                  {r.patient_email && ` · ${r.patient_email}`}
                  {r.patient_phone && ` · ${r.patient_phone}`}
                </div>
                {r.message && <div style={{ fontSize: 14, marginTop: 4 }}>{r.message}</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => approve(r.id)} className="btn-primary">Aprovar</button>
                <button onClick={() => reject(r.id)} style={{ color: "crimson" }}>Recusar</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {requests.length === 0 && <p>Nenhuma solicitação pendente.</p>}
    </main>
  );
}
