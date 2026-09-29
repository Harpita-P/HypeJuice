import { StyleSheet, View } from "react-native";
import { AgentAvatar } from "./AgentAvatar";
import { AgentTypingText } from "./AgentTypingText";
import { colors, fonts } from "@/theme";

const MESSAGE = "I made you 3 samples. Pick ones you like. I'll tailor what's next.";

export function AgentTasteMessage() {
  return <AgentMessage>{MESSAGE}</AgentMessage>;
}

export function AgentMessage({ children }: { children: string }) {
  return <View style={s.row}>
    <AgentAvatar />
    <View style={s.bubble}>
      <View pointerEvents="none" style={s.tail} />
      <AgentTypingText accessibilityRole="header" style={s.message}>{children}</AgentTypingText>
    </View>
  </View>;
}
const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, alignItems: "center", marginVertical: 2 },
  bubble: { flex: 1, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderBottomLeftRadius: 6, backgroundColor: "#FFF0A3" },
  tail: { position: "absolute", left: -4, top: "50%", width: 10, height: 10, backgroundColor: "#FFF0A3", transform: [{ rotate: "45deg" }] },
  message: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 23, color: colors.ink },
});
