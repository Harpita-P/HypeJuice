import { useEffect, useRef, useState } from "react";
import { useIsFocused } from "expo-router";
import { AccessibilityInfo, Animated, AppState, Easing, StyleSheet, View } from "react-native";
import { FileText, Film, Lightbulb, Sparkles, Users } from "lucide-react-native";
import { AgentAvatar } from "./AgentAvatar";
import { colors } from "@/theme";

/** Ambient thinking animation, not a timer based claim of task completion. */
export function AgentWorkVisual({ active, mode = "analysis" }: { active: boolean; mode?: "analysis" | "content" }) {
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [reduced, setReduced] = useState(true);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true; let changed = false;
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => { changed = true; setReduced(value); });
    const app = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (alive && !changed) setReduced(value); }).catch(() => {});
    return () => { alive = false; motion.remove(); app.remove(); };
  }, []);
  useEffect(() => {
    pulse.setValue(0);
    if (!active || !focused || !foreground || reduced) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start(); return () => animation.stop();
  }, [active, focused, foreground, reduced, pulse]);
  const First = mode === "analysis" ? FileText : Film;
  const Second = mode === "analysis" ? Users : Sparkles;
  return <View style={s.stage} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
    <Animated.View style={[s.orbit, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.9] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1.06] }) }] }]} />
    <View style={s.center}><AgentAvatar size={72} /></View>
    <Animated.View style={[s.token, s.one, { transform: [{ translateY: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }, { rotate: "-12deg" }] }]}><First size={23} color={colors.ink} /></Animated.View>
    <Animated.View style={[s.token, s.two, { transform: [{ translateY: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) }, { rotate: "12deg" }] }]}><Second size={23} color={colors.ink} /></Animated.View>
    <View style={[s.token, s.three]}><Lightbulb size={20} color={colors.ink} /></View>
  </View>;
}
const s = StyleSheet.create({
  stage: { width: 232, height: 152, alignSelf: "center", alignItems: "center", justifyContent: "center" },
  orbit: { position: "absolute", width: 158, height: 140, borderRadius: 80, borderWidth: 2, borderColor: "#BCACED", borderStyle: "dashed" },
  center: { width: 108, height: 108, backgroundColor: "#E6DBFF", borderRadius: 54, justifyContent: "center", alignItems: "center" },
  token: { position: "absolute", width: 47, height: 47, alignItems: "center", justifyContent: "center", borderRadius: 15 },
  one: { left: 14, top: 13, backgroundColor: colors.yellow, borderBottomLeftRadius: 4 },
  two: { right: 11, bottom: 13, backgroundColor: "#BAE977", borderTopRightRadius: 5 },
  three: { top: 0, right: 27, width: 35, height: 35, borderRadius: 18, backgroundColor: "#FFC4A5" },
});
