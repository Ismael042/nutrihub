"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import { useConfirm } from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { IconBook } from "@/components/icons";
import PhotoUpload from "@/components/PhotoUpload";

interface Recipe {
  id: string;
  name: string;
  instructions: string | null;
  photo_url: string | null;
}

export default function ReceitasPage() {
  const professional = useRequireAuth();
  const confirm = useConfirm();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await authFetch("/recipes");
      if (res.ok) setRecipes(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (professional) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await authFetch("/recipes", {
      method: "POST",
      body: JSON.stringify({ name, instructions: instructions || null })
    });
    if (res.ok) {
      setName("");
      setInstructions("");
      load();
    }
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Excluir esta receita?", danger: true, confirmLabel: "Excluir" }))) return;
    await authFetch(`/recipes/${id}`, { method: "DELETE" });
    load();
  }

  if (!professional) return null;

  return (
    <div className="page-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <h1>Receitas</h1>

      <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
        <div className="field">
          <label className="field-label field-required" htmlFor="recipe-name">
            Nome da receita
          </label>
          <input id="recipe-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="recipe-instructions">
            Modo de preparo
          </label>
          <textarea
            id="recipe-instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
          />
        </div>
        <button type="submit" className="btn-primary">
          Salvar receita
        </button>
      </form>

      {loading && (
        <div style={{ marginTop: 20 }}>
          <SkeletonRows count={3} />
        </div>
      )}

      {!loading && recipes.length === 0 && (
        <EmptyState icon={<IconBook />} title="Nenhuma receita cadastrada" description="Cadastre sua primeira receita acima." />
      )}

      {!loading && recipes.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 20 }}>
          {recipes.map((r) => (
            <li key={r.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--color-border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{r.name}</strong>
                <button onClick={() => remove(r.id)} style={{ color: "var(--color-error)" }}>
                  Excluir
                </button>
              </div>
              {r.instructions && <div style={{ color: "var(--color-text-muted)" }}>{r.instructions}</div>}
              {/* Upload por item: não existe página de detalhe de receita, e a chave do
                  objeto usa o id — então a receita precisa existir antes da foto. */}
              <div style={{ marginTop: 8 }}>
                <PhotoUpload
                  endpoint={`/recipes/${r.id}/photo`}
                  photoUrl={r.photo_url}
                  onChange={(data) =>
                    setRecipes((prev) => prev.map((x) => (x.id === r.id ? (data as unknown as Recipe) : x)))
                  }
                  fallback="Sem foto"
                  emptyLabel="Enviar foto"
                  hint=""
                  alt={`Foto de ${r.name}`}
                  shape="rect"
                  confirmTitle="Remover a foto da receita?"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
