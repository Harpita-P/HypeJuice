import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ArrowUp, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LiftoffChatInput } from "@shared/liftoff";
import { askLiftoff } from "@/lib/liftoff-api";
import { AgentMessage } from "./AgentTasteMessage";
import { colors, fonts } from "@/theme";

const suggestions = ["Which video has the most views?", "What should I try next?"];
export function LiftoffChat({ visible, onClose, jobIds }: { visible: boolean; onClose: () => void; jobIds: string[] }) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<LiftoffChatInput["messages"]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false); const mounted = useRef(true);
  const scroll = useRef<ScrollView>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function send(text = draft) {
    if (locked.current || !text.trim()) return;
    locked.current = true; setBusy(true); setError("");
    const next = [...messages, { role: "user" as const, text: text.trim() }];
    setMessages(next); setDraft("");
    try {
      const result = await askLiftoff({ jobIds, messages: next.slice(-11) });
      if (mounted.current) setMessages([...next, { role: "assistant", text: result.answer }]);
    } catch (reason) {
      if (mounted.current) { setMessages(messages); setDraft(text); setError(reason instanceof Error ? reason.message : "Couldn’t reach your agent. Try again."); }
    } finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <View style={s.header}><Text style={s.title}>Your growth agent</Text><Pressable accessibilityRole="button" accessibilityLabel="Close agent chat" onPress={onClose} style={s.close}><X size={22} color={colors.ink} /></Pressable></View>
        <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.messages} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          <AgentMessage>Let’s see what’s clicking. What would you like to know?</AgentMessage>
          {!messages.length ? <View style={{ gap: 8 }}>{suggestions.map((text) => <Pressable key={text} accessibilityRole="button" onPress={() => void send(text)} disabled={busy} style={s.suggestion}><Text style={s.copy}>{text}</Text></Pressable>)}</View> : null}
          {messages.map((message, index) => message.role === "assistant" ? <AgentMessage key={index}>{message.text}</AgentMessage> : <View key={index} style={s.user}><Text selectable style={s.copy}>{message.text}</Text></View>)}
          {busy ? <ActivityIndicator accessibilityLabel="Agent is checking your results" color={colors.green} /> : null}
          {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
        </ScrollView>
        <Text style={s.notice}>When you ask, captions and tracked counts go to Gemini. No video files or comment text.</Text>
        <View style={s.composer}>
          <TextInput accessibilityLabel="Ask your growth agent" placeholder="Ask me anything…" value={draft} onChangeText={setDraft} maxLength={2400} multiline style={s.input} editable={!busy} />
          <Pressable accessibilityRole="button" accessibilityLabel="Send question" disabled={busy || !draft.trim()} onPress={() => void send()} style={[s.send, (busy || !draft.trim()) && { opacity: 0.4 }]}><ArrowUp size={24} color={colors.ink} /></Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "#171A1370" },
  sheet: { height: "88%", maxWidth: 560, width: "100%", alignSelf: "center", borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: colors.canvas, padding: 20, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, title: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  messages: { gap: 18, paddingVertical: 12 }, user: { alignSelf: "flex-end", maxWidth: "88%", padding: 16, backgroundColor: "#DED3FF", borderRadius: 22, borderBottomRightRadius: 5 },
  copy: { fontSize: 15, lineHeight: 22, color: colors.ink }, suggestion: { padding: 14, borderRadius: 18, borderWidth: 1, borderColor: "#CABAFF", backgroundColor: "#F0EAFF" },
  composer: { flexDirection: "row", gap: 10, alignItems: "flex-end", padding: 8, borderRadius: 26, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, fontSize: 16, color: colors.ink, padding: 10, maxHeight: 110, minHeight: 44 }, send: { width: 44, height: 44, backgroundColor: colors.yellow, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  notice: { fontSize: 10, lineHeight: 15, color: colors.muted }, error: { fontSize: 13, color: colors.danger },
});
