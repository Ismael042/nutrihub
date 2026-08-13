import { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { colors } from "@nutrihub/shared";
import { patientFetch } from "../lib/api";

interface DiaryEntry {
  id: string;
  logged_at: string;
  meal_kind: string | null;
  description: string;
}

const MEALS: { key: string; label: string }[] = [
  { key: "breakfast", label: "Café da manhã" },
  { key: "lunch", label: "Almoço" },
  { key: "snack", label: "Lanche" },
  { key: "dinner", label: "Jantar" }
];

export default function DiaryScreen() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [description, setDescription] = useState("");
  const [mealKind, setMealKind] = useState("breakfast");

  const load = useCallback(async () => {
    const res = await patientFetch("/patient-portal/diary");
    if (res.ok) setEntries(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addEntry() {
    if (!description.trim()) return;
    const res = await patientFetch("/patient-portal/diary", {
      method: "POST",
      body: JSON.stringify({ meal_kind: mealKind, description: description.trim() })
    });
    if (res.ok) {
      setDescription("");
      load();
    }
  }

  async function removeEntry(id: string) {
    const res = await patientFetch(`/patient-portal/diary/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Diário alimentar</Text>

      <View style={styles.mealRow}>
        {MEALS.map((m) => (
          <TouchableOpacity
            key={m.key}
            style={[styles.mealChip, mealKind === m.key && styles.mealChipActive]}
            onPress={() => setMealKind(m.key)}
          >
            <Text style={mealKind === m.key ? styles.mealChipTextActive : styles.mealChipText}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="O que você comeu?"
          value={description}
          onChangeText={setDescription}
        />
        <TouchableOpacity style={styles.addButton} onPress={addEntry}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        style={{ marginTop: 16 }}
        renderItem={({ item }) => (
          <View style={styles.entry}>
            <View style={{ flex: 1 }}>
              <Text style={styles.entryMeta}>
                {MEALS.find((m) => m.key === item.meal_kind)?.label ?? item.meal_kind} ·{" "}
                {new Date(item.logged_at).toLocaleString("pt-BR")}
              </Text>
              <Text style={styles.entryText}>{item.description}</Text>
            </View>
            <TouchableOpacity onPress={() => removeEntry(item.id)}>
              <Text style={styles.remove}>Excluir</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nenhum registro ainda.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 16 },
  title: { fontSize: 22, fontWeight: "700", color: colors.dark, marginBottom: 12 },
  mealRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  mealChip: { borderWidth: 1, borderColor: "#ddd", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  mealChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  mealChipText: { color: colors.dark, fontSize: 13 },
  mealChipTextActive: { color: colors.white, fontSize: 13 },
  inputRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 },
  addButton: { backgroundColor: colors.primary, borderRadius: 8, width: 44, alignItems: "center", justifyContent: "center" },
  addButtonText: { color: colors.white, fontSize: 20, fontWeight: "700" },
  entry: { flexDirection: "row", alignItems: "flex-start", borderBottomWidth: 1, borderBottomColor: "#eee", paddingVertical: 10, gap: 8 },
  entryMeta: { fontSize: 12, color: "#888" },
  entryText: { fontSize: 15, color: colors.dark, marginTop: 2 },
  remove: { color: "crimson", fontSize: 13 },
  empty: { color: "#999" }
});
