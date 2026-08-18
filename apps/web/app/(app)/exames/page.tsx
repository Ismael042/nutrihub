"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import { formatDate, type LabExamRequest } from "@nutrihub/shared";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
import EmptyState from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { IconFlask } from "@/components/icons";

interface Patient {
  id: string;
  name: string;
}

export default function ExamesPage() {
  const professional = useRequireAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [requests, setRequests] = useState<LabExamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientId, setPatientId] = useState("");
  const [examNames, setExamNames] = useState<string[]>([""]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Um input de arquivo só, reaproveitado por item da lista.
  const [attachTarget, setAttachTarget] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const attachRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const [patientsRes, listRes] = await Promise.all([
        authFetch("/patients?status=all"),
        authFetch("/lab-exam-requests")
      ]);
      if (patientsRes.ok) setPatients(await patientsRes.json());
      if (listRes.ok) setRequests(await listRes.json());
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
    setError(null);
    const exams = examNames.map((n) => n.trim()).filter(Boolean).map((name) => ({ name }));
    if (!patientId) {
      setError("Selecione um paciente");
      return;
    }
    if (exams.length === 0) {
      setError("Adicione ao menos um exame");
      return;
    }
    const res = await authFetch("/lab-exam-requests", {
      method: "POST",
      body: JSON.stringify({ patient_id: patientId, exams, notes: notes || null })
    });
    if (!res.ok) {
      setError("Não foi possível salvar");
      return;
    }
    setExamNames([""]);
    setNotes("");
    load();
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Excluir esta solicitação?", danger: true, confirmLabel: "Excluir" }))) return;
    await authFetch(`/lab-exam-requests/${id}`, { method: "DELETE" });
    load();
  }

  async function handleAttachmentSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const requestId = attachTarget;
    setAttachTarget(null);
    if (!file || !requestId) return;

    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("Arquivo muito grande — envie até 10 MB.");
      return;
    }

    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await authFetch(`/lab-exam-requests/${requestId}/attachments`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Não foi possível anexar o arquivo");
      toast.success("Resultado anexado.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setUploadingAttachment(false);
    }
  }

  async function removeAttachment(requestId: string, attachmentId: string) {
    if (!(await confirm({ title: "Remover este anexo?", danger: true, confirmLabel: "Remover" }))) return;
    const res = await authFetch(`/lab-exam-requests/${requestId}/attachments/${attachmentId}`, {
      method: "DELETE"
    });
    if (res.ok) load();
    else toast.error("Não foi possível remover o anexo");
  }

  if (!professional) return null;

  return (
    <div className="page-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <h1>Solicitações de exames</h1>

      <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
        <div className="field">
          <label className="field-label field-required" htmlFor="exam-patient">
            Paciente
          </label>
          <select id="exam-patient" value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
            <option value="">Selecione o paciente...</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label">Exames</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {examNames.map((name, i) => (
              <div key={i} style={{ display: "flex", gap: 8 }}>
                <input
                  aria-label={`Exame ${i + 1}`}
                  placeholder={`Exame ${i + 1} (ex: Hemograma completo)`}
                  value={name}
                  onChange={(e) => setExamNames(examNames.map((n, idx) => (idx === i ? e.target.value : n)))}
                  style={{ flex: 1 }}
                />
                {examNames.length > 1 && (
                  <button type="button" onClick={() => setExamNames(examNames.filter((_, idx) => idx !== i))} className="btn-icon">
                    ×
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setExamNames([...examNames, ""])}>
              + Adicionar exame
            </button>
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="exam-notes">
            Observações
          </label>
          <input id="exam-notes" placeholder="Opcional" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error && (
          <div className="alert alert-error" style={{ marginBottom: "var(--space-4)" }}>
            <p>{error}</p>
          </div>
        )}
        <button type="submit" className="btn-primary">
          Solicitar
        </button>
      </form>

      {loading && (
        <div style={{ marginTop: 20 }}>
          <SkeletonRows count={3} />
        </div>
      )}

      {!loading && requests.length === 0 && (
        <EmptyState
          icon={<IconFlask />}
          title="Nenhuma solicitação de exame"
          description="Selecione um paciente e solicite exames laboratoriais acima."
        />
      )}

      {!loading && requests.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 20 }}>
          {requests.map((r) => (
            <li key={r.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{r.patient_name}</strong>
                <button onClick={() => remove(r.id)} style={{ color: "var(--color-error)" }}>
                  Excluir
                </button>
              </div>
              <div>{r.exams.map((e) => e.name).join(", ")}</div>
              <div style={{ color: "var(--color-text-muted)" }}>
                {formatDate(r.requested_at)}
                {r.notes && ` · ${r.notes}`}
              </div>

              {(r.attachments ?? []).length > 0 && (
                <ul className="attachment-list">
                  {(r.attachments ?? []).map((a) => (
                    <li className="attachment-item" key={a.id}>
                      {a.url ? (
                        <a href={a.url} target="_blank" rel="noreferrer">
                          {a.filename}
                        </a>
                      ) : (
                        <span>{a.filename}</span>
                      )}
                      <span className="attachment-meta">{formatSize(a.size_bytes)}</span>
                      <button
                        className="btn-sm"
                        style={{ color: "var(--color-error)" }}
                        onClick={() => removeAttachment(r.id, a.id)}
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button
                className="btn-sm"
                style={{ marginTop: 8 }}
                disabled={uploadingAttachment}
                onClick={() => {
                  setAttachTarget(r.id);
                  attachRef.current?.click();
                }}
              >
                {uploadingAttachment ? "Enviando..." : "+ Anexar resultado"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={attachRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        hidden
        onChange={handleAttachmentSelected}
      />
    </div>
  );
}
