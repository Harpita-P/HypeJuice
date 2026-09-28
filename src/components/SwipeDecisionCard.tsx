import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { Check, X } from "lucide-react-native";
import { colors, fonts } from "@/theme";
import { SwipeHint } from "./SwipeHint";

export type SwipeChoice = "keep" | "toss";
export function SwipeDecisionCard({ children, disabled = false, onDecision, keepLabel = "Keep angle", tossLabel = "Toss", keepAccessibilityLabel, tossAccessibilityLabel }: {
  children: ReactNode; disabled?: boolean; onDecision: (choice: SwipeChoice) => Promise<boolean>;
  keepLabel?: string; tossLabel?: string; keepAccessibilityLabel?: string; tossAccessibilityLabel?: string;
}) {
  const x = useRef(new Animated.Value(0)).current;
  const mounted = useRef(true); const locked = useRef(false); const reduced = useRef(false);
  const [busy, setBusy] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const current = useRef({ disabled, onDecision }); current.current = { disabled, onDecision };
  useEffect(() => {
    mounted.current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { reduced.current = value; });
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => { reduced.current = value; });
    return () => { mounted.current = false; x.stopAnimation(); listener.remove(); };
  }, [x]);
  function reset() { Animated.spring(x, { toValue: 0, useNativeDriver: true, tension: 90, friction: 12 }).start(); }
  async function decide(choice: SwipeChoice) {
    if (locked.current || current.current.disabled) { reset(); return; }
    setInteracted(true);
    locked.current = true; setBusy(true);
    await new Promise<void>((resolve) => Animated.timing(x, { toValue: reduced.current ? 0 : choice === "keep" ? 550 : -550, duration: reduced.current ? 0 : 180, useNativeDriver: true }).start(() => resolve()));
    if (!mounted.current) return;
    try { await current.current.onDecision(choice); }
    catch { /* The caller owns the visible save error; keep this card retryable. */ }
    finally { if (mounted.current) { x.setValue(0); locked.current = false; setBusy(false); } }
  }
  const responder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => !current.current.disabled && !locked.current && Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onMoveShouldSetPanResponderCapture: (_, g) => !current.current.disabled && !locked.current && Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderGrant: () => setInteracted(true),
    onPanResponderMove: (_, g) => x.setValue(g.dx),
    onPanResponderRelease: (_, g) => { if (Math.abs(g.dx) > 85) void decide(g.dx > 0 ? "keep" : "toss"); else reset(); },
    // Once a horizontal card drag begins, don't hand it to an ancestor scroller.
    onPanResponderTerminationRequest: () => false,
    onPanResponderTerminate: reset,
  })).current;
  return <View style={s.deck}>
    <View style={s.stack} pointerEvents="none" />
    <Animated.View testID="swipe-decision-card" {...responder.panHandlers} style={{ transform: [{ translateX: x }, { rotate: x.interpolate({ inputRange: [-350, 0, 350], outputRange: ["-8deg", "0deg", "8deg"], extrapolate: "clamp" }) }] }}>
      {children}
      {!disabled && !interacted ? <SwipeHint /> : null}
      <Animated.View testID="swipe-keep-sheen" pointerEvents="none" style={[s.sheen, s.keepSheen, { opacity: x.interpolate({ inputRange: [0, 100], outputRange: [0, 1], extrapolate: "clamp" }) }]} />
      <Animated.View testID="swipe-toss-sheen" pointerEvents="none" style={[s.sheen, s.tossSheen, { opacity: x.interpolate({ inputRange: [-100, 0], outputRange: [1, 0], extrapolate: "clamp" }) }]} />
      <Animated.View pointerEvents="none" style={[s.stamp, s.keepStamp, { opacity: x.interpolate({ inputRange: [0, 70], outputRange: [0, 1], extrapolate: "clamp" }) }]}><Check color="white" size={22} /><Text style={s.stampText}>{keepLabel}</Text></Animated.View>
      <Animated.View pointerEvents="none" style={[s.stamp, s.tossStamp, { opacity: x.interpolate({ inputRange: [-70, 0], outputRange: [1, 0], extrapolate: "clamp" }) }]}><X color="white" size={22} /><Text style={s.stampText}>{tossLabel}</Text></Animated.View>
    </Animated.View>
    <View style={s.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={tossAccessibilityLabel ?? tossLabel} disabled={disabled || busy} onPress={() => void decide("toss")} style={[s.action, (disabled || busy) && s.disabled]}><View style={s.tossIcon}><X color={colors.danger} size={22} /></View><Text style={s.actionText}>{tossLabel}</Text></Pressable>
      {busy ? <ActivityIndicator accessibilityLabel="Saving preference" size="small" color={colors.green} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={keepAccessibilityLabel ?? keepLabel} disabled={disabled || busy} onPress={() => void decide("keep")} style={[s.action, (disabled || busy) && s.disabled]}><Text style={s.actionText}>{keepLabel}</Text><View style={s.keepIcon}><Check color="white" size={22} /></View></Pressable>
    </View>
  </View>;
}
const s = StyleSheet.create({
  deck: { gap: 14, overflow: "hidden" }, stack: { position: "absolute", top: 12, left: 10, right: 10, bottom: 64, borderRadius: 28, backgroundColor: colors.greenSoft, transform: [{ rotate: "2deg" }] },
  sheen: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: 28, borderWidth: 3 },
  keepSheen: { backgroundColor: "rgba(14, 211, 105, 0.38)", borderColor: "#0ED369" },
  tossSheen: { backgroundColor: "rgba(255, 48, 70, 0.38)", borderColor: "#FF3046" },
  stamp: { position: "absolute", top: 24, flexDirection: "row", alignItems: "center", gap: 6, padding: 14, borderRadius: 16 },
  keepStamp: { left: 18, backgroundColor: "#48642E", transform: [{ rotate: "-8deg" }] }, tossStamp: { right: 18, backgroundColor: colors.danger, transform: [{ rotate: "8deg" }] },
  stampText: { color: "white", fontFamily: fonts.heading, fontSize: 18 }, actions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  action: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 8 }, actionText: { fontFamily: fonts.heading, fontSize: 14, color: colors.ink },
  tossIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#FBECE8", borderWidth: 1, borderColor: "#EBD5CD" },
  keepIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#48642E" }, hint: { fontSize: 11, color: colors.muted }, disabled: { opacity: 0.45 },
});
