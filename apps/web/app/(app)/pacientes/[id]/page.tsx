"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authFetch, useRequireAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { SkeletonRows, SkeletonText } from "@/components/Skeleton";
import { IconUsers } from "@/components/icons";
import type { Patient, Tag } from "@nutrihub/shared";

export default function PacienteDetalhePage() {
  const professional = useRequireAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const confirm = useConfirm();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [patientTags, setPatientTags] = useState<Tag[]>([]);
  const [tagToAdd, setTagToAdd] = useState("");

  const [portalPassword, setPortalPassword] = useState("");
  const [portalMessage, setPortalMessage] = useState<string | null>(null);
  const [portalSaving, setPortalSaving] = useState(false);

  async function loadTags() {
    const [allRes, ownRes] = await Promise.all([authFetch("/tags"), authFetch(`/patients/${params.id}/tags`)]);
    if (allRes.ok) setAllTags(await allRes.json());
    if (ownRes.ok) setPatientTags(await ownRes.json());
  }

  useEffect(() => {
    if (!professional) return;
    async function load() {
      const res = await authFetch(`/patients/${params.id}`);
      if (!res.ok) {
        setError("Paciente não encontrado");
        return;
      }
      setPatient(await res.json());
    }
    load();
    loadTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional, params.id]);

  async function attachTag() {
    if (!tagToAdd) return;
    const res = await authFetch(`/tags/${tagToAdd}/patients/${params.id}`, { method: "POST" });
    if (res.ok) {
      setTagToAdd("");
      loadTags();
    }
  }

  async function detachTag(tagId: string) {
    const res = await authFetch(`/tags/${tagId}/patients/${params.id}`, { method: "DELETE" });
    if (res.ok) loadTags();
  }

  async function grantPortalAccess() {
    if (!patient?.email) {
      setPortalMessage("Cadastre um e-mail para o paciente antes de habilitar o portal.");
      return;
    }
    if (portalPassword.length < 8) {
      setPortalMessage("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    setPortalSaving(true);
    setPortalMessage(null);
    try {
      const res = await authFetch(`/patients/${params.id}/portal-access`, {
        method: "POST",
        body: JSON.stringify({ password: portalPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Não foi possível habilitar o portal");
      setPortalMessage(`Acesso habilitado. Repasse ao paciente: e-mail ${data.email} e a senha definida.`);
      setPortalPassword("");
      toast.success("Acesso ao app habilitado.");
    } catch (err) {
      setPortalMessage(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setPortalSaving(false);
    }
  }

  async function revokePortalAccess() {
    if (!(await confirm({ title: "Revogar acesso ao app?", description: "O paciente não vai mais conseguir entrar até você habilitar de novo." })))
      return;
    await authFetch(`/patients/${params.id}/portal-access/revoke`, { method: "POST" });
    setPortalMessage("Acesso revogado.");
    toast.success("Acesso revogado.");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!patient) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(`/patients/${patient.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: patient.name,
          email: patient.email,
          phone: patient.phone,
          birth_date: patient.birth_date
        })
      });
      if (!res.ok) throw new Error("Não foi possível salvar");
      setPatient(await res.json());
      toast.success("Dados do paciente atualizados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    if (!patient) return;
    const nextStatus = patient.status === "active" ? "inactive" : "active";
    const res = await authFetch(`/patients/${patient.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus })
    });
    if (res.ok) {
      setPatient(await res.json());
      toast.success(nextStatus === "active" ? "Paciente reativado." : "Paciente marcado como inativo.");
    }
  }

  async function handleDelete() {
    if (!patient) return;
    if (!(await confirm({ title: `Excluir ${patient.name}?`, description: "Essa ação não pode ser desfeita.", danger: true, confirmLabel: "Excluir" })))
      return;
    const res = await authFetch(`/patients/${patient.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Paciente excluído.");
      router.push("/pacientes");
    }
  }

  if (!professional) return null;
  if (error && !patient) {
    return (
      <main className="page-container">
        <EmptyState
          icon={<IconUsers />}
          title="Paciente não encontrado"
          description={error}
          actionLabel="Voltar para pacientes"
          actionHref="/pacientes"
        />
      </main>
    );
  }
  if (!patient) {
    return (
      <main className="page-container" style={{ maxWidth: 720 }}>
        <SkeletonText width="30%" />
        <div style={{ marginTop: "var(--space-6)" }}>
          <SkeletonRows count={4} />
        </div>
      </main>
    );
  }

  return (
    <main className="page-container" style={{ maxWidth: 720 }}>
      <a href="/pacientes" className="back-link">← Pacientes</a>
      <div className="page-title-row">
        <h1>{patient.name}</h1>
        <span className={`badge ${patient.status === "active" ? "badge-success" : "badge-neutral"}`}>
          {patient.status === "active" ? "Ativo" : "Inativo"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "var(--space-6)" }}>
        <a href={`/pacientes/${patient.id}/chat`} className="btn-secondary">
          Chat
        </a>
        <a href={`/pacientes/${patient.id}/antropometria`} className="btn-secondary">
          Antropometria
        </a>
        <a href={`/pacientes/${patient.id}/diario`} className="btn-secondary">
          Diário alimentar
        </a>
      </div>

      <div className="card" style={{ marginBottom: "var(--space-5)" }}>
        <h3 style={{ textTransform: "none", letterSpacing: 0, color: "var(--color-text-primary)", fontSize: 15 }}>
          Dados cadastrais
        </h3>
        <form onSubmit={handleSave}>
          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="p-name">
                Nome
              </label>
              <input id="p-name" value={patient.name} onChange={(e) => setPatient({ ...patient, name: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="p-birth">
                Nascimento
              </label>
              <input
                id="p-birth"
                type="date"
                value={patient.birth_date ?? ""}
                onChange={(e) => setPatient({ ...patient, birth_date: e.target.value })}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="p-email">
                E-mail
              </label>
              <input
                id="p-email"
                value={patient.email ?? ""}
                onChange={(e) => setPatient({ ...patient, email: e.target.value })}
                placeholder="Sem e-mail cadastrado"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="p-phone">
                Telefone
              </label>
              <input
                id="p-phone"
                value={patient.phone ?? ""}
                onChange={(e) => setPatient({ ...patient, phone: e.target.value })}
                placeholder="Sem telefone cadastrado"
              />
            </div>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: "var(--space-4)" }}>
              <p>{error}</p>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
            <button type="button" className="btn-secondary" onClick={toggleStatus}>
              {patient.status === "active" ? "Marcar como inativo" : "Reativar"}
            </button>
            <button type="button" className="btn-danger" onClick={handleDelete}>
              Excluir
            </button>
          </div>
        </form>
      </div>

      <div className="card" style={{ marginBottom: "var(--space-5)" }}>
        <h3 style={{ textTransform: "none", letterSpacing: 0, color: "var(--color-text-primary)", fontSize: 15 }}>Tags</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {patientTags.length === 0 && <span className="text-caption">Nenhuma tag ainda.</span>}
          {patientTags.map((tag) => (
            <span key={tag.id} className="badge badge-accent" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {tag.name}
              <button
                onClick={() => detachTag(tag.id)}
                aria-label={`Remover tag ${tag.name}`}
                style={{ border: "none", background: "none", cursor: "pointer", padding: 0, lineHeight: 1, minWidth: 0 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        {allTags.filter((t) => !patientTags.some((pt) => pt.id === t.id)).length > 0 && (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <select value={tagToAdd} onChange={(e) => setTagToAdd(e.target.value)} style={{ maxWidth: 220 }}>
              <option value="">Adicionar tag...</option>
              {allTags
                .filter((t) => !patientTags.some((pt) => pt.id === t.id))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
            <button className="btn-secondary" onClick={attachTag} disabled={!tagToAdd}>
              Adicionar
            </button>
          </div>
        )}
        <p style={{ margin: "10px 0 0", fontSize: 13 }}>
          <a href="/tags">Gerenciar tags</a>
        </p>
      </div>

      <div className="card">
        <h3 style={{ textTransform: "none", letterSpacing: 0, color: "var(--color-text-primary)", fontSize: 15 }}>
          Acesso ao app do paciente
        </h3>
        <p className="text-caption" style={{ margin: "4px 0 12px" }}>
          Defina uma senha para o paciente acessar o plano alimentar, chat e diário pelo app.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="password"
            placeholder="Senha (mín. 8 caracteres)"
            value={portalPassword}
            onChange={(e) => setPortalPassword(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <button onClick={grantPortalAccess} disabled={portalSaving} className="btn-primary">
            {portalSaving ? "Salvando..." : "Habilitar acesso"}
          </button>
          <button className="btn-ghost" onClick={revokePortalAccess}>
            Revogar
          </button>
        </div>
        {portalMessage && (
          <p style={{ marginTop: 10, fontSize: 13, color: "var(--color-text-secondary)" }}>{portalMessage}</p>
        )}
      </div>
    </main>
  );
}
