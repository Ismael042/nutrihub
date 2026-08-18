"use client";

import { useEffect, useState } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import ChatThread from "@/components/ChatThread";
import EmptyState from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { IconChat } from "@/components/icons";
import { initials } from "@/lib/initials";

interface Conversation {
  patient_id: string;
  patient_name: string;
  patient_photo_url: string | null;
  last_message: string;
  last_sender: "professional" | "patient";
  last_message_at: string;
  unread_count: number;
}

interface PatientOption {
  id: string;
  name: string;
}

function relativeTime(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `${diffD} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function MensagensPage() {
  const professional = useRequireAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  async function loadConversations() {
    const res = await authFetch("/chat/conversations");
    if (res.ok) setConversations(await res.json());
  }

  useEffect(() => {
    if (!professional) return;
    loadConversations().finally(() => setLoading(false));
    authFetch("/patients?status=all").then(async (res) => {
      if (res.ok) setPatients(await res.json());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional]);

  // Abrir uma conversa marca as mensagens como lidas no backend (efeito colateral do
  // GET de mensagens em ChatThread) — recarrega a lista aqui pro badge de não lida
  // sumir na hora, sem esperar o próximo poll de 5s.
  useEffect(() => {
    if (selected) loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  if (!professional) return null;

  const selectedConversation = conversations.find((c) => c.patient_id === selected);
  const selectedName = selectedConversation?.patient_name ?? patients.find((p) => p.id === selected)?.name ?? "";
  const patientsWithoutConversation = patients.filter((p) => !conversations.some((c) => c.patient_id === p.id));

  return (
    <div className="page-container">
      <h1>Mensagens</h1>

      <div className={`inbox-layout${selected ? " showing-thread" : ""}`} style={{ marginTop: 16 }}>
        <div className="conversation-list-pane">
          {patientsWithoutConversation.length > 0 && (
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field-label" htmlFor="new-conversation">
                + Nova conversa
              </label>
              <select
                id="new-conversation"
                value=""
                onChange={(e) => {
                  if (e.target.value) setSelected(e.target.value);
                }}
              >
                <option value="">Selecione um paciente...</option>
                {patientsWithoutConversation.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {loading && <SkeletonRows count={4} />}

          {!loading && conversations.length === 0 && (
            <EmptyState
              icon={<IconChat />}
              title="Nenhuma conversa ainda"
              description="As mensagens dos pacientes com acesso ao app aparecem aqui."
            />
          )}

          {!loading && conversations.length > 0 && (
            <div className="list-rows">
              {conversations.map((c) => (
                <button
                  key={c.patient_id}
                  type="button"
                  onClick={() => setSelected(c.patient_id)}
                  className={`list-row conversation-row${c.unread_count > 0 ? " unread" : ""}${
                    selected === c.patient_id ? " active" : ""
                  }`}
                >
                  {c.patient_photo_url ? (
                    <img
                      src={c.patient_photo_url}
                      alt=""
                      style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                    />
                  ) : (
                    <span className="avatar" style={{ width: 40, height: 40, flexShrink: 0 }}>
                      {initials(c.patient_name)}
                    </span>
                  )}
                  <span className="conversation-row-body">
                    <span className="conversation-row-name">{c.patient_name}</span>
                    <span className="conversation-row-preview">
                      {c.last_sender === "professional" ? "Você: " : ""}
                      {c.last_message}
                    </span>
                  </span>
                  <span className="conversation-row-meta">
                    <span className="conversation-row-time">{relativeTime(c.last_message_at)}</span>
                    {c.unread_count > 0 && <span className="unread-badge">{c.unread_count}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="thread-pane">
          {selected ? (
            <>
              <button
                type="button"
                className="back-link thread-back"
                onClick={() => setSelected(null)}
                style={{ border: "none", background: "none", cursor: "pointer" }}
              >
                ← Conversas
              </button>
              <h3 style={{ marginBottom: 12 }}>{selectedName}</h3>
              <ChatThread
                endpoint={`/patients/${selected}/chat`}
                mySender="professional"
                fetchFn={authFetch}
                resetKey={selected}
              />
            </>
          ) : (
            <p style={{ color: "var(--color-text-muted)" }}>Selecione uma conversa à esquerda.</p>
          )}
        </div>
      </div>
    </div>
  );
}
