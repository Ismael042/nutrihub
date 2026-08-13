"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface PublicPage {
  name: string;
  bio: string | null;
}

export default function PublicProfessionalPage() {
  const params = useParams<{ slug: string }>();
  const [page, setPage] = useState<PublicPage | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [requestedAt, setRequestedAt] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/public/${params.slug}`).then(async (res) => {
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      setPage(await res.json());
    });
  }, [params.slug]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !requestedAt) {
      setError("Preencha nome e data/hora desejada");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/public/${params.slug}/booking-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_name: name.trim(),
          patient_email: email || null,
          patient_phone: phone || null,
          requested_at: new Date(requestedAt).toISOString(),
          message: message || null
        })
      });
      if (!res.ok) throw new Error("Não foi possível enviar sua solicitação");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSending(false);
    }
  }

  if (notFound) {
    return (
      <main className="form-container">
        <p>Página não encontrada.</p>
      </main>
    );
  }

  if (!page) return null;

  return (
    <main className="form-container">
      <h1>{page.name}</h1>
      {page.bio && <p style={{ color: "#444" }}>{page.bio}</p>}

      {sent ? (
        <p style={{ marginTop: 16, color: "var(--color-primary, #0F9D74)" }}>
          Solicitação enviada! {page.name.split(" ")[0]} vai confirmar seu horário em breve.
        </p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
          <h2 style={{ fontSize: 16 }}>Solicitar horário</h2>
          <input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} required />
          <input placeholder="E-mail (opcional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="Telefone (opcional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Data e horário desejados
            <input type="datetime-local" value={requestedAt} onChange={(e) => setRequestedAt(e.target.value)} required />
          </label>
          <textarea placeholder="Mensagem (opcional)" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          {error && <p style={{ color: "crimson" }}>{error}</p>}
          <button type="submit" disabled={sending} className="btn-primary" style={{ padding: 10 }}>
            {sending ? "Enviando..." : "Solicitar horário"}
          </button>
        </form>
      )}
    </main>
  );
}
