"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { patientFetch } from "@/lib/patientAuth";
import type { ChatMessage } from "@nutrihub/shared";

const POLL_INTERVAL_MS = 5000;

export default function PatientChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await patientFetch("/patient-portal/chat");
    if (res.ok) setMessages(await res.json());
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      const res = await patientFetch("/patient-portal/chat", {
        method: "POST",
        body: JSON.stringify({ content: content.trim() })
      });
      if (res.ok) {
        setContent("");
        load();
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page-container">
      <h1>Chat com seu nutricionista</h1>

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
        {messages.length === 0 && (
          <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>Nenhuma mensagem ainda.</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.sender === "patient" ? "flex-end" : "flex-start",
              maxWidth: "75%",
              background: m.sender === "patient" ? "var(--color-primary)" : "var(--color-bg-subtle)",
              color: m.sender === "patient" ? "#fff" : "var(--color-text-primary)",
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
    </div>
  );
}
