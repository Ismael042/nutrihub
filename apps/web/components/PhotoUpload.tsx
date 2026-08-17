"use client";

import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { authFetch } from "@/lib/auth";
import { useConfirm } from "./ConfirmDialog";
import { useToast } from "./Toast";

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface Props {
  /** Rota do upload; o DELETE usa a mesma. Ex: "/patients/123/photo". */
  endpoint: string;
  /** URL atual (assinada, no caso das privadas) ou null. */
  photoUrl: string | null;
  /** Recebe a resposta inteira do endpoint — quem chama decide o que fazer com ela
   *  (o campo da URL varia: photo_url nas fotos, logo_url no logo). */
  onChange: (data: Record<string, unknown>) => void;
  /** O que mostrar quando não há imagem (iniciais, ícone, texto). */
  fallback?: ReactNode;
  hint?: string;
  /** Texto do botão quando ainda não há imagem. */
  emptyLabel?: string;
  confirmTitle?: string;
  confirmDescription?: string;
  /** Logo é retangular; foto é redonda. */
  shape?: "circle" | "rect";
  size?: "sm" | "md";
  alt?: string;
}

export default function PhotoUpload({
  endpoint,
  photoUrl,
  onChange,
  fallback,
  hint = "JPG, PNG ou WebP, até 3 MB.",
  emptyLabel = "Enviar foto",
  confirmTitle = "Remover a foto?",
  confirmDescription,
  shape = "circle",
  size = "md",
  alt = "Imagem"
}: Props) {
  const confirm = useConfirm();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reseta o input já: sem isso, escolher o mesmo arquivo de novo não dispara change.
    e.target.value = "";
    if (!file) return;

    // Pré-checagem no cliente pra falhar rápido, sem gastar round-trip. A validação
    // que vale é a do servidor (que também re-encoda a imagem).
    if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
      toast.error("Envie uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Imagem muito grande — envie um arquivo de até 3 MB.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await authFetch(endpoint, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Não foi possível enviar a imagem");
      onChange(data);
      toast.success("Imagem atualizada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    const ok = await confirm({
      title: confirmTitle,
      description: confirmDescription,
      confirmLabel: "Remover",
      danger: true
    });
    if (!ok) return;
    setUploading(true);
    try {
      const res = await authFetch(endpoint, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Não foi possível remover a imagem");
      onChange(data);
      toast.success("Imagem removida.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setUploading(false);
    }
  }

  const previewClass = [
    "avatar-upload-preview",
    shape === "rect" ? "avatar-upload-preview-rect" : "",
    size === "sm" ? "avatar-upload-preview-sm" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="avatar-upload">
      {photoUrl ? (
        <img className={previewClass} src={photoUrl} alt={alt} />
      ) : (
        <span className={`${previewClass} avatar-upload-fallback`} aria-hidden="true">
          {fallback}
        </span>
      )}
      <div className="avatar-upload-actions">
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Enviando..." : photoUrl ? "Trocar" : emptyLabel}
        </button>
        {photoUrl && (
          <button type="button" className="btn-ghost btn-sm" onClick={handleRemove} disabled={uploading}>
            Remover
          </button>
        )}
        {hint && <span className="avatar-upload-hint">{hint}</span>}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={handleChange}
      />
    </div>
  );
}
