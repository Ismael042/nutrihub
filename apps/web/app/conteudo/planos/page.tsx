"use client";

import { useEffect, useState } from "react";
import { authFetch, useRequireAuth } from "@/lib/auth";

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

  useEffect(() => {
    if (!professional) return;
    authFetch("/diet-plans").then(async (res) => {
      if (res.ok) setPlans(await res.json());
    });
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

      <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
        {plans.map((p) => (
          <li key={p.id} style={{ padding: "10px 0", borderBottom: "1px solid #eee" }}>
            <a href={`/conteudo/planos/${p.id}`}>{p.name}</a>
            <span style={{ color: "#666" }}> · {p.patient_name}</span>
          </li>
        ))}
      </ul>
      {plans.length === 0 && <p>Nenhum plano alimentar cadastrado.</p>}
    </main>
  );
}
