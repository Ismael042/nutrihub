import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "@nutrihub/shared";
import { patientFetch } from "../lib/api";

interface DietPlan {
  id: string;
  name: string;
  created_at: string;
}

interface MealItem {
  id: string;
  food_name: string;
  quantity: number;
  unit: string;
}

interface Meal {
  id: string;
  name: string;
  items: MealItem[];
}

interface DietPlanDetail extends DietPlan {
  meals: Meal[];
}

export default function PlansScreen() {
  const [plans, setPlans] = useState<DietPlan[]>([]);
  const [selected, setSelected] = useState<DietPlanDetail | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await patientFetch("/patient-portal/diet-plans");
    if (res.ok) setPlans(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openPlan(id: string) {
    const res = await patientFetch(`/patient-portal/diet-plans/${id}`);
    if (res.ok) setSelected(await res.json());
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (selected) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => setSelected(null)}>
          <Text style={styles.back}>← Meus planos</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{selected.name}</Text>
        <FlatList
          data={selected.meals}
          keyExtractor={(m) => m.id}
          renderItem={({ item: meal }) => (
            <View style={styles.mealCard}>
              <Text style={styles.mealName}>{meal.name}</Text>
              {meal.items.map((item) => (
                <Text key={item.id} style={styles.mealItem}>
                  • {item.food_name} — {item.quantity} {item.unit}
                </Text>
              ))}
              {meal.items.length === 0 && <Text style={styles.empty}>Sem itens ainda.</Text>}
            </View>
          )}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meus planos alimentares</Text>
      <FlatList
        data={plans}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.planCard} onPress={() => openPlan(item.id)}>
            <Text style={styles.planName}>{item.name}</Text>
            <Text style={styles.planDate}>{new Date(item.created_at).toLocaleDateString("pt-BR")}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nenhum plano alimentar ainda.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 16 },
  title: { fontSize: 22, fontWeight: "700", color: colors.dark, marginBottom: 12 },
  back: { color: colors.primary, marginBottom: 12, fontSize: 15 },
  planCard: { borderWidth: 1, borderColor: "#eee", borderRadius: 10, padding: 14, marginBottom: 10 },
  planName: { fontSize: 16, fontWeight: "600", color: colors.dark },
  planDate: { fontSize: 13, color: "#888", marginTop: 4 },
  mealCard: { borderWidth: 1, borderColor: "#eee", borderRadius: 10, padding: 14, marginBottom: 10 },
  mealName: { fontSize: 16, fontWeight: "700", color: colors.primary, marginBottom: 6 },
  mealItem: { fontSize: 14, color: colors.dark, marginBottom: 2 },
  empty: { color: "#999", marginTop: 8 }
});
