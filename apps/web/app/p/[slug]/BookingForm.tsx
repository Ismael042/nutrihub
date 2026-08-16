"use client";

import { useState, type FormEvent } from "react";
import { API_URL } from "@/lib/auth";
import { formatPhone } from "@/lib/masks";

export default function BookingForm({ slug, name, bio }: { slug: string; name: string; bio: string | null }) {
  const [formName, setFormName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [requestedAt, setRequestedAt] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!formName.trim() || !requestedAt) {
      setError("Preencha nome e data/hora desejada");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/public/${slug}/booking-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_name: formName.trim(),
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

  return (
    <main className="form-container">
      <h1>{name}</h1>
      {bio && <p style={{ color: "var(--color-text-secondary)" }}>{bio}</p>}

      {sent ? (
        <div className="alert alert-success" style={{ marginTop: 16 }}>
          <p>
            Solicitação enviada! {name.split(" ")[0]} vai confirmar seu horário em breve.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 16 }}>Solicitar horário</h2>
          <div className="field">
            <label className="field-label field-required" htmlFor="patient-name">
              Seu nome
            </label>
            <input id="patient-name" autoComplete="name" value={formName} onChange={(e) => setFormName(e.target.value)} required />
          </div>
          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="patient-email">
                E-mail (opcional)
              </label>
              <input
                id="patient-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field field-md">
              <label className="field-label" htmlFor="patient-phone">
                Telefone (opcional)
              </label>
              <input
                id="patient-phone"
                type="tel"
                autoComplete="tel"
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
              />
            </div>
          </div>
          <div className="field">
            <label className="field-label field-required" htmlFor="requested-at">
              Data e horário desejados
            </label>
            <input
              id="requested-at"
              type="datetime-local"
              value={requestedAt}
              onChange={(e) => setRequestedAt(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="message">
              Mensagem (opcional)
            </label>
            <textarea id="message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: "var(--space-4)" }}>
              <p>{error}</p>
            </div>
          )}
          <button type="submit" disabled={sending} className="btn-primary btn-block">
            {sending ? "Enviando..." : "Solicitar horário"}
          </button>
        </form>
      )}
    </main>
  );
}
