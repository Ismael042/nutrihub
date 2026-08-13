import { useEffect, useState } from "react";
import { SafeAreaView, StatusBar as RNStatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { colors } from "@nutrihub/shared";
import { getStoredPatient, getToken, type PatientSession } from "./lib/api";
import LoginScreen from "./screens/LoginScreen";
import PlansScreen from "./screens/PlansScreen";
import ChatScreen from "./screens/ChatScreen";
import DiaryScreen from "./screens/DiaryScreen";
import MoreScreen from "./screens/MoreScreen";

type Tab = "plans" | "chat" | "diary" | "more";

const TABS: { key: Tab; label: string }[] = [
  { key: "plans", label: "Plano" },
  { key: "diary", label: "Diário" },
  { key: "chat", label: "Chat" },
  { key: "more", label: "Mais" }
];

export default function App() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [patient, setPatient] = useState<PatientSession | null>(null);
  const [tab, setTab] = useState<Tab>("plans");

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const stored = await getStoredPatient();
      if (token && stored) setPatient(stored);
      setCheckingSession(false);
    })();
  }, []);

  if (checkingSession) return null;

  if (!patient) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoginScreen onLoggedIn={setPatient} />
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={{ flex: 1 }}>
        {tab === "plans" && <PlansScreen />}
        {tab === "diary" && <DiaryScreen />}
        {tab === "chat" && <ChatScreen />}
        {tab === "more" && (
          <MoreScreen
            patient={patient}
            onLogout={() => {
              setPatient(null);
              setTab("plans");
            }}
          />
        )}
      </View>
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} style={styles.tabItem} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
    paddingTop: RNStatusBar.currentHeight ?? 0
  },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingVertical: 10
  },
  tabItem: { flex: 1, alignItems: "center" },
  tabLabel: { fontSize: 13, color: "#999" },
  tabLabelActive: { color: colors.primary, fontWeight: "700" }
});
