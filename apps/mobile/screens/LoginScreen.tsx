import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { colors } from "@nutrihub/shared";
import { login, type PatientSession } from "../lib/api";

export default function LoginScreen({ onLoggedIn }: { onLoggedIn: (patient: PatientSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!email || !password) {
      setError("Preencha e-mail e senha");
      return;
    }
    setLoading(true);
    try {
      const patient = await login(email.trim(), password);
      onLoggedIn(patient);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Nutri<Text style={{ color: colors.accent }}>Hub</Text>
      </Text>
      <Text style={styles.subtitle}>Acesse seu plano alimentar, prescrições e converse com seu nutricionista.</Text>

      <TextInput
        style={styles.input}
        placeholder="E-mail"
        placeholderTextColor="#999"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        placeholderTextColor="#999"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Entrar</Text>}
      </TouchableOpacity>

      <Text style={styles.hint}>
        Seu acesso é criado pelo seu nutricionista — peça o e-mail e a senha usados no cadastro.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: "700", color: colors.dark, textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#666", textAlign: "center", marginBottom: 20 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: colors.primary, borderRadius: 8, padding: 14, alignItems: "center", marginTop: 8 },
  buttonText: { color: colors.white, fontWeight: "600", fontSize: 16 },
  error: { color: "crimson", textAlign: "center" },
  hint: { fontSize: 12, color: "#999", textAlign: "center", marginTop: 16 }
});
