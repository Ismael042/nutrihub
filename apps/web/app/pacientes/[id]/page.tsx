"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authFetch, useRequireAuth } from "@/lib/auth";
import type { Patient, Tag } from "@nutrihub/shared";

export default function PacienteDetalhePage() {
  const professional = useRequireAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
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
    const [allRes, ownRes] = await Promise.all([
      authFetch("/tags"),
      authFetch(`/patients/${params.id}/tags`)
    ]);
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
    } catch (err) {
      setPortalMessage(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setPortalSaving(false);
    }
  }

  async function revokePortalAccess() {
    if (!confirm("Revogar o acesso deste paciente ao app/portal?")) return;
    await authFetch(`/patients/${params.id}/portal-access/revoke`, { method: "POST" });
    setPortalMessage("Acesso revogado.");
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
    if (res.ok) setPatient(await res.json());
  }

  async function handleDelete() {
    if (!patient) return;
    if (!confirm(`Excluir ${patient.name} permanentemente?`)) return;
    const res = await authFetch(`/patients/${patient.id}`, { method: "DELETE" });
    if (res.ok) router.push("/pacientes");
  }

  if (!professional) return null;
  if (error) return <main className="form-container">{error}</main>;
  if (!patient) return <main className="form-container">Carregando...</main>;

  return (
    <main className="form-container">
      <a href="/pacientes" className="back-link">← Pacientes</a>
      <div className="page-title-row">
        <h1>{patient.name}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={`/pacientes/${patient.id}/chat`} className="btn-primary">Chat</a>
          <a href={`/pacientes/${patient.id}/antropometria`} className="btn-primary">Antropometria</a>
          <a href={`/pacientes/${patient.id}/diario`} className="btn-primary">Diário alimentar</a>
        </div>
      </div>
      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          value={patient.name}
          onChange={(e) => setPatient({ ...patient, name: e.target.value })}
        />
        <input
          value={patient.email ?? ""}
          onChange={(e) => setPatient({ ...patient, email: e.target.value })}
          placeholder="E-mail"
        />
        <input
          value={patient.phone ?? ""}
          onChange={(e) => setPatient({ ...patient, phone: e.target.value })}
          placeholder="Telefone"
        />
        <input
          type="date"
          value={patient.birth_date ?? ""}
          onChange={(e) => setPatient({ ...patient, birth_date: e.target.value })}
        />
        <button type="submit" disabled={saving} className="btn-primary" style={{ padding: 10 }}>
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </form>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={toggleStatus} style={{ padding: 10 }}>
          {patient.status === "active" ? "Marcar como inativo" : "Reativar"}
        </button>
        <button onClick={handleDelete} style={{ padding: 10, color: "crimson" }}>
          Excluir
        </button>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 15 }}>Tags</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {patientTags.length === 0 && <span style={{ color: "#666", fontSize: 14 }}>Nenhuma tag ainda.</span>}
          {patientTags.map((tag) => (
            <span key={tag.id} className="badge" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {tag.name}
              <button
                onClick={() => detachTag(tag.id)}
                aria-label={`Remover tag ${tag.name}`}
                style={{ border: "none", background: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        {allTags.filter((t) => !patientTags.some((pt) => pt.id === t.id)).length > 0 && (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <select value={tagToAdd} onChange={(e) => setTagToAdd(e.target.value)}>
              <option value="">Adicionar tag...</option>
              {allTags
                .filter((t) => !patientTags.some((pt) => pt.id === t.id))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
            <button onClick={attachTag} disabled={!tagToAdd}>Adicionar</button>
          </div>
        )}
        <p style={{ margin: "8px 0 0", fontSize: 13 }}>
          <a href="/tags">Gerenciar tags</a>
        </p>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 15 }}>Acesso ao app do paciente</h3>
        <p style={{ fontSize: 13, color: "#666", margin: "4px 0 8px" }}>
          Defina uma senha para o paciente acessar o plano alimentar e prescrições pelo app.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="password"
            placeholder="Senha (mín. 8 caracteres)"
            value={portalPassword}
            onChange={(e) => setPortalPassword(e.target.value)}
          />
          <button onClick={grantPortalAccess} disabled={portalSaving} className="btn-primary">
            {portalSaving ? "Salvando..." : "Habilitar acesso"}
          </button>
          <button onClick={revokePortalAccess}>Revogar</button>
        </div>
        {portalMessage && <p style={{ marginTop: 8, fontSize: 13 }}>{portalMessage}</p>}
      </div>
    </main>
  );
}
