"use client";

import { useEffect, useState } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import type { Location } from "@nutrihub/shared";
import { useConfirm } from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { IconMapPin } from "@/components/icons";

export default function LocaisPage() {
  const professional = useRequireAuth();
  const confirm = useConfirm();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editKind, setEditKind] = useState<"in_person" | "video">("in_person");
  const [editAddress, setEditAddress] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/locations");
      if (!res.ok) throw new Error("Não foi possível carregar os locais");
      setLocations(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (professional) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional]);

  if (!professional) return null;

  function startEdit(location: Location) {
    setEditingId(location.id);
    setEditName(location.name);
    setEditKind(location.kind);
    setEditAddress(location.address ?? "");
  }

  async function saveEdit(id: string) {
    const res = await authFetch(`/locations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: editName, kind: editKind, address: editAddress || null })
    });
    if (res.ok) {
      setEditingId(null);
      load();
    }
  }

  async function remove(id: string) {
    if (
      !(await confirm({
        title: "Excluir este local?",
        description: "Agendamentos que já usam ele mantêm o histórico.",
        danger: true,
        confirmLabel: "Excluir"
      }))
    )
      return;
    const res = await authFetch(`/locations/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <div className="page-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <div className="page-title-row">
        <h1>Locais de atendimento</h1>
        <a href="/locais/novo" className="btn-primary">+ Novo local</a>
      </div>

      {error && <p style={{ color: "var(--color-error)" }}>{error}</p>}

      {loading && (
        <div style={{ marginTop: 20 }}>
          <SkeletonRows count={3} />
        </div>
      )}

      {!loading && !error && locations.length === 0 && (
        <EmptyState
          icon={<IconMapPin />}
          title="Nenhum local cadastrado ainda"
          description="Cadastre onde você atende — presencial ou por videoconferência."
          actionLabel="Novo local"
          actionHref="/locais/novo"
        />
      )}

      {!loading && locations.length > 0 && (
        <div className="card-grid" style={{ marginTop: 16 }}>
          {locations.map((location) => (
            <div key={location.id} className="card">
              {editingId === location.id ? (
                <div>
                  <div className="field">
                    <label className="field-label" htmlFor={`loc-name-${location.id}`}>
                      Nome
                    </label>
                    <input
                      id={`loc-name-${location.id}`}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor={`loc-kind-${location.id}`}>
                      Tipo
                    </label>
                    <select
                      id={`loc-kind-${location.id}`}
                      value={editKind}
                      onChange={(e) => setEditKind(e.target.value as "in_person" | "video")}
                    >
                      <option value="in_person">Presencial</option>
                      <option value="video">Videoconferência</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor={`loc-address-${location.id}`}>
                      Endereço
                    </label>
                    <input
                      id={`loc-address-${location.id}`}
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn-primary" onClick={() => saveEdit(location.id)}>Salvar</button>
                    <button onClick={() => setEditingId(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 15 }}>{location.name}</h3>
                    <span className="badge">{location.kind === "video" ? "Vídeo" : "Presencial"}</span>
                  </div>
                  {location.address && (
                    <p style={{ marginTop: 8, fontSize: 14, color: "var(--color-text-muted)" }}>{location.address}</p>
                  )}
                  <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                    <button onClick={() => startEdit(location)}>Editar</button>
                    <button onClick={() => remove(location.id)} style={{ color: "var(--color-error)" }}>Excluir</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
