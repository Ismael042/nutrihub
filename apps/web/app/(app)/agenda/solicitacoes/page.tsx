"use client";

import { useEffect, useState } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { IconCalendar } from "@/components/icons";

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
  const toast = useToast();
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await authFetch("/booking-requests?status=pending");
    if (res.ok) setRequests(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    if (professional) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional]);

  async function approve(id: string, name: string) {
    const res = await authFetch(`/booking-requests/${id}/approve`, { method: "POST" });
    if (res.ok) {
      toast.success(`Horário de ${name} confirmado e adicionado à agenda.`);
      load();
    }
  }

  async function reject(id: string) {
    const res = await authFetch(`/booking-requests/${id}/reject`, { method: "POST" });
    if (res.ok) {
      toast.success("Solicitação recusada.");
      load();
    }
  }

  if (!professional) return null;

  return (
    <div className="content-stack">
      <a href="/agenda" className="back-link">← Agenda</a>
      <h1>Solicitações de horário</h1>
      <p className="page-subtitle">
        Pedidos recebidos pela sua <a href="/configuracoes/pagina-publica">página pública</a>.
      </p>

      {loading && <SkeletonRows count={3} />}

      {!loading && requests.length === 0 && (
        <EmptyState
          icon={<IconCalendar />}
          title="Nenhuma solicitação pendente"
          description="Quando alguém pedir um horário pela sua página pública, o pedido aparece aqui pra você aprovar ou recusar."
        />
      )}

      {!loading && requests.length > 0 && (
        <div className="table-wrap table-responsive-cards">
          <table>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="table-cell-block" data-label="Solicitação">
                    <strong>{r.patient_name}</strong>
                    <div className="text-caption">
                      {new Date(r.requested_at).toLocaleString("pt-BR")}
                      {r.patient_email && ` · ${r.patient_email}`}
                      {r.patient_phone && ` · ${r.patient_phone}`}
                    </div>
                    {r.message && <div style={{ fontSize: 14, marginTop: 4 }}>{r.message}</div>}
                  </td>
                  <td className="table-actions" data-label="Ações">
                    <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => approve(r.id, r.patient_name)} className="btn-primary btn-sm">
                        Aprovar
                      </button>
                      <button onClick={() => reject(r.id)} className="btn-danger btn-sm">
                        Recusar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
