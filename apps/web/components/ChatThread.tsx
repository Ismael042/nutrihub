"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage, ChatSender } from "@nutrihub/shared";

const POLL_INTERVAL_MS = 5000;

interface ChatThreadProps {
  /** Caminho completo do endpoint de mensagens (GET lista, POST envia). */
  endpoint: string;
  /** Quem sou eu nesta conversa — decide de que lado a própria bolha aparece. */
  mySender: ChatSender;
  fetchFn: (path: string, init?: RequestInit) => Promise<Response>;
  emptyLabel?: string;
  /** Muda quando a conversa selecionada muda (ex: trocar de paciente no inbox) —
      força recarregar do zero em vez de acumular mensagens da conversa anterior. */
  resetKey?: string;
}

export default function ChatThread({
  endpoint,
  mySender,
  fetchFn,
  emptyLabel = "Nenhuma mensagem ainda.",
  resetKey
}: ChatThreadProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetchFn(endpoint);
    if (res.ok) setMessages(await res.json());
  }

  useEffect(() => {
    setMessages([]);
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, resetKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetchFn(endpoint, {
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
    <div>
      <div
        style={{
          border: "1px solid var(--color-border, #ddd)",
          borderRadius: 8,
          padding: 12,
          height: 420,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>{emptyLabel}</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.sender === mySender ? "flex-end" : "flex-start",
              maxWidth: "75%",
              background: m.sender === mySender ? "var(--color-primary)" : "var(--color-bg-subtle)",
              color: m.sender === mySender ? "#fff" : "var(--color-text-primary)",
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
