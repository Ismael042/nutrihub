"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import { useConfirm } from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { IconFileText } from "@/components/icons";

interface Field {
  label: string;
  type: string;
}

interface Template {
  id: string;
  kind: "anamnesis" | "pre_consultation";
  name: string;
  fields: Field[];
}

export default function QuestionariosPage() {
  const professional = useRequireAuth();
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<"anamnesis" | "pre_consultation">("anamnesis");
  const [name, setName] = useState("");
  const [fields, setFields] = useState<Field[]>([{ label: "", type: "text" }]);

  async function load() {
    setLoading(true);
    try {
      const res = await authFetch("/questionnaires/templates");
      if (res.ok) setTemplates(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (professional) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional]);

  function updateField(i: number, label: string) {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, label } : f)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cleanFields = fields.filter((f) => f.label.trim());
    if (cleanFields.length === 0) return;
    const res = await authFetch("/questionnaires/templates", {
      method: "POST",
      body: JSON.stringify({ kind, name, fields: cleanFields })
    });
    if (res.ok) {
      setName("");
      setFields([{ label: "", type: "text" }]);
      load();
    }
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Excluir este modelo?", danger: true, confirmLabel: "Excluir" }))) return;
    await authFetch(`/questionnaires/templates/${id}`, { method: "DELETE" });
    load();
  }

  if (!professional) return null;

  return (
    <div className="page-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <div className="page-title-row">
        <h1>Anamnese / Questionário</h1>
        <a href="/conteudo/questionarios/preencher" className="btn-primary">
          Preencher para paciente
        </a>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
        <div className="field-row">
          <div className="field field-md">
            <label className="field-label" htmlFor="tpl-kind">
              Tipo
            </label>
            <select id="tpl-kind" value={kind} onChange={(e) => setKind(e.target.value as "anamnesis" | "pre_consultation")}>
              <option value="anamnesis">Anamnese</option>
              <option value="pre_consultation">Questionário pré-consulta</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label field-required" htmlFor="tpl-name">
              Nome do modelo
            </label>
            <input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
        </div>

        <div className="field">
          <label className="field-label">Perguntas</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {fields.map((f, i) => (
              <input
                key={i}
                aria-label={`Pergunta ${i + 1}`}
                placeholder={`Pergunta ${i + 1}`}
                value={f.label}
                onChange={(e) => updateField(i, e.target.value)}
              />
            ))}
            <button type="button" onClick={() => setFields((prev) => [...prev, { label: "", type: "text" }])}>
              + Adicionar pergunta
            </button>
          </div>
        </div>

        <button type="submit" className="btn-primary">
          Salvar modelo
        </button>
      </form>

      {loading && (
        <div style={{ marginTop: 20 }}>
          <SkeletonRows count={3} />
        </div>
      )}

      {!loading && templates.length === 0 && (
        <EmptyState
          icon={<IconFileText />}
          title="Nenhum modelo cadastrado"
          description="Crie um modelo de anamnese ou questionário pré-consulta acima."
        />
      )}

      {!loading && templates.length > 0 && (
        <div className="card-grid">
          {templates.map((t) => (
            <article key={t.id} className="card card-static">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                <strong>{t.name}</strong>
                <button onClick={() => remove(t.id)} style={{ color: "var(--color-error)", flexShrink: 0 }}>
                  Excluir
                </button>
              </div>
              <p style={{ margin: "6px 0 0" }}>
                <span className="badge badge-neutral">{t.kind === "anamnesis" ? "Anamnese" : "Pré-consulta"}</span>
              </p>
              <p style={{ color: "var(--color-text-muted)", fontSize: 14, margin: "8px 0 0" }}>
                {t.fields.map((f) => f.label).join(", ")}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
