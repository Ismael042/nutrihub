import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "@nutrihub/shared";
import { clearSession, patientFetch, type PatientSession } from "../lib/api";

interface PrescriptionItem {
  description: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
}

interface Prescription {
  id: string;
  kind: "supplement" | "phytotherapic";
  items: PrescriptionItem[];
}

interface Goal {
  id: string;
  description: string;
  target_date: string | null;
  achieved: boolean;
}

export default function MoreScreen({ patient, onLogout }: { patient: PatientSession; onLogout: () => void }) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    patientFetch("/patient-portal/prescriptions").then(async (res) => {
      if (res.ok) setPrescriptions(await res.json());
    });
    patientFetch("/patient-portal/goals").then(async (res) => {
      if (res.ok) setGoals(await res.json());
    });
  }, []);

  async function handleLogout() {
    await clearSession();
    onLogout();
  }

  return (
    <FlatList
      style={styles.container}
      data={[{ key: "content" }]}
      keyExtractor={(i) => i.key}
      renderItem={() => (
        <View>
          <Text style={styles.name}>{patient.name}</Text>
          <Text style={styles.email}>{patient.email}</Text>

          <Text style={styles.section}>Metas</Text>
          {goals.map((g) => (
            <View key={g.id} style={styles.card}>
              <Text style={styles.cardText}>{g.description}</Text>
              <Text style={styles.cardMeta}>
                {g.achieved ? "✓ Concluída" : "Em andamento"}
                {g.target_date ? ` · até ${g.target_date}` : ""}
              </Text>
            </View>
          ))}
          {goals.length === 0 && <Text style={styles.empty}>Nenhuma meta cadastrada.</Text>}

          <Text style={styles.section}>Prescrições</Text>
          {prescriptions.map((p) => (
            <View key={p.id} style={styles.card}>
              <Text style={styles.cardMeta}>{p.kind === "supplement" ? "Suplemento" : "Fitoterápico"}</Text>
              {p.items.map((item, i) => (
                <Text key={i} style={styles.cardText}>
                  • {item.description}
                  {[item.dosage, item.frequency, item.duration].filter(Boolean).length > 0
                    ? ` (${[item.dosage, item.frequency, item.duration].filter(Boolean).join(", ")})`
                    : ""}
                </Text>
              ))}
            </View>
          ))}
          {prescriptions.length === 0 && <Text style={styles.empty}>Nenhuma prescrição ainda.</Text>}

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 16 },
  name: { fontSize: 20, fontWeight: "700", color: colors.dark },
  email: { fontSize: 14, color: "#888", marginBottom: 16 },
  section: { fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5, color: colors.accent, marginTop: 16, marginBottom: 8 },
  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 10, padding: 12, marginBottom: 8 },
  cardText: { fontSize: 14, color: colors.dark, marginTop: 2 },
  cardMeta: { fontSize: 12, color: "#888" },
  empty: { color: "#999", fontSize: 14 },
  logoutButton: { marginTop: 24, marginBottom: 40, alignItems: "center", padding: 12, borderWidth: 1, borderColor: "crimson", borderRadius: 8 },
  logoutText: { color: "crimson", fontWeight: "600" }
});
