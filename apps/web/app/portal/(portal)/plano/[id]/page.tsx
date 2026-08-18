"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { API_URL } from "@/lib/auth";
import { getPatientToken, patientFetch } from "@/lib/patientAuth";
import { SkeletonRows } from "@/components/Skeleton";

interface MealItem {
  id: string;
  food_id: string;
  food_name: string;
  quantity: number;
  unit: string;
}

interface Meal {
  id: string;
  name: string;
  sort_order: number;
  items: MealItem[];
}

interface DietPlanDetail {
  id: string;
  name: string;
  created_at: string;
  meals: Meal[];
}

export default function PatientPlanoDetalhePage() {
  const params = useParams<{ id: string }>();
  const [plan, setPlan] = useState<DietPlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    patientFetch(`/patient-portal/diet-plans/${params.id}`)
      .then(async (res) => {
        if (res.ok) setPlan(await res.json());
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  async function downloadPdf() {
    setDownloading(true);
    try {
      const token = getPatientToken();
      const res = await fetch(`${API_URL}/patient-portal/diet-plans/${params.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${plan?.name ?? "plano"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <SkeletonRows count={4} />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="page-container">
        <a href="/portal/plano" className="back-link">
          ← Meus planos
        </a>
        <p>Plano não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <a href="/portal/plano" className="back-link">
        ← Meus planos
      </a>
      <div className="page-title-row">
        <h1>{plan.name}</h1>
        <button onClick={downloadPdf} disabled={downloading} className="btn-primary">
          {downloading ? "Gerando..." : "Baixar PDF"}
        </button>
      </div>

      <div className="meal-grid">
        {plan.meals.map((meal) => (
          <section key={meal.id} className="card card-static">
            <h3 style={{ margin: 0 }}>{meal.name}</h3>
            <ul style={{ marginTop: 10 }}>
              {meal.items.map((item) => (
                <li key={item.id}>
                  {item.food_name} — {item.quantity} {item.unit}
                </li>
              ))}
              {meal.items.length === 0 && (
                <li style={{ color: "var(--color-text-muted)" }}>Sem itens ainda.</li>
              )}
            </ul>
          </section>
        ))}
        {plan.meals.length === 0 && <p>Este plano ainda não tem refeições.</p>}
      </div>
    </div>
  );
}
