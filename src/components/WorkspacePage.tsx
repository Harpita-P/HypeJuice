import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { BrandMark } from "./BrandMark";
import { ScreenShell } from "./ScreenShell";
import { colors, fonts } from "@/theme";

export function WorkspacePage({ title, subtitle, children, compact = false }: { title: string; subtitle: string; children: ReactNode; compact?: boolean }) {
  return <ScreenShell><ScrollView contentContainerStyle={workspace.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
    <View style={[workspace.brand, compact && { marginBottom: 0 }]}><BrandMark /></View>
    <View style={workspace.heading}><Text accessibilityRole="header" style={workspace.title}>{title}</Text><Text style={workspace.copy}>{subtitle}</Text></View>
    {children}
  </ScrollView></ScreenShell>;
}

export const workspace = StyleSheet.create({
  content: { padding: 22, gap: 22, paddingBottom: 32 },
  brand: { gap: 14, marginBottom: 8 },
  eyebrow: { color: colors.green, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  heading: { gap: 10 },
  title: { fontFamily: fonts.heading, color: colors.ink, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  sectionTitle: { fontFamily: fonts.heading, color: colors.ink, fontSize: 20, lineHeight: 28 },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  small: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 22, borderRadius: 26, gap: 14 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  chip: { backgroundColor: colors.canvas, borderRadius: 24, paddingVertical: 11, paddingHorizontal: 15 },
  selected: { backgroundColor: colors.yellow },
});
