"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import type { Prescription, PrescriptionItem } from "@nutrihub/shared";

interface Patient {
  id: string;
  name: string;
}

const EMPTY_ITEM: PrescriptionItem = { description: "", dosage: null, frequency: null, duration: null };

export default function PrescricoesPage() {
  const professional = useRequireAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [patientId, setPatientId] = useState("");
  const [kind, setKind] = useState<"supplement" | "phytotherapic">("supplement");
  const [items, setItems] = useState<PrescriptionItem[]>([{ ...EMPTY_ITEM }]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [patientsRes, listRes] = await Promise.all([
      authFetch("/patients?status=all"),
      authFetch("/prescriptions")
    ]);
    if (patientsRes.ok) setPatients(await patientsRes.json());
    if (listRes.ok) setPrescriptions(await listRes.json());
  }

  useEffect(() => {
    if (professional) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional]);

  function updateItem(index: number, field: keyof PrescriptionItem, value: string) {
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: value || null } : item)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!patientId) {
      setError("Selecione um paciente");
      return;
    }
    const cleanItems = items.filter((i) => i.description.trim());
    if (cleanItems.length === 0) {
      setError("Adicione ao menos um item com descrição");
      return;
    }
    const res = await authFetch("/prescriptions", {
      method: "POST",
      body: JSON.stringify({ patient_id: patientId, kind, items: cleanItems })
    });
    if (!res.ok) {
      setError("Não foi possível salvar");
      return;
    }
    setItems([{ ...EMPTY_ITEM }]);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta prescrição?")) return;
    await authFetch(`/prescriptions/${id}`, { method: "DELETE" });
    load();
  }

  if (!professional) return null;

  return (
    <main className="page-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <h1>Prescrições</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        <select value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
          <option value="">Selecione o paciente...</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value as "supplement" | "phytotherapic")}>
          <option value="supplement">Suplemento</option>
          <option value="phytotherapic">Fitoterápico</option>
        </select>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, border: "1px solid var(--color-border)", borderRadius: 8, padding: 10 }}>
              <input
                placeholder="Descrição (ex: Whey protein isolado)"
                value={item.description}
                onChange={(e) => updateItem(i, "description", e.target.value)}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  placeholder="Dosagem (ex: 30g)"
                  value={item.dosage ?? ""}
                  onChange={(e) => updateItem(i, "dosage", e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  placeholder="Frequência (ex: 2x ao dia)"
                  value={item.frequency ?? ""}
                  onChange={(e) => updateItem(i, "frequency", e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  placeholder="Duração (ex: 30 dias)"
                  value={item.duration ?? ""}
                  onChange={(e) => updateItem(i, "duration", e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
              {items.length > 1 && (
                <button type="button" onClick={() => setItems(items.filter((_, idx) => idx !== i))} style={{ alignSelf: "flex-start" }}>
                  Remover item
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setItems([...items, { ...EMPTY_ITEM }])}>
            + Adicionar item
          </button>
        </div>

        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" className="btn-primary" style={{ padding: 10 }}>
          Adicionar prescrição
        </button>
      </form>

      <ul style={{ listStyle: "none", padding: 0, marginTop: 20 }}>
        {prescriptions.map((p) => (
          <li key={p.id} style={{ padding: "10px 0", borderBottom: "1px solid #eee" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{p.patient_name}</strong>
              <button onClick={() => remove(p.id)} style={{ color: "crimson" }}>
                Excluir
              </button>
            </div>
            <div style={{ color: "#666" }}>{p.kind === "supplement" ? "Suplemento" : "Fitoterápico"}</div>
            <ul style={{ marginTop: 6 }}>
              {p.items.map((item, i) => (
                <li key={i} style={{ fontSize: 14 }}>
                  {item.description}
                  {[item.dosage, item.frequency, item.duration].filter(Boolean).length > 0 &&
                    ` — ${[item.dosage, item.frequency, item.duration].filter(Boolean).join(", ")}`}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {prescriptions.length === 0 && <p>Nenhuma prescrição cadastrada.</p>}
    </main>
  );
}
