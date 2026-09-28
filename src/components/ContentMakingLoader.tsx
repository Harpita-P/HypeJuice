import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";
import { BrandMark } from "./BrandMark";
import { colors, fonts } from "@/theme";

export function ContentMakingLoader() {
  const motion = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduced(value); });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { active = false; sub.remove(); };
  }, []);
  useEffect(() => {
    if (reduced) { motion.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(motion, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(motion, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    animation.start(); return () => animation.stop();
  }, [motion, reduced]);
  return <View testID="content-making-loader" accessibilityLabel="Making your videos" style={s.loader}>
    <Animated.View style={[s.orb, { transform: [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }, { rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ["-8deg", "8deg"] }) }] }]}><BrandMark compact size={100} /></Animated.View>
    <Text style={s.title}>A little creative magic…</Text>
    <Text style={s.copy}>Your videos will appear right here.</Text>
  </View>;
}
const s = StyleSheet.create({
  loader: { minHeight: 280, alignItems: "center", justifyContent: "center", gap: 18 }, orb: { width: 100, height: 100, alignItems: "center", justifyContent: "center", marginBottom: 12 }, title: { fontSize: 20, fontFamily: fonts.heading, color: colors.ink }, copy: { fontSize: 14, color: colors.muted },
});
