import { useEffect, useRef, type ReactNode } from "react";
import { AccessibilityInfo, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, Check } from "lucide-react-native";
import { ScreenShell } from "./ScreenShell";
import { BrandMark } from "./BrandMark";
import { colors, fonts } from "@/theme";

export function StudioStep({ step, title, subtitle, children, footer, onBack, navigationDisabled = false }: {
  step: number; title: string; subtitle: string; children: ReactNode; footer?: ReactNode;
  onBack?: () => void; navigationDisabled?: boolean;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const reduced = useRef(false);
  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then((value) => { reduced.current = value; }); const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => { reduced.current = value; }); return () => sub.remove(); }, []);
  useEffect(() => { enter.setValue(reduced.current ? 1 : 0); const animation = Animated.timing(enter, { toValue: 1, duration: reduced.current ? 0 : 220, useNativeDriver: true }); animation.start(); return () => animation.stop(); }, [step, enter]);
  return <ScreenShell>
    <View style={s.top}><View style={s.brandRow}>{onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Previous Studio step" disabled={navigationDisabled} onPress={onBack} style={s.back}><ArrowLeft size={20} color={colors.ink} /></Pressable> : null}<BrandMark size={36} /></View><Text style={s.stepCount}>STUDIO</Text></View>
    <View style={s.steps}>{["Creator", "Captions", "Angles", "Produce"].map((label, i) => <View key={label} style={s.step}><View style={[s.dot, i <= step && s.dotActive]}>{i < step ? <Check size={12} color="white" /> : <Text style={[s.dotText, i <= step && { color: "white" }]}>{i + 1}</Text>}</View><Text style={[s.stepText, i === step && { color: colors.ink }]}>{label}</Text></View>)}</View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <Animated.View testID="studio-step-body" style={{ flex: 1, opacity: enter, transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }] }}>
      <ScrollView key={step} directionalLockEnabled alwaysBounceHorizontal={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <View style={{ gap: 7 }}><Text accessibilityRole="header" style={s.title}>{title}</Text><Text style={s.subtitle}>{subtitle}</Text></View>
        {children}
      </ScrollView>
    </Animated.View>
    {footer ? <View style={s.footer}>{footer}</View> : null}
    </KeyboardAvoidingView>
  </ScreenShell>;
}
const s = StyleSheet.create({
  top: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, brandRow: { flexDirection: "row", alignItems: "center", gap: 8 }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: colors.surface }, brand: { fontFamily: fonts.heading, fontSize: 23, color: colors.ink }, stepCount: { fontSize: 10, letterSpacing: 1.5, color: colors.muted, fontWeight: "700" },
  steps: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 22, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: colors.border }, step: { flexDirection: "row", alignItems: "center", gap: 5 }, dot: { width: 21, height: 21, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#E7E5DC" }, dotActive: { backgroundColor: colors.ink }, dotText: { color: colors.muted, fontSize: 10 }, stepText: { color: colors.muted, fontSize: 11, fontFamily: fonts.heading },
  content: { padding: 22, gap: 22, paddingBottom: 28 }, title: { fontFamily: fonts.heading, fontSize: 29, lineHeight: 36, letterSpacing: -0.8, color: colors.ink }, subtitle: { fontSize: 14, lineHeight: 21, color: colors.muted }, footer: { paddingHorizontal: 22, paddingVertical: 12, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.canvas },
});
