"use client";

import { useEffect, useState } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";
import EmptyState from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { IconClipboard } from "@/components/icons";

interface DietPlan {
  id: string;
  patient_id: string;
  patient_name: string;
  name: string;
  created_at: string;
}

export default function PlanosPage() {
  const professional = useRequireAuth();
  const [plans, setPlans] = useState<DietPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!professional) return;
    setLoading(true);
    authFetch("/diet-plans")
      .then(async (res) => {
        if (res.ok) setPlans(await res.json());
      })
      .finally(() => setLoading(false));
  }, [professional]);

  if (!professional) return null;

  return (
    <main className="page-container">
      <a href="/dashboard" className="back-link">← Dashboard</a>
      <div className="page-title-row">
        <h1>Planos alimentares</h1>
        <a href="/conteudo/planos/novo" className="btn-primary">
          + Novo plano
        </a>
      </div>

      {loading && (
        <div style={{ marginTop: 20 }}>
          <SkeletonRows count={4} />
        </div>
      )}

      {!loading && plans.length === 0 && (
        <EmptyState
          icon={<IconClipboard />}
          title="Nenhum plano alimentar cadastrado"
          description="Monte o primeiro cardápio de um paciente com refeições e itens."
          actionLabel="Novo plano"
          actionHref="/conteudo/planos/novo"
        />
      )}

      {!loading && plans.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {plans.map((p) => (
            <li key={p.id} style={{ padding: "10px 0", borderBottom: "1px solid #eee" }}>
              <a href={`/conteudo/planos/${p.id}`}>{p.name}</a>
              <span style={{ color: "#666" }}> · {p.patient_name}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
