"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import type { TeamMember } from "@nutrihub/shared";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { IconTeam } from "@/components/icons";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  nutritionist: "Nutricionista",
  assistant: "Assistente"
};

export default function EquipePage() {
  const professional = useRequireAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"nutritionist" | "assistant" | "admin">("nutritionist");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await authFetch("/team");
      if (res.ok) setMembers(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (professional) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional]);

  if (!professional) return null;

  const isAdmin = professional.role === "admin" || !professional.role;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await authFetch("/team/invite", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Não foi possível convidar");
      setName("");
      setEmail("");
      setPassword("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(id: string, newRole: string) {
    const res = await authFetch(`/team/${id}`, { method: "PATCH", body: JSON.stringify({ role: newRole }) });
    if (res.ok) load();
    else {
      const data = await res.json();
      toast.error(data.detail ?? "Não foi possível alterar o papel");
    }
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Remover este profissional do consultório?", danger: true, confirmLabel: "Remover" })))
      return;
    const res = await authFetch(`/team/${id}`, { method: "DELETE" });
    if (res.ok) load();
    else {
      const data = await res.json();
      toast.error(data.detail ?? "Não foi possível remover");
    }
  }

  return (
    <main className="page-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <h1>Equipe</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
        Outros profissionais e assistentes que atendem no mesmo consultório (mesmo tenant).
      </p>

      {isAdmin && (
        <details style={{ marginTop: 16 }}>
          <summary>+ Convidar profissional</summary>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            <input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
            <input placeholder="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input
              placeholder="Senha temporária (mín. 8 caracteres)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <select value={role} onChange={(e) => setRole(e.target.value as "nutritionist" | "assistant" | "admin")}>
              <option value="nutritionist">Nutricionista</option>
              <option value="assistant">Assistente</option>
              <option value="admin">Administrador</option>
            </select>
            {error && <p style={{ color: "var(--color-error)" }}>{error}</p>}
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Convidando..." : "Convidar"}
            </button>
          </form>
        </details>
      )}

      {loading && (
        <div style={{ marginTop: 20 }}>
          <SkeletonRows count={3} />
        </div>
      )}

      {!loading && members.length === 0 && (
        <EmptyState
          icon={<IconTeam />}
          title="Nenhum outro profissional na equipe"
          description={isAdmin ? "Convide um profissional ou assistente acima." : "Só você atende neste consultório por enquanto."}
        />
      )}

      {!loading && members.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 20 }}>
          {members.map((m) => (
            <li key={m.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>{m.name}</strong>
                <span style={{ color: "var(--color-text-muted)" }}> · {m.email}</span>
                <span className="badge" style={{ marginLeft: 8 }}>{ROLE_LABELS[m.role] ?? m.role}</span>
              </div>
              {isAdmin && (
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)}>
                    <option value="admin">Administrador</option>
                    <option value="nutritionist">Nutricionista</option>
                    <option value="assistant">Assistente</option>
                  </select>
                  <button onClick={() => remove(m.id)} style={{ color: "var(--color-error)" }}>Remover</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
