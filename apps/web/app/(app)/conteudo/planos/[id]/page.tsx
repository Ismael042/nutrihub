"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { authFetch, useRequireAuth, API_URL, getToken } from "@/lib/auth";
import { useConfirm } from "@/components/ConfirmDialog";

interface Food {
  id: string;
  name: string;
}

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
  patient_id: string;
  patient_name: string;
  name: string;
  meals: Meal[];
}

export default function PlanoDetalhePage() {
  const professional = useRequireAuth();
  const confirm = useConfirm();
  const params = useParams<{ id: string }>();
  const [plan, setPlan] = useState<DietPlanDetail | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [newMealName, setNewMealName] = useState("");

  async function load() {
    const res = await authFetch(`/diet-plans/${params.id}`);
    if (res.ok) setPlan(await res.json());
  }

  useEffect(() => {
    if (!professional) return;
    load();
    authFetch("/foods").then(async (res) => {
      if (res.ok) setFoods(await res.json());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional, params.id]);

  async function addMeal(e: React.FormEvent) {
    e.preventDefault();
    if (!newMealName.trim()) return;
    await authFetch(`/diet-plans/${params.id}/meals`, {
      method: "POST",
      body: JSON.stringify({ name: newMealName, sort_order: (plan?.meals.length ?? 0) + 1 })
    });
    setNewMealName("");
    load();
  }

  async function deleteMeal(mealId: string) {
    if (
      !(await confirm({ title: "Excluir esta refeição e todos os itens?", danger: true, confirmLabel: "Excluir" }))
    )
      return;
    await authFetch(`/diet-plans/${params.id}/meals/${mealId}`, { method: "DELETE" });
    load();
  }

  async function addItem(mealId: string, foodId: string, quantity: string, unit: string) {
    const qty = parseFloat(quantity);
    if (!foodId || !quantity || Number.isNaN(qty) || qty <= 0) return;
    await authFetch(`/diet-plans/${params.id}/meals/${mealId}/items`, {
      method: "POST",
      body: JSON.stringify({ food_id: foodId, quantity: qty, unit })
    });
    load();
  }

  async function deleteItem(mealId: string, itemId: string) {
    await authFetch(`/diet-plans/${params.id}/meals/${mealId}/items/${itemId}`, { method: "DELETE" });
    load();
  }

  async function downloadPdf() {
    const token = getToken();
    const res = await fetch(`${API_URL}/diet-plans/${params.id}/pdf`, {
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
  }

  if (!professional) return null;
  if (!plan) return <div className="page-container">Carregando...</div>;

  return (
    <div className="page-container">
      <a href="/conteudo/planos" className="back-link">← Planos alimentares</a>
      <div className="page-title-row">
        <h1>{plan.name}</h1>
        <button onClick={downloadPdf} className="btn-primary">
          Baixar PDF
        </button>
      </div>
      <p style={{ color: "var(--color-text-muted)" }}>Paciente: {plan.patient_name}</p>

      {plan.meals.map((meal) => (
        <section key={meal.id} style={{ marginTop: 20, border: "1px solid var(--color-border)", padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>{meal.name}</h3>
            <button onClick={() => deleteMeal(meal.id)} style={{ color: "var(--color-error)" }}>
              Excluir refeição
            </button>
          </div>
          <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
            {meal.items.map((item) => (
              <li key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span>
                  {item.food_name} — {item.quantity} {item.unit}
                </span>
                <button onClick={() => deleteItem(meal.id, item.id)} style={{ color: "var(--color-error)" }}>
                  x
                </button>
              </li>
            ))}
          </ul>
          <AddItemForm foods={foods} onAdd={(foodId, qty, unit) => addItem(meal.id, foodId, qty, unit)} />
        </section>
      ))}

      <form onSubmit={addMeal} style={{ display: "flex", gap: 8, marginTop: 20, alignItems: "flex-end" }}>
        <div className="field" style={{ flex: 1, marginBottom: 0 }}>
          <label className="field-label" htmlFor="new-meal-name">
            Nova refeição
          </label>
          <input
            id="new-meal-name"
            placeholder="ex: Almoço"
            value={newMealName}
            onChange={(e) => setNewMealName(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary">
          + Adicionar refeição
        </button>
      </form>
    </div>
  );
}

function AddItemForm({
  foods,
  onAdd
}: {
  foods: Food[];
  onAdd: (foodId: string, quantity: string, unit: string) => void;
}) {
  const [foodId, setFoodId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("g");

  return (
    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
      <select aria-label="Alimento" value={foodId} onChange={(e) => setFoodId(e.target.value)} style={{ flex: 1 }}>
        <option value="">Alimento...</option>
        {foods.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <input
        aria-label="Quantidade"
        placeholder="Qtd"
        type="number"
        min="0"
        step="any"
        inputMode="decimal"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        style={{ width: 70 }}
      />
      <input
        aria-label="Unidade"
        placeholder="un"
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        style={{ width: 60 }}
      />
      <button
        type="button"
        onClick={() => {
          onAdd(foodId, quantity, unit);
          setFoodId("");
          setQuantity("");
        }}
      >
        + Item
      </button>
    </div>
  );
}
