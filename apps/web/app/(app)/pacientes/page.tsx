"use client";

import { useEffect, useState } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import EmptyState from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { IconSearch, IconUsers } from "@/components/icons";

interface Patient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  status: "active" | "inactive";
}

type TabKey = "active" | "inactive" | "all";

const TABS: { key: TabKey; label: string }[] = [
  { key: "active", label: "Ativos" },
  { key: "all", label: "Todos" },
  { key: "inactive", label: "Inativos" }
];

export default function PacientesPage() {
  const professional = useRequireAuth();
  const [tab, setTab] = useState<TabKey>("active");
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!professional) return;

    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ status: tab });
        if (search) params.set("search", search);
        const res = await authFetch(`/patients?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Não foi possível carregar os pacientes");
        setPatients(await res.json());
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    const debounce = setTimeout(load, 250);
    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [professional, tab, search]);

  if (!professional) return null;

  return (
    <div className="content-stack">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <div className="page-title-row">
        <h1>Pacientes</h1>
        <a href="/pacientes/novo" className="btn-primary">
          + Novo paciente
        </a>
      </div>

      <div className="tabs" role="tablist" aria-label="Filtrar por status">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`tab${tab === t.key ? " active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="field-search" style={{ marginTop: "var(--space-4)" }}>
        <span className="field-search-icon">
          <IconSearch />
        </span>
        <input
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar paciente por nome"
        />
      </div>

      <div style={{ marginTop: "var(--space-4)" }}>
        {loading && <SkeletonRows count={5} />}
        {!loading && error && (
          <div className="alert alert-error">
            <p>{error}</p>
          </div>
        )}
        {!loading && !error && patients.length === 0 && (
          <EmptyState
            icon={<IconUsers />}
            title={tab === "active" ? "Nenhum paciente ativo" : "Nenhum paciente encontrado"}
            description={
              search
                ? "Tente buscar por outro nome."
                : "Cadastre seu primeiro paciente para começar a organizar atendimentos, planos e financeiro."
            }
            actionLabel={search ? undefined : "Cadastrar paciente"}
            actionHref={search ? undefined : "/pacientes/novo"}
          />
        )}
        {!loading && !error && patients.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Contato</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <a href={`/pacientes/${p.id}`} style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
                        {p.name}
                      </a>
                    </td>
                    <td style={{ color: "var(--color-text-muted)" }}>{p.email ?? p.phone ?? "—"}</td>
                    <td>
                      <span className={`badge ${p.status === "active" ? "badge-success" : "badge-neutral"}`}>
                        {p.status === "active" ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
