"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import EmptyState from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { IconApple } from "@/components/icons";

interface Food {
  id: string;
  source: string;
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

const SOURCE_LABEL: Record<string, string> = {
  taco: "Taco",
  ibge: "IBGE",
  usda: "USDA",
  tbca: "TBCA",
  tucunduva: "Tucunduva",
  supplement: "Suplemento",
  custom: "Meu"
};

export default function AlimentosPage() {
  const professional = useRequireAuth();
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  async function load(q: string, signal: AbortSignal) {
    setLoading(true);
    try {
      const res = await authFetch(`/foods${q ? `?search=${encodeURIComponent(q)}` : ""}`, { signal });
      if (res.ok) setFoods(await res.json());
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") throw err;
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    if (!professional) return;
    const controller = new AbortController();
    const debounce = setTimeout(() => load(search, controller.signal), 250);
    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional, search]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await authFetch("/foods", {
      method: "POST",
      body: JSON.stringify({
        name,
        kcal: parseFloat(kcal || "0"),
        protein_g: parseFloat(protein || "0"),
        carbs_g: parseFloat(carbs || "0"),
        fat_g: parseFloat(fat || "0")
      })
    });
    if (res.ok) {
      setName("");
      setKcal("");
      setProtein("");
      setCarbs("");
      setFat("");
      load(search, new AbortController().signal);
    }
  }

  if (!professional) return null;

  return (
    <div className="page-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <h1>Alimentos</h1>
      <p style={{ color: "var(--color-text-muted)" }}>
        Base compartilhada (~90 alimentos comuns, referência TACO — não é a tabela oficial completa)
        + seus alimentos próprios. Valores por 100g.
      </p>

      <input
        type="search"
        placeholder="Buscar alimento..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ maxWidth: 360, marginTop: 12 }}
      />

      <details style={{ marginTop: 16 }}>
        <summary>+ Cadastrar alimento próprio</summary>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}
        >
          <input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
          {/* grid 2x2 em vez de 4 numa linha só — 4 inputs num flex sem wrap não
              cabem em 320-375px (cada um ficaria com ~60-70px, ilegível). */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            <input placeholder="Kcal" value={kcal} onChange={(e) => setKcal(e.target.value)} />
            <input placeholder="Proteína (g)" value={protein} onChange={(e) => setProtein(e.target.value)} />
            <input placeholder="Carbo (g)" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
            <input placeholder="Gordura (g)" value={fat} onChange={(e) => setFat(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary">
            Salvar alimento
          </button>
        </form>
      </details>

      {loading && foods.length === 0 && (
        <div style={{ marginTop: 20 }}>
          <SkeletonRows count={5} />
        </div>
      )}

      {!loading && foods.length === 0 && (
        <EmptyState
          icon={<IconApple />}
          title="Nenhum alimento encontrado"
          description="Ajuste sua busca ou cadastre um alimento próprio acima."
        />
      )}

      {foods.length > 0 && (
        <div className="table-wrap table-responsive-cards" style={{ marginTop: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Fonte</th>
                <th>Kcal</th>
                <th>Prot</th>
                <th>Carbo</th>
                <th>Gord</th>
              </tr>
            </thead>
            <tbody>
              {foods.map((f) => (
                <tr key={f.id}>
                  <td data-label="Nome">{f.name}</td>
                  <td data-label="Fonte" style={{ color: "var(--color-text-muted)" }}>
                    {SOURCE_LABEL[f.source] ?? f.source}
                  </td>
                  <td className="table-num" data-label="Kcal">{f.kcal}</td>
                  <td className="table-num" data-label="Prot">{f.protein_g}</td>
                  <td className="table-num" data-label="Carbo">{f.carbs_g}</td>
                  <td className="table-num" data-label="Gord">{f.fat_g}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
