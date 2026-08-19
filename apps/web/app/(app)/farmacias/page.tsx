"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import { formatPhone } from "@/lib/masks";
import { useConfirm } from "@/components/ConfirmDialog";
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
  const confirm = useConfirm();
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
    if (!(await confirm({ title: "Excluir esta farmácia?", danger: true, confirmLabel: "Excluir" }))) return;
    await authFetch(`/pharmacies/${id}`, { method: "DELETE" });
    load();
  }

  if (!professional) return null;

  return (
    <div className="page-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <h1>Farmácias (orçamento)</h1>

      <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
        <div className="field">
          <label className="field-label field-required" htmlFor="pharmacy-name">
            Nome
          </label>
          <input id="pharmacy-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field-row">
          <div className="field field-md">
            <label className="field-label" htmlFor="pharmacy-phone">
              Telefone
            </label>
            <input
              id="pharmacy-phone"
              type="tel"
              autoComplete="tel"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="pharmacy-notes">
              Observações
            </label>
            <input id="pharmacy-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <button type="submit" className="btn-primary">
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
        <div className="table-wrap table-responsive-cards" style={{ marginTop: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telefone</th>
                <th>Observações</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pharmacies.map((f) => (
                <tr key={f.id}>
                  <td data-label="Nome">
                    <strong>{f.name}</strong>
                  </td>
                  <td data-label="Telefone">{f.phone || "—"}</td>
                  <td data-label="Observações">{f.notes || "—"}</td>
                  <td className="table-actions" data-label="Ações">
                    <button onClick={() => remove(f.id)} style={{ color: "var(--color-error)" }}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
