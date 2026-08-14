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

  async function load(q: string) {
    setLoading(true);
    try {
      const res = await authFetch(`/foods${q ? `?search=${encodeURIComponent(q)}` : ""}`);
      if (res.ok) setFoods(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!professional) return;
    const debounce = setTimeout(() => load(search), 250);
    return () => clearTimeout(debounce);
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
      load(search);
    }
  }

  if (!professional) return null;

  return (
    <main className="page-container">
      <h1>Alimentos</h1>
      <p style={{ color: "#666" }}>
        Base compartilhada (~90 alimentos comuns, referência TACO — não é a tabela oficial completa)
        + seus alimentos próprios. Valores por 100g.
      </p>

      <input
        placeholder="Buscar alimento..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", marginTop: 12 }}
      />

      <details style={{ marginTop: 16 }}>
        <summary>+ Cadastrar alimento próprio</summary>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="Kcal" value={kcal} onChange={(e) => setKcal(e.target.value)} style={{ flex: 1 }} />
            <input placeholder="Proteína (g)" value={protein} onChange={(e) => setProtein(e.target.value)} style={{ flex: 1 }} />
            <input placeholder="Carbo (g)" value={carbs} onChange={(e) => setCarbs(e.target.value)} style={{ flex: 1 }} />
            <input placeholder="Gordura (g)" value={fat} onChange={(e) => setFat(e.target.value)} style={{ flex: 1 }} />
          </div>
          <button type="submit" style={{ padding: 10 }}>
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
        <table style={{ width: "100%", marginTop: 20, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
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
              <tr key={f.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{f.name}</td>
                <td style={{ color: "#666" }}>{SOURCE_LABEL[f.source] ?? f.source}</td>
                <td>{f.kcal}</td>
                <td>{f.protein_g}</td>
                <td>{f.carbs_g}</td>
                <td>{f.fat_g}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
