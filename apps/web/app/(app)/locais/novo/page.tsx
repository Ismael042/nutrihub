"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authFetch, useRequireAuth } from "@/lib/auth";

function NovoLocalForm() {
  const professional = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/locais";
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"in_person" | "video">("in_person");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!professional) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authFetch("/locations", {
        method: "POST",
        body: JSON.stringify({ name, kind, address: address || null })
      });
      if (!res.ok) throw new Error("Não foi possível cadastrar o local");
      router.push(returnTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="form-container">
      <a href={returnTo} className="back-link">← Voltar</a>
      <h1>Novo local de atendimento</h1>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label className="field-label field-required" htmlFor="local-name">
            Nome
          </label>
          <input
            id="local-name"
            placeholder="ex: Consultório Centro"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="local-kind">
            Tipo
          </label>
          <select id="local-kind" value={kind} onChange={(e) => setKind(e.target.value as "in_person" | "video")}>
            <option value="in_person">Presencial</option>
            <option value="video">Videoconferência</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="local-address">
            Endereço
          </label>
          <input id="local-address" placeholder="Opcional" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        {error && (
          <div className="alert alert-error" style={{ marginBottom: "var(--space-4)" }}>
            <p>{error}</p>
          </div>
        )}
        <button type="submit" disabled={loading} className="btn-primary btn-block">
          {loading ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </main>
  );
}

export default function NovoLocalPage() {
  return (
    <Suspense fallback={null}>
      <NovoLocalForm />
    </Suspense>
  );
}
