"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import type { TeamMember } from "@nutrihub/shared";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { IconTeam } from "@/components/icons";
import PasswordInput from "@/components/PasswordInput";

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
    <div className="page-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <h1>Equipe</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
        Outros profissionais e assistentes que atendem no mesmo consultório (mesmo tenant).
      </p>

      {isAdmin && (
        <details style={{ marginTop: 16 }}>
          <summary>+ Convidar profissional</summary>
          <form onSubmit={handleSubmit} style={{ marginTop: 8 }}>
            <div className="field">
              <label className="field-label field-required" htmlFor="invite-name">
                Nome
              </label>
              <input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label field-required" htmlFor="invite-email">
                  E-mail
                </label>
                <input
                  id="invite-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label className="field-label field-required" htmlFor="invite-password">
                  Senha temporária
                </label>
                <PasswordInput
                  id="invite-password"
                  autoComplete="new-password"
                  placeholder="Mín. 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="field field-md">
              <label className="field-label" htmlFor="invite-role">
                Papel
              </label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as "nutritionist" | "assistant" | "admin")}
              >
                <option value="nutritionist">Nutricionista</option>
                <option value="assistant">Assistente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            {error && (
              <div className="alert alert-error" style={{ marginBottom: "var(--space-4)" }}>
                <p>{error}</p>
              </div>
            )}
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
        <div className="table-wrap table-responsive-cards" style={{ marginTop: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Papel</th>
                {isAdmin && <th />}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td data-label="Nome">
                    <strong>{m.name}</strong>
                  </td>
                  <td data-label="E-mail">{m.email}</td>
                  <td data-label="Papel">
                    <span className="badge">{ROLE_LABELS[m.role] ?? m.role}</span>
                  </td>
                  {isAdmin && (
                    <td className="table-actions" data-label="Ações">
                      <div style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <select
                          value={m.role}
                          onChange={(e) => changeRole(m.id, e.target.value)}
                          aria-label={`Papel de ${m.name}`}
                        >
                          <option value="admin">Administrador</option>
                          <option value="nutritionist">Nutricionista</option>
                          <option value="assistant">Assistente</option>
                        </select>
                        <button onClick={() => remove(m.id)} style={{ color: "var(--color-error)" }}>
                          Remover
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
