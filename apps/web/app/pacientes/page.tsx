"use client";

import { useEffect, useState } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";

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
    <main className="page-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <div className="page-title-row">
        <h1>Pacientes</h1>
        <a href="/pacientes/novo" className="btn-primary">
          + Novo paciente
        </a>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "6px 12px",
              fontWeight: tab === t.key ? 700 : 400,
              background: tab === t.key ? "#eee" : "transparent"
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <input
        placeholder="Buscar por nome..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginTop: 12, width: "100%" }}
      />

      {loading && <p>Carregando...</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {!loading && !error && patients.length === 0 && <p style={{ marginTop: 16 }}>Nenhum paciente encontrado.</p>}

      <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
        {patients.map((p) => (
          <li key={p.id} style={{ padding: "10px 0", borderBottom: "1px solid #eee" }}>
            <a href={`/pacientes/${p.id}`}>{p.name}</a>
            {p.email && <span style={{ color: "#666" }}> · {p.email}</span>}
            {p.status === "inactive" && <span style={{ color: "#999" }}> (inativo)</span>}
          </li>
        ))}
      </ul>
    </main>
  );
}
