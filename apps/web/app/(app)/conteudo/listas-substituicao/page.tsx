"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import type { SubstitutionItem, SubstitutionList } from "@nutrihub/shared";
import EmptyState from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { IconRepeat } from "@/components/icons";

const CATEGORY_LABELS: Record<string, string> = {
  fibra: "Fibras",
  hipercalorico: "Hipercalórico",
  carboidratos: "Carboidratos",
  proteinas: "Proteínas"
};

function categoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1);
}

const EMPTY_ITEM: SubstitutionItem = { name: "", portion: "" };

export default function ListasSubstituicaoPage() {
  const professional = useRequireAuth();
  const [lists, setLists] = useState<SubstitutionList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [items, setItems] = useState<SubstitutionItem[]>([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editItems, setEditItems] = useState<SubstitutionItem[]>([]);

  async function load() {
    setLoading(true);
    try {
      const res = await authFetch("/substitution-lists");
      if (res.ok) setLists(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (professional) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional]);

  if (!professional) return null;

  function updateItem(list: SubstitutionItem[], setList: (v: SubstitutionItem[]) => void, index: number, field: keyof SubstitutionItem, value: string) {
    setList(list.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanItems = items.filter((i) => i.name.trim() && i.portion.trim());
    if (!category.trim() || !name.trim() || cleanItems.length === 0) {
      setError("Preencha categoria, nome e ao menos um item com porção.");
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch("/substitution-lists", {
        method: "POST",
        body: JSON.stringify({ category: category.trim(), name: name.trim(), items: cleanItems })
      });
      if (!res.ok) throw new Error("Não foi possível salvar a lista");
      setCategory("");
      setName("");
      setItems([{ ...EMPTY_ITEM }]);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(list: SubstitutionList) {
    setEditingId(list.id);
    setEditName(list.name);
    setEditItems(list.items.length ? list.items : [{ ...EMPTY_ITEM }]);
  }

  async function saveEdit(id: string) {
    const cleanItems = editItems.filter((i) => i.name.trim() && i.portion.trim());
    const res = await authFetch(`/substitution-lists/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: editName, items: cleanItems })
    });
    if (res.ok) {
      setEditingId(null);
      load();
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta lista?")) return;
    const res = await authFetch(`/substitution-lists/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  const categories = Array.from(new Set(lists.map((l) => l.category)));

  return (
    <main className="page-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <h1>Listas de substituição</h1>
      <p style={{ color: "#666" }}>Modelos prontos do sistema + suas próprias listas.</p>

      <details style={{ marginTop: 16 }}>
        <summary>+ Criar lista de substituição</summary>
        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <input placeholder="Categoria (ex: fibra, proteinas)" value={category} onChange={(e) => setCategory(e.target.value)} />
          <input placeholder="Nome da lista" value={name} onChange={(e) => setName(e.target.value)} />
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 8 }}>
              <input
                placeholder="Alimento"
                value={item.name}
                onChange={(e) => updateItem(items, setItems, i, "name", e.target.value)}
                style={{ flex: 2 }}
              />
              <input
                placeholder="Porção (ex: 1 unidade média)"
                value={item.portion}
                onChange={(e) => updateItem(items, setItems, i, "portion", e.target.value)}
                style={{ flex: 2 }}
              />
            </div>
          ))}
          <button type="button" onClick={() => setItems([...items, { ...EMPTY_ITEM }])}>
            + Adicionar item
          </button>
          {error && <p style={{ color: "crimson" }}>{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary" style={{ padding: 10 }}>
            {saving ? "Salvando..." : "Salvar lista"}
          </button>
        </form>
      </details>

      {loading && (
        <div style={{ marginTop: 20 }}>
          <SkeletonRows count={4} />
        </div>
      )}

      {!loading &&
        categories.map((cat) => (
          <section key={cat} style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-accent)" }}>
              {categoryLabel(cat)}
            </h2>

            <div className="card-grid">
              {lists
                .filter((l) => l.category === cat)
                .map((list) => (
                  <div key={list.id} className="card">
                    {editingId === list.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        {editItems.map((item, i) => (
                          <div key={i} style={{ display: "flex", gap: 8 }}>
                            <input
                              value={item.name}
                              onChange={(e) => updateItem(editItems, setEditItems, i, "name", e.target.value)}
                              style={{ flex: 2 }}
                            />
                            <input
                              value={item.portion}
                              onChange={(e) => updateItem(editItems, setEditItems, i, "portion", e.target.value)}
                              style={{ flex: 2 }}
                            />
                          </div>
                        ))}
                        <button type="button" onClick={() => setEditItems([...editItems, { ...EMPTY_ITEM }])}>
                          + Item
                        </button>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn-primary" onClick={() => saveEdit(list.id)}>Salvar</button>
                          <button onClick={() => setEditingId(null)}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <h3 style={{ margin: 0, textTransform: "none", letterSpacing: 0, color: "var(--color-dark)", fontSize: 15 }}>
                            {list.name}
                          </h3>
                          {list.tenant_id === null && <span className="badge">Modelo padrão</span>}
                        </div>
                        <ul style={{ marginTop: 12 }}>
                          {list.items.map((item, i) => (
                            <li
                              key={i}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 8,
                                fontSize: 14,
                                padding: "6px 0",
                                borderBottom: i < list.items.length - 1 ? "1px solid var(--color-border)" : "none"
                              }}
                            >
                              <span>{item.name}</span>
                              <span style={{ color: "var(--color-muted)", whiteSpace: "nowrap" }}>{item.portion}</span>
                            </li>
                          ))}
                        </ul>
                        {list.tenant_id !== null && (
                          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                            <button onClick={() => startEdit(list)}>Editar</button>
                            <button onClick={() => remove(list.id)} style={{ color: "crimson" }}>Excluir</button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
            </div>
          </section>
        ))}

      {!loading && lists.length === 0 && (
        <EmptyState
          icon={<IconRepeat />}
          title="Nenhuma lista de substituição"
          description="Crie sua própria lista acima — os modelos padrão do sistema aparecem aqui também."
        />
      )}
    </main>
  );
}
