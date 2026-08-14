"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";

export default function PaginaPublicaConfigPage() {
  const professional = useRequireAuth();
  const [slug, setSlug] = useState("");
  const [bio, setBio] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!professional) return;
    authFetch("/me/public-profile").then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      setSlug(data.public_slug ?? "");
      setBio(data.bio ?? "");
      setEnabled(data.public_booking_enabled);
    });
  }, [professional]);

  if (!professional) return null;

  const webOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = slug ? `${webOrigin}/p/${slug}` : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const res = await authFetch("/me/public-profile", {
        method: "PATCH",
        body: JSON.stringify({ public_slug: slug || null, bio: bio || null, public_booking_enabled: enabled })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Não foi possível salvar");
      setMessage("Salvo com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="form-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <h1>Página pública</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
        Uma página simples com seu nome e bio, com formulário de solicitação de horário — os pedidos caem em
        "Solicitações" na Agenda para você aprovar ou recusar.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Link (slug)
          <input
            placeholder="ex: joice-nutri"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
          />
        </label>
        {publicUrl && (
          <p style={{ fontSize: 13 }}>
            Sua página: <a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a>
          </p>
        )}
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Bio
          <textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Página pública habilitada
        </label>
        {error && <p style={{ color: "var(--color-error)" }}>{error}</p>}
        {message && <p style={{ color: "var(--color-primary, #0F9D74)" }}>{message}</p>}
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </form>
      <p style={{ marginTop: 16, fontSize: 13 }}>
        <a href="/agenda/solicitacoes">Ver solicitações de horário</a>
      </p>
    </main>
  );
}
