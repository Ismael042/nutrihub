"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unit_price_cents: number;
}

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function EstoquePage() {
  const professional = useRequireAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("unidade");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sellQuantity, setSellQuantity] = useState<Record<string, string>>({});

  async function load() {
    const res = await authFetch("/inventory-items");
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => {
    if (professional) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const priceCents = Math.round(parseFloat(price.replace(",", ".") || "0") * 100);
    if (!name.trim()) {
      setError("Informe o nome do produto");
      return;
    }
    const res = await authFetch("/inventory-items", {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        unit,
        quantity: parseFloat(quantity || "0"),
        unit_price_cents: priceCents
      })
    });
    if (!res.ok) {
      setError("Não foi possível salvar");
      return;
    }
    setName("");
    setQuantity("");
    setPrice("");
    load();
  }

  async function sell(id: string) {
    const qty = parseFloat(sellQuantity[id] || "0");
    if (!qty || qty <= 0) return;
    const res = await authFetch(`/inventory-items/${id}/sell`, {
      method: "POST",
      body: JSON.stringify({ quantity: qty })
    });
    if (res.ok) {
      setSellQuantity({ ...sellQuantity, [id]: "" });
      load();
    } else {
      const data = await res.json();
      alert(data.detail ?? "Não foi possível registrar a venda");
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir este produto do estoque?")) return;
    const res = await authFetch(`/inventory-items/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  if (!professional) return null;

  return (
    <main className="page-container">
      <a href="/financeiro" className="back-link">← Financeiro</a>
      <h1>Estoque de produtos</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        Suplementos e outros produtos vendidos no consultório. Vender um item registra automaticamente uma entrada no
        Financeiro.
      </p>

      <details style={{ marginTop: 16 }}>
        <summary>+ Novo produto</summary>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <input placeholder="Nome (ex: Whey Protein 900g)" value={name} onChange={(e) => setName(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="Unidade (ex: unidade, kg)" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ flex: 1 }} />
            <input placeholder="Quantidade em estoque" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={{ flex: 1 }} />
            <input placeholder="Preço unitário (ex: 150.00)" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} style={{ flex: 1 }} />
          </div>
          {error && <p style={{ color: "crimson" }}>{error}</p>}
          <button type="submit" className="btn-primary" style={{ padding: 10 }}>Salvar produto</button>
        </form>
      </details>

      <div className="card-grid" style={{ marginTop: 20 }}>
        {items.map((item) => (
          <div key={item.id} className="card">
            <h3 style={{ margin: 0, fontSize: 15 }}>{item.name}</h3>
            <p style={{ margin: "8px 0", fontSize: 14, color: "#666" }}>
              {item.quantity} {item.unit} em estoque · {formatMoney(item.unit_price_cents)} / {item.unit}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                placeholder="Qtd. vendida"
                inputMode="decimal"
                value={sellQuantity[item.id] ?? ""}
                onChange={(e) => setSellQuantity({ ...sellQuantity, [item.id]: e.target.value })}
                style={{ flex: 1 }}
              />
              <button onClick={() => sell(item.id)} className="btn-primary">Vender</button>
            </div>
            <button onClick={() => remove(item.id)} style={{ color: "crimson", marginTop: 8 }}>Excluir produto</button>
          </div>
        ))}
      </div>
      {items.length === 0 && <p style={{ marginTop: 12 }}>Nenhum produto cadastrado ainda.</p>}
    </main>
  );
}
