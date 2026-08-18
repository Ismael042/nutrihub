"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { authFetch, useRequireAuth } from "@/lib/auth";
import { formatDate, type AnthropometricMeasurement, type Patient } from "@nutrihub/shared";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

const KIND_LABEL: Record<string, string> = { front: "Frente", side: "Lado", back: "Costas" };
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

const FIELDS: { key: keyof AnthropometricMeasurement; label: string; unit: string }[] = [
  { key: "weight_kg", label: "Peso", unit: "kg" },
  { key: "height_cm", label: "Altura", unit: "cm" },
  { key: "body_fat_pct", label: "% Gordura corporal", unit: "%" },
  { key: "waist_cm", label: "Circunf. cintura", unit: "cm" },
  { key: "hip_cm", label: "Circunf. quadril", unit: "cm" },
  { key: "neck_cm", label: "Circunf. pescoço", unit: "cm" }
];

function bmi(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm) return null;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

function bmiLabel(value: number): string {
  if (value < 18.5) return "Abaixo do peso";
  if (value < 25) return "Peso adequado";
  if (value < 30) return "Sobrepeso";
  if (value < 35) return "Obesidade grau I";
  if (value < 40) return "Obesidade grau II";
  return "Obesidade grau III";
}

function Sparkline({ points }: { points: { x: number; y: number }[] }) {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = 320;
  const height = 90;
  const pad = 10;
  const scaleX = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * (width - pad * 2);
  const scaleY = (y: number) => height - pad - ((y - minY) / (maxY - minY || 1)) * (height - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.x)} ${scaleY(p.y)}`).join(" ");

  return (
    <svg width={width} height={height} role="img" aria-label="Evolução do peso">
      <path d={path} fill="none" stroke="var(--color-primary, #0F9D74)" strokeWidth={2} />
      {points.map((p, i) => (
        <circle key={i} cx={scaleX(p.x)} cy={scaleY(p.y)} r={3} fill="var(--color-primary, #0F9D74)" />
      ))}
    </svg>
  );
}

export default function AntropometriaPage() {
  const professional = useRequireAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [measurements, setMeasurements] = useState<AnthropometricMeasurement[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Qual medição está recebendo foto agora — o input de arquivo é um só, reaproveitado
  // por linha da tabela em vez de um por medição.
  const [photoTarget, setPhotoTarget] = useState<{ id: string; kind: string } | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  function pickPhoto(measurementId: string, kind: string) {
    setPhotoTarget({ id: measurementId, kind });
    photoRef.current?.click();
  }

  async function handlePhotoSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const target = photoTarget;
    setPhotoTarget(null);
    if (!file || !target) return;

    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Imagem muito grande — envie um arquivo de até 3 MB.");
      return;
    }

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (target.kind) formData.append("kind", target.kind);
      const res = await authFetch(`/anthropometric-measurements/${target.id}/photos`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Não foi possível enviar a foto");
      toast.success("Foto adicionada.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function removePhoto(measurementId: string, photoId: string) {
    if (!(await confirm({ title: "Remover esta foto?", danger: true, confirmLabel: "Remover" }))) return;
    const res = await authFetch(`/anthropometric-measurements/${measurementId}/photos/${photoId}`, {
      method: "DELETE"
    });
    if (res.ok) load();
    else toast.error("Não foi possível remover a foto");
  }

  async function load() {
    const [patientRes, measurementsRes] = await Promise.all([
      authFetch(`/patients/${params.id}`),
      authFetch(`/anthropometric-measurements?patient_id=${params.id}`)
    ]);
    if (patientRes.ok) setPatient(await patientRes.json());
    if (measurementsRes.ok) setMeasurements(await measurementsRes.json());
  }

  useEffect(() => {
    if (professional) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional, params.id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { patient_id: params.id };
      if (form.measured_at) payload.measured_at = form.measured_at;
      for (const field of FIELDS) {
        if (form[field.key]) payload[field.key] = parseFloat(form[field.key]);
      }
      if (form.notes) payload.notes = form.notes;
      const res = await authFetch("/anthropometric-measurements", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Não foi possível salvar a medição");
      setForm({});
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Excluir esta medição?", danger: true, confirmLabel: "Excluir" }))) return;
    const res = await authFetch(`/anthropometric-measurements/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  if (!professional) return null;

  const weightPoints = measurements
    .filter((m) => m.weight_kg != null)
    .map((m, i) => ({ x: i, y: m.weight_kg as number }));

  const latestBmi = (() => {
    const last = [...measurements].reverse().find((m) => m.weight_kg && m.height_cm);
    return last ? bmi(last.weight_kg, last.height_cm) : null;
  })();

  return (
    <div className="page-container">
      <a href={`/pacientes/${params.id}`} className="back-link">← {patient?.name ?? "Paciente"}</a>
      <h1>Antropometria</h1>

      {latestBmi && (
        <p style={{ color: "var(--color-text-muted)" }}>
          IMC mais recente: <strong>{latestBmi.toFixed(1)}</strong> ({bmiLabel(latestBmi)})
        </p>
      )}

      {weightPoints.length >= 2 && (
        <div className="card card-static" style={{ marginTop: 12, display: "inline-block" }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--color-text-muted)" }}>Evolução do peso</p>
          <Sparkline points={weightPoints} />
        </div>
      )}

      <details style={{ marginTop: 20 }} open={measurements.length === 0}>
        <summary>+ Nova medição</summary>
        <form onSubmit={handleSubmit} style={{ marginTop: 8 }}>
          <div className="field field-sm">
            <label className="field-label" htmlFor="measurement-date">
              Data
            </label>
            <input
              id="measurement-date"
              type="date"
              value={form.measured_at ?? ""}
              onChange={(e) => setForm({ ...form, measured_at: e.target.value })}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--space-3)" }}>
            {FIELDS.map((field) => (
              <div className="field" key={field.key}>
                <label className="field-label" htmlFor={`measurement-${field.key}`}>
                  {field.label} ({field.unit})
                </label>
                <input
                  id={`measurement-${field.key}`}
                  inputMode="decimal"
                  value={form[field.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="measurement-notes">
              Observações
            </label>
            <input
              id="measurement-notes"
              placeholder="Opcional"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: "var(--space-4)" }}>
              <p>{error}</p>
            </div>
          )}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Salvando..." : "Salvar medição"}
          </button>
        </form>
      </details>

      {/* .table-wrap (e não a antiga .table-scroll, que nunca existiu no CSS) para
          esta tabela ganhar a mesma borda, cabeçalho e padding das demais. */}
      {measurements.length > 0 && (
      <div className="table-wrap" style={{ marginTop: 20 }}>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              {FIELDS.map((f) => (
                <th key={f.key}>{f.label}</th>
              ))}
              <th>IMC</th>
              {/* Coluna própria: não dá pra entrar no array FIELDS, que renderiza
                  as células com String(valor) e transformaria a lista em texto. */}
              <th>Fotos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {measurements.map((m) => {
              const measurementBmi = bmi(m.weight_kg, m.height_cm);
              return (
                <tr key={m.id}>
                  <td>{formatDate(m.measured_at)}</td>
                  {FIELDS.map((f) => (
                    <td className="table-num" key={f.key}>
                      {m[f.key] != null ? String(m[f.key]) : "—"}
                    </td>
                  ))}
                  <td className="table-num">{measurementBmi ? measurementBmi.toFixed(1) : "—"}</td>
                  <td>
                    <div className="photo-grid">
                      {(m.photos ?? []).map((photo) => (
                        <div className="photo-thumb" key={photo.id}>
                          {photo.url && (
                            <a href={photo.url} target="_blank" rel="noreferrer">
                              <img src={photo.url} alt={KIND_LABEL[photo.kind ?? ""] ?? "Foto de evolução"} />
                            </a>
                          )}
                          {photo.kind && <span className="photo-thumb-kind">{KIND_LABEL[photo.kind]}</span>}
                          <button
                            className="photo-thumb-remove"
                            onClick={() => removePhoto(m.id, photo.id)}
                            aria-label="Remover foto"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                      {(["front", "side", "back"] as const).map((kind) => (
                        <button
                          key={kind}
                          className="btn-sm"
                          disabled={uploadingPhoto}
                          onClick={() => pickPhoto(m.id, kind)}
                        >
                          + {KIND_LABEL[kind]}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="table-actions">
                    <button onClick={() => remove(m.id)} style={{ color: "var(--color-error)" }}>
                      Excluir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
      {/* Um input só, reaproveitado por todas as linhas — qual medição recebe a foto
          vem do photoTarget setado no clique. */}
      <input
        ref={photoRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={handlePhotoSelected}
      />
      {measurements.length === 0 && <p style={{ marginTop: 12 }}>Nenhuma medição registrada ainda.</p>}
    </div>
  );
}
