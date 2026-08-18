"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import { useConfirm } from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { IconTag } from "@/components/icons";

interface Tag {
  id: string;
  name: string;
}

export default function TagsPage() {
  const professional = useRequireAuth();
  const confirm = useConfirm();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await authFetch("/tags");
      if (res.ok) setTags(await res.json());
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
    const res = await authFetch("/tags", { method: "POST", body: JSON.stringify({ name }) });
    if (res.ok) {
      setName("");
      load();
    }
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Excluir esta tag?", danger: true, confirmLabel: "Excluir" }))) return;
    await authFetch(`/tags/${id}`, { method: "DELETE" });
    load();
  }

  if (!professional) return null;

  return (
    <div className="page-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <h1>Tags</h1>
      <p style={{ color: "var(--color-text-muted)" }}>Use tags para organizar pacientes (ex: gestante, atleta, diabético).</p>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input placeholder="Nova tag" value={name} onChange={(e) => setName(e.target.value)} required style={{ flex: 1 }} />
        <button type="submit" className="btn-primary">
          Adicionar
        </button>
      </form>

      {loading && (
        <div style={{ marginTop: 16 }}>
          <SkeletonRows count={3} />
        </div>
      )}

      {!loading && tags.length === 0 && (
        <EmptyState icon={<IconTag />} title="Nenhuma tag cadastrada" description="Crie tags acima para organizar seus pacientes." />
      )}

      {!loading && tags.length > 0 && (
        <ul className="chip-list" style={{ listStyle: "none", padding: 0 }}>
          {tags.map((t) => (
            <li key={t.id}>
              <span className="badge badge-accent" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {t.name}
                <button
                  onClick={() => remove(t.id)}
                  aria-label={`Excluir tag ${t.name}`}
                  style={{ border: "none", background: "none", cursor: "pointer", padding: 0, lineHeight: 1, minWidth: 0 }}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
