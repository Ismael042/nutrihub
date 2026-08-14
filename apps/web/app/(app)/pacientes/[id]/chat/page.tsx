"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { authFetch, useRequireAuth } from "@/lib/auth";
import type { Patient } from "@nutrihub/shared";

interface ChatMessage {
  id: string;
  patient_id: string;
  sender: "professional" | "patient";
  content: string;
  created_at: string;
}

const POLL_INTERVAL_MS = 5000;

export default function ChatPacientePage() {
  const professional = useRequireAuth();
  const params = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadMessages() {
    const res = await authFetch(`/patients/${params.id}/chat`);
    if (res.ok) setMessages(await res.json());
  }

  useEffect(() => {
    if (!professional) return;
    authFetch(`/patients/${params.id}`).then(async (res) => {
      if (res.ok) setPatient(await res.json());
    });
    loadMessages();
    const interval = setInterval(loadMessages, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional, params.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    try {
      const res = await authFetch(`/patients/${params.id}/chat`, {
        method: "POST",
        body: JSON.stringify({ content: content.trim() })
      });
      if (res.ok) {
        setContent("");
        loadMessages();
      }
    } finally {
      setSending(false);
    }
  }

  if (!professional) return null;

  return (
    <main className="page-container">
      <a href={`/pacientes/${params.id}`} className="back-link">← {patient?.name ?? "Paciente"}</a>
      <h1>Chat</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
        Requer que o paciente tenha acesso ao app habilitado (ver perfil do paciente).
      </p>

      <div
        style={{
          border: "1px solid var(--color-border, #ddd)",
          borderRadius: 8,
          padding: 12,
          marginTop: 12,
          height: 420,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8
        }}
      >
        {messages.length === 0 && <p style={{ color: "#999", fontSize: 14 }}>Nenhuma mensagem ainda.</p>}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.sender === "professional" ? "flex-end" : "flex-start",
              maxWidth: "75%",
              background: m.sender === "professional" ? "var(--color-primary, #0F9D74)" : "#f0f0f0",
              color: m.sender === "professional" ? "#fff" : "#222",
              borderRadius: 10,
              padding: "8px 12px"
            }}
          >
            <div style={{ fontSize: 14 }}>{m.content}</div>
            <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>
              {new Date(m.created_at).toLocaleString("pt-BR")}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          placeholder="Escreva uma mensagem..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit" disabled={sending || !content.trim()} className="btn-primary">
          Enviar
        </button>
      </form>
    </main>
  );
}
