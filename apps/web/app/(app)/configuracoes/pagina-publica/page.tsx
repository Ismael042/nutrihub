"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import { initials } from "@/lib/initials";
import { BIO_TEMPLATES } from "@/lib/bioTemplates";
import { useConfirm } from "@/components/ConfirmDialog";
import PhotoUpload from "@/components/PhotoUpload";

const BIO_MAX_LENGTH = 800;

export default function PaginaPublicaConfigPage() {
  const professional = useRequireAuth();
  const confirm = useConfirm();
  const [slug, setSlug] = useState("");
  const [bio, setBio] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const bioRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!professional) return;
    authFetch("/me/public-profile").then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      setSlug(data.public_slug ?? "");
      setBio(data.bio ?? "");
      setEnabled(data.public_booking_enabled);
      setPhotoUrl(data.photo_url ?? null);
    });
  }, [professional]);

  if (!professional) return null;

  const webOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = slug ? `${webOrigin}/p/${slug}` : null;

  async function handleApplyTemplate() {
    const template = BIO_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    if (bio.trim()) {
      const ok = await confirm({
        title: "Substituir o texto da bio?",
        description:
          "O que está escrito no campo vai ser trocado pelo modelo. Nada que já foi salvo muda até você clicar em Salvar."
      });
      if (!ok) return;
    }
    setBio(template.text);
    setTemplateId("");
    bioRef.current?.focus();
  }

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
        Uma página simples com sua foto, nome e bio, com formulário de solicitação de horário — os pedidos caem em
        "Solicitações" na Agenda para você aprovar ou recusar.
      </p>

      {/* Fora do form de salvar de propósito: arquivo não cabe num PATCH JSON, e
          "escolhi a foto mas esqueci de salvar" seria um estado ruim. Envia na hora. */}
      <div className="field" style={{ marginTop: 16 }}>
        <span className="field-label">Foto</span>
        <PhotoUpload
          endpoint="/me/public-profile/photo"
          photoUrl={photoUrl}
          onChange={(data) => setPhotoUrl((data.photo_url as string | null) ?? null)}
          fallback={initials(professional.name)}
          hint="JPG, PNG ou WebP, até 3 MB. Aparece na sua página pública."
          alt="Sua foto de perfil"
          confirmTitle="Remover sua foto?"
          confirmDescription="Sua página pública volta a mostrar só suas iniciais."
        />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label className="field-label" htmlFor="public-slug">
            Link (slug)
          </label>
          <input
            id="public-slug"
            placeholder="ex: joice-nutri"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
          />
        </div>
        {publicUrl && (
          <p style={{ fontSize: 13, marginTop: "calc(var(--space-4) * -1)", marginBottom: "var(--space-4)" }}>
            Sua página: <a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a>
          </p>
        )}

        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="bio-template">
              Modelo de bio
            </label>
            <select id="bio-template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Escolha um modelo...</option>
              {BIO_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: "0 0 auto", justifyContent: "flex-end" }}>
            <button type="button" className="btn-secondary" onClick={handleApplyTemplate} disabled={!templateId}>
              Usar modelo
            </button>
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="public-bio">
            Bio
          </label>
          <textarea
            id="public-bio"
            ref={bioRef}
            rows={6}
            maxLength={BIO_MAX_LENGTH}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
          <span className="field-hint">
            Troque os campos entre colchetes pelos seus dados antes de salvar. {bio.length}/{BIO_MAX_LENGTH}
          </span>
        </div>

        <div className="switch-field" style={{ marginBottom: "var(--space-4)" }}>
          <div className="switch-field-text">
            <span className="switch-field-label">
              Página pública
              <span className={`badge ${enabled ? "badge-success" : "badge-neutral"}`}>
                {enabled ? "Ativa" : "Desativada"}
              </span>
            </span>
            <span className="switch-field-hint">
              {enabled
                ? "Qualquer pessoa com o link pode ver seu perfil e solicitar horário."
                : "O link fica fora do ar até você ativar de novo."}
            </span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              aria-label="Página pública habilitada"
            />
            <span className="switch-track" />
          </label>
        </div>
        {error && (
          <div className="alert alert-error" style={{ marginBottom: "var(--space-4)" }}>
            <p>{error}</p>
          </div>
        )}
        {message && <p style={{ color: "var(--color-success)" }}>{message}</p>}
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
