"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
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
    if (!confirm("Excluir este modelo?")) return;
    await authFetch(`/questionnaires/templates/${id}`, { method: "DELETE" });
    load();
  }

  if (!professional) return null;

  return (
    <main className="page-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <div className="page-title-row">
        <h1>Anamnese / Questionário</h1>
        <a href="/conteudo/questionarios/preencher" className="btn-primary">
          Preencher para paciente
        </a>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        <select value={kind} onChange={(e) => setKind(e.target.value as "anamnesis" | "pre_consultation")}>
          <option value="anamnesis">Anamnese</option>
          <option value="pre_consultation">Questionário pré-consulta</option>
        </select>
        <input placeholder="Nome do modelo" value={name} onChange={(e) => setName(e.target.value)} required />

        <div>Perguntas:</div>
        {fields.map((f, i) => (
          <input
            key={i}
            placeholder={`Pergunta ${i + 1}`}
            value={f.label}
            onChange={(e) => updateField(i, e.target.value)}
          />
        ))}
        <button type="button" onClick={() => setFields((prev) => [...prev, { label: "", type: "text" }])}>
          + Adicionar pergunta
        </button>

        <button type="submit" style={{ padding: 10 }}>
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
        <ul style={{ listStyle: "none", padding: 0, marginTop: 20 }}>
          {templates.map((t) => (
            <li key={t.id} style={{ padding: "10px 0", borderBottom: "1px solid #eee" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{t.name}</strong>
                <button onClick={() => remove(t.id)} style={{ color: "crimson" }}>
                  Excluir
                </button>
              </div>
              <div style={{ color: "#666" }}>
                {t.kind === "anamnesis" ? "Anamnese" : "Pré-consulta"} · {t.fields.map((f) => f.label).join(", ")}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
