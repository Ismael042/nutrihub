"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import EmptyState from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { IconStore } from "@/components/icons";

interface Pharmacy {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
}

export default function FarmaciasPage() {
  const professional = useRequireAuth();
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await authFetch("/pharmacies");
      if (res.ok) setPharmacies(await res.json());
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
    const res = await authFetch("/pharmacies", {
      method: "POST",
      body: JSON.stringify({ name, phone: phone || null, notes: notes || null })
    });
    if (res.ok) {
      setName("");
      setPhone("");
      setNotes("");
      load();
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta farmácia?")) return;
    await authFetch(`/pharmacies/${id}`, { method: "DELETE" });
    load();
  }

  if (!professional) return null;

  return (
    <main className="page-container">
      <h1>Farmácias (orçamento)</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        <input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input placeholder="Observações" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button type="submit" style={{ padding: 10 }}>
          Adicionar farmácia
        </button>
      </form>

      {loading && (
        <div style={{ marginTop: 20 }}>
          <SkeletonRows count={3} />
        </div>
      )}

      {!loading && pharmacies.length === 0 && (
        <EmptyState icon={<IconStore />} title="Nenhuma farmácia cadastrada" description="Cadastre uma farmácia parceira acima para orçamentos." />
      )}

      {!loading && pharmacies.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 20 }}>
          {pharmacies.map((f) => (
            <li key={f.id} style={{ padding: "10px 0", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
              <div>
                <strong>{f.name}</strong>
                {f.phone && <span style={{ color: "#666" }}> · {f.phone}</span>}
                {f.notes && <span style={{ color: "#666" }}> · {f.notes}</span>}
              </div>
              <button onClick={() => remove(f.id)} style={{ color: "crimson" }}>
                Excluir
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
