"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";

interface Patient {
  id: string;
  name: string;
}

interface Field {
  label: string;
  type: string;
}

interface Template {
  id: string;
  name: string;
  fields: Field[];
}

export default function PreencherQuestionarioPage() {
  const professional = useRequireAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [patientId, setPatientId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!professional) return;
    Promise.all([authFetch("/patients?status=all"), authFetch("/questionnaires/templates")]).then(
      async ([patientsRes, templatesRes]) => {
        if (patientsRes.ok) setPatients(await patientsRes.json());
        if (templatesRes.ok) setTemplates(await templatesRes.json());
      }
    );
  }, [professional]);

  const template = templates.find((t) => t.id === templateId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await authFetch("/questionnaires/responses", {
      method: "POST",
      body: JSON.stringify({ template_id: templateId, patient_id: patientId, answers })
    });
    if (res.ok) {
      setSaved(true);
      setAnswers({});
    }
  }

  if (!professional) return null;

  return (
    <main className="form-container">
      <a href="/conteudo/questionarios" className="back-link">← Modelos</a>
      <h1>Preencher questionário</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
          <option value="">Selecione o paciente...</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          <option value="">Selecione o modelo...</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {template && (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
          {template.fields.map((f) => (
            <label key={f.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {f.label}
              <input
                value={answers[f.label] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [f.label]: e.target.value }))}
              />
            </label>
          ))}
          <button type="submit" disabled={!patientId} className="btn-primary">
            Salvar respostas
          </button>
          {saved && <p style={{ color: "green" }}>Respostas salvas.</p>}
        </form>
      )}
    </main>
  );
}
