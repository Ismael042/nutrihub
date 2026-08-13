"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";

interface NoteTask {
  id: string;
  kind: "task" | "note";
  content: string;
  done: boolean;
}

export default function NutriPlanPage() {
  const professional = useRequireAuth();
  const [items, setItems] = useState<NoteTask[]>([]);
  const [kind, setKind] = useState<"task" | "note">("task");
  const [content, setContent] = useState("");

  async function load() {
    const res = await authFetch("/notes-tasks");
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => {
    if (professional) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await authFetch("/notes-tasks", { method: "POST", body: JSON.stringify({ kind, content }) });
    if (res.ok) {
      setContent("");
      load();
    }
  }

  async function toggleDone(item: NoteTask) {
    await authFetch(`/notes-tasks/${item.id}`, { method: "PATCH", body: JSON.stringify({ done: !item.done }) });
    load();
  }

  async function remove(id: string) {
    await authFetch(`/notes-tasks/${id}`, { method: "DELETE" });
    load();
  }

  if (!professional) return null;

  const tasks = items.filter((i) => i.kind === "task");
  const notes = items.filter((i) => i.kind === "note");

  return (
    <main className="page-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <h1>NutriPlan</h1>
      <p style={{ color: "#666" }}>Tarefas e notas rápidas.</p>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <select value={kind} onChange={(e) => setKind(e.target.value as "task" | "note")}>
          <option value="task">Tarefa</option>
          <option value="note">Nota</option>
        </select>
        <input
          placeholder="Escreva aqui..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          style={{ flex: 1 }}
        />
        <button type="submit" style={{ padding: 10 }}>
          Adicionar
        </button>
      </form>

      <h3 style={{ marginTop: 24 }}>Tarefas</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {tasks.map((t) => (
          <li key={t.id} style={{ padding: "6px 0", display: "flex", justifyContent: "space-between" }}>
            <label style={{ textDecoration: t.done ? "line-through" : "none" }}>
              <input type="checkbox" checked={t.done} onChange={() => toggleDone(t)} /> {t.content}
            </label>
            <button onClick={() => remove(t.id)} style={{ color: "crimson" }}>
              Excluir
            </button>
          </li>
        ))}
      </ul>
      {tasks.length === 0 && <p style={{ color: "#666" }}>Nenhuma tarefa.</p>}

      <h3 style={{ marginTop: 24 }}>Notas</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {notes.map((n) => (
          <li key={n.id} style={{ padding: "6px 0", display: "flex", justifyContent: "space-between" }}>
            <span>{n.content}</span>
            <button onClick={() => remove(n.id)} style={{ color: "crimson" }}>
              Excluir
            </button>
          </li>
        ))}
      </ul>
      {notes.length === 0 && <p style={{ color: "#666" }}>Nenhuma nota.</p>}
    </main>
  );
}
