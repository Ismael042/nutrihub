"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";

interface Recipe {
  id: string;
  name: string;
  instructions: string | null;
}

export default function ReceitasPage() {
  const professional = useRequireAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");

  async function load() {
    const res = await authFetch("/recipes");
    if (res.ok) setRecipes(await res.json());
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
    if (!confirm("Excluir esta receita?")) return;
    await authFetch(`/recipes/${id}`, { method: "DELETE" });
    load();
  }

  if (!professional) return null;

  return (
    <main className="page-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <h1>Receitas</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        <input placeholder="Nome da receita" value={name} onChange={(e) => setName(e.target.value)} required />
        <textarea
          placeholder="Modo de preparo"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
        />
        <button type="submit" style={{ padding: 10 }}>
          Salvar receita
        </button>
      </form>

      <ul style={{ listStyle: "none", padding: 0, marginTop: 20 }}>
        {recipes.map((r) => (
          <li key={r.id} style={{ padding: "10px 0", borderBottom: "1px solid #eee" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{r.name}</strong>
              <button onClick={() => remove(r.id)} style={{ color: "crimson" }}>
                Excluir
              </button>
            </div>
            {r.instructions && <div style={{ color: "#666" }}>{r.instructions}</div>}
          </li>
        ))}
      </ul>
      {recipes.length === 0 && <p>Nenhuma receita cadastrada.</p>}
    </main>
  );
}
