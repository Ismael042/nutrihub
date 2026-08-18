"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import { formatMoney } from "@nutrihub/shared";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import { IconStore } from "@/components/icons";

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unit_price_cents: number;
}

export default function EstoquePage() {
  const professional = useRequireAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("unidade");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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
    setSaving(true);
    try {
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
      toast.success("Produto cadastrado.");
      load();
    } finally {
      setSaving(false);
    }
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
      toast.success("Venda registrada e lançada no Financeiro.");
      load();
    } else {
      const data = await res.json();
      toast.error(data.detail ?? "Não foi possível registrar a venda");
    }
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Excluir este produto do estoque?", danger: true, confirmLabel: "Excluir" }))) return;
    const res = await authFetch(`/inventory-items/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Produto excluído.");
      load();
    }
  }

  if (!professional) return null;

  return (
    <div className="content-stack">
      <a href="/financeiro" className="back-link">← Financeiro</a>
      <h1>Estoque de produtos</h1>
      <p className="page-subtitle">
        Suplementos e outros produtos vendidos no consultório. Vender um item registra automaticamente uma entrada no
        Financeiro.
      </p>

      <details className="card" style={{ marginBottom: "var(--space-5)" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>+ Novo produto</summary>
        <form onSubmit={handleSubmit} className="form-narrow" style={{ marginTop: "var(--space-4)" }}>
          <div className="field">
            <label className="field-label field-required" htmlFor="name">
              Nome
            </label>
            <input id="name" placeholder="Ex: Whey Protein 900g" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="unit">
                Unidade
              </label>
              <input id="unit" placeholder="unidade, kg..." value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="quantity">
                Quantidade em estoque
              </label>
              <input id="quantity" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="price">
                Preço unitário
              </label>
              <input id="price" placeholder="150.00" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: "var(--space-4)" }}>
              <p>{error}</p>
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Salvando..." : "Salvar produto"}
          </button>
        </form>
      </details>

      {items.length === 0 ? (
        <EmptyState icon={<IconStore />} title="Nenhum produto cadastrado" description="Cadastre suplementos e outros itens que você vende no consultório." />
      ) : (
        <div className="card-grid">
          {items.map((item) => (
            <div key={item.id} className="card">
              <h3 style={{ textTransform: "none", letterSpacing: 0, color: "var(--color-text-primary)", fontSize: 15 }}>
                {item.name}
              </h3>
              <p style={{ margin: "6px 0 12px", fontSize: 14, color: "var(--color-text-muted)" }}>
                {item.quantity} {item.unit} em estoque · {formatMoney(item.unit_price_cents)} / {item.unit}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  placeholder="Qtd. vendida"
                  inputMode="decimal"
                  value={sellQuantity[item.id] ?? ""}
                  onChange={(e) => setSellQuantity({ ...sellQuantity, [item.id]: e.target.value })}
                />
                <button onClick={() => sell(item.id)} className="btn-primary" style={{ flexShrink: 0 }}>
                  Vender
                </button>
              </div>
              <button onClick={() => remove(item.id)} className="btn-ghost btn-sm" style={{ marginTop: 10, color: "var(--color-error)" }}>
                Excluir produto
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
