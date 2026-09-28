import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, fonts } from "@/theme";

export function BackToLibraryButton() {
  const router = useRouter();
  return <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace("/(main)/library")} style={({ pressed }) => [s.button, pressed && { opacity: 0.8 }]}><ArrowLeft size={18} color="white" /><Text style={s.label}>Back to Library</Text></Pressable>;
}
const s = StyleSheet.create({
  button: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 9, minHeight: 48, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, backgroundColor: colors.ink },
  label: { color: "white", fontSize: 14, fontFamily: fonts.heading },
});
