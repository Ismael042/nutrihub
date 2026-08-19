"use client";

import { useEffect, useState, type FormEvent } from "react";
import { patientFetch } from "@/lib/patientAuth";
import { useConfirm } from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { IconBook } from "@/components/icons";
import type { FoodDiaryEntry, MealKind } from "@nutrihub/shared";

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Café da manhã",
  lunch: "Almoço",
  dinner: "Jantar",
  snack: "Lanche"
};

export default function PatientDiarioPage() {
  const confirm = useConfirm();
  const [entries, setEntries] = useState<FoodDiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [mealKind, setMealKind] = useState<MealKind>("breakfast");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await patientFetch("/patient-portal/diary");
    if (res.ok) setEntries(await res.json());
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setSaving(true);
    try {
      const res = await patientFetch("/patient-portal/diary", {
        method: "POST",
        body: JSON.stringify({ meal_kind: mealKind, description: description.trim() })
      });
      if (res.ok) {
        setDescription("");
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Excluir este registro?", danger: true, confirmLabel: "Excluir" }))) return;
    const res = await patientFetch(`/patient-portal/diary/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <div className="page-container">
      <h1>Diário alimentar</h1>
      <p className="text-caption" style={{ marginBottom: 20 }}>
        Registre o que você comeu — seu nutricionista acompanha por aqui.
      </p>

      {/* .field-row (não flex inline) de propósito: .field-md só tem efeito como
          filho direto de .field-row (seletor descendente no CSS) — fora dele a
          classe não fazia nada, e os campos ficavam "em escada" com espaço vazio
          à direita em vez de se comportar como todo outro formulário do sistema. */}
      <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
        <div className="field-row">
          <div className="field field-md">
            <label className="field-label" htmlFor="meal-kind">
              Refeição
            </label>
            <select id="meal-kind" value={mealKind} onChange={(e) => setMealKind(e.target.value as MealKind)}>
              <option value="breakfast">Café da manhã</option>
              <option value="lunch">Almoço</option>
              <option value="snack">Lanche</option>
              <option value="dinner">Jantar</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="description">
              O que você comeu?
            </label>
            <input
              id="description"
              placeholder="ex: Arroz, feijão e frango grelhado"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
        </div>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Salvando..." : "Registrar"}
        </button>
      </form>

      {loading && (
        <div style={{ marginTop: 20 }}>
          <SkeletonRows count={4} />
        </div>
      )}

      {!loading && entries.length === 0 && (
        <EmptyState icon={<IconBook />} title="Nenhum registro ainda" description="Registre sua primeira refeição acima." />
      )}

      {!loading && entries.length > 0 && (
        <ul className="list-rows">
          {entries.map((entry) => (
            <li key={entry.id} className="list-row" style={{ display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {entry.meal_kind && (
                      <span className="badge">{MEAL_LABELS[entry.meal_kind] ?? entry.meal_kind}</span>
                    )}
                    <span style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
                      {new Date(entry.logged_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div style={{ marginTop: 4 }}>{entry.description}</div>
                </div>
                <button
                  onClick={() => remove(entry.id)}
                  aria-label="Excluir registro"
                  style={{ color: "var(--color-error)", flexShrink: 0 }}
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
