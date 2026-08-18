"use client";

import { useEffect, useState } from "react";
import { patientFetch } from "@/lib/patientAuth";
import EmptyState from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { IconClipboard } from "@/components/icons";

interface DietPlan {
  id: string;
  name: string;
  created_at: string;
}

export default function PatientPlanosPage() {
  const [plans, setPlans] = useState<DietPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    patientFetch("/patient-portal/diet-plans")
      .then(async (res) => {
        if (res.ok) setPlans(await res.json());
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-container">
      <h1>Meus planos alimentares</h1>

      {loading && (
        <div style={{ marginTop: 20 }}>
          <SkeletonRows count={4} />
        </div>
      )}

      {!loading && plans.length === 0 && (
        <EmptyState
          icon={<IconClipboard />}
          title="Nenhum plano alimentar ainda"
          description="Seu nutricionista ainda não montou um plano pra você."
        />
      )}

      {!loading && plans.length > 0 && (
        <div className="card-grid">
          {plans.map((p) => (
            <div key={p.id} className="card">
              <a href={`/portal/plano/${p.id}`} style={{ fontWeight: 600, display: "block" }}>
                {p.name}
              </a>
              <span style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
                {new Date(p.created_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
