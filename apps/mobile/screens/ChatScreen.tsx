import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { colors } from "@nutrihub/shared";
import { patientFetch } from "../lib/api";

interface ChatMessage {
  id: string;
  sender: "professional" | "patient";
  content: string;
  created_at: string;
}

const POLL_INTERVAL_MS = 5000;

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    const res = await patientFetch("/patient-portal/chat");
    if (res.ok) setMessages(await res.json());
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  async function send() {
    if (!content.trim()) return;
    const text = content.trim();
    setContent("");
    const res = await patientFetch("/patient-portal/chat", {
      method: "POST",
      body: JSON.stringify({ content: text })
    });
    if (res.ok) load();
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <Text style={styles.title}>Chat</Text>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.sender === "patient" ? styles.bubbleMine : styles.bubbleTheirs]}>
            <Text style={item.sender === "patient" ? styles.bubbleTextMine : styles.bubbleTextTheirs}>
              {item.content}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma mensagem ainda.</Text>}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Escreva uma mensagem..."
          value={content}
          onChangeText={setContent}
        />
        <TouchableOpacity style={styles.sendButton} onPress={send}>
          <Text style={styles.sendText}>Enviar</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 16 },
  title: { fontSize: 22, fontWeight: "700", color: colors.dark, marginBottom: 12 },
  bubble: { maxWidth: "80%", borderRadius: 12, padding: 10, marginBottom: 8 },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: colors.primary },
  bubbleTheirs: { alignSelf: "flex-start", backgroundColor: "#f0f0f0" },
  bubbleTextMine: { color: colors.white },
  bubbleTextTheirs: { color: colors.dark },
  empty: { color: "#999" },
  inputRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 },
  sendButton: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
  sendText: { color: colors.white, fontWeight: "600" }
});
