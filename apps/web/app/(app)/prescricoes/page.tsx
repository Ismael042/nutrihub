"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import type { Prescription, PrescriptionItem } from "@nutrihub/shared";
import { useConfirm } from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { IconPill } from "@/components/icons";

interface Patient {
  id: string;
  name: string;
}

const EMPTY_ITEM: PrescriptionItem = { description: "", dosage: null, frequency: null, duration: null };

export default function PrescricoesPage() {
  const professional = useRequireAuth();
  const confirm = useConfirm();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientId, setPatientId] = useState("");
  const [kind, setKind] = useState<"supplement" | "phytotherapic">("supplement");
  const [items, setItems] = useState<PrescriptionItem[]>([{ ...EMPTY_ITEM }]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [patientsRes, listRes] = await Promise.all([
        authFetch("/patients?status=all"),
        authFetch("/prescriptions")
      ]);
      if (patientsRes.ok) setPatients(await patientsRes.json());
      if (listRes.ok) setPrescriptions(await listRes.json());
    } finally {
      setLoading(false);
    }
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
    if (!(await confirm({ title: "Excluir esta prescrição?", danger: true, confirmLabel: "Excluir" }))) return;
    await authFetch(`/prescriptions/${id}`, { method: "DELETE" });
    load();
  }

  if (!professional) return null;

  return (
    <div className="page-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <h1>Prescrições</h1>

      <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
        <div className="field-row">
          <div className="field">
            <label className="field-label field-required" htmlFor="rx-patient">
              Paciente
            </label>
            <select id="rx-patient" value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
              <option value="">Selecione o paciente...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field field-md">
            <label className="field-label" htmlFor="rx-kind">
              Tipo
            </label>
            <select id="rx-kind" value={kind} onChange={(e) => setKind(e.target.value as "supplement" | "phytotherapic")}>
              <option value="supplement">Suplemento</option>
              <option value="phytotherapic">Fitoterápico</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((item, i) => (
            <div key={i} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 10 }}>
              <div className="field">
                <label className="field-label" htmlFor={`rx-desc-${i}`}>
                  Descrição
                </label>
                <input
                  id={`rx-desc-${i}`}
                  placeholder="ex: Whey protein isolado"
                  value={item.description}
                  onChange={(e) => updateItem(i, "description", e.target.value)}
                />
              </div>
              <div className="field-row" style={{ marginBottom: items.length > 1 ? "var(--space-2)" : 0 }}>
                <div className="field">
                  <label className="field-label" htmlFor={`rx-dosage-${i}`}>
                    Dosagem
                  </label>
                  <input
                    id={`rx-dosage-${i}`}
                    placeholder="ex: 30g"
                    value={item.dosage ?? ""}
                    onChange={(e) => updateItem(i, "dosage", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor={`rx-freq-${i}`}>
                    Frequência
                  </label>
                  <input
                    id={`rx-freq-${i}`}
                    placeholder="ex: 2x ao dia"
                    value={item.frequency ?? ""}
                    onChange={(e) => updateItem(i, "frequency", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor={`rx-duration-${i}`}>
                    Duração
                  </label>
                  <input
                    id={`rx-duration-${i}`}
                    placeholder="ex: 30 dias"
                    value={item.duration ?? ""}
                    onChange={(e) => updateItem(i, "duration", e.target.value)}
                  />
                </div>
              </div>
              {items.length > 1 && (
                <button type="button" onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="btn-sm">
                  Remover item
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setItems([...items, { ...EMPTY_ITEM }])}>
            + Adicionar item
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ margin: "var(--space-4) 0" }}>
            <p>{error}</p>
          </div>
        )}
        <button type="submit" className="btn-primary">
          Adicionar prescrição
        </button>
      </form>

      {loading && (
        <div style={{ marginTop: 20 }}>
          <SkeletonRows count={3} />
        </div>
      )}

      {!loading && prescriptions.length === 0 && (
        <EmptyState icon={<IconPill />} title="Nenhuma prescrição cadastrada" description="Prescreva suplementos ou fitoterápicos para um paciente acima." />
      )}

      {!loading && prescriptions.length > 0 && (
        <div className="card-grid">
          {prescriptions.map((p) => (
            <article key={p.id} className="card card-static">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                <strong>{p.patient_name}</strong>
                <button onClick={() => remove(p.id)} style={{ color: "var(--color-error)", flexShrink: 0 }}>
                  Excluir
                </button>
              </div>
              <p style={{ margin: "6px 0 0" }}>
                <span className="badge badge-neutral">{p.kind === "supplement" ? "Suplemento" : "Fitoterápico"}</span>
              </p>
              <ul style={{ marginTop: 10 }}>
                {p.items.map((item, i) => (
                  <li key={i} style={{ fontSize: 14 }}>
                    {item.description}
                    {[item.dosage, item.frequency, item.duration].filter(Boolean).length > 0 &&
                      ` — ${[item.dosage, item.frequency, item.duration].filter(Boolean).join(", ")}`}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
