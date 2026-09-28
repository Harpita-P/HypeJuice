import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { Hand, MoveHorizontal } from "lucide-react-native";

/** A short, non-interactive gesture cue; never captures a card swipe or video tap. */
export function SwipeHint() {
  const motion = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduced(value); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => { active = false; clearTimeout(timer); subscription.remove(); };
  }, []);
  useEffect(() => {
    if (reduced || !visible) { motion.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(motion, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(motion, { toValue: -1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(motion, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]), { iterations: 2 });
    animation.start();
    return () => animation.stop();
  }, [motion, reduced, visible]);
  if (!visible) return null;
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.position}>
    <Animated.View testID="swipe-hand-hint" style={[s.hint, { transform: [{ translateX: motion.interpolate({ inputRange: [-1, 1], outputRange: [-24, 24] }) }, { rotate: motion.interpolate({ inputRange: [-1, 1], outputRange: ["-12deg", "12deg"] }) }] }]}>
      <MoveHorizontal size={30} color="white" strokeWidth={1.5} />
      <Hand size={29} color="white" strokeWidth={1.7} />
    </Animated.View>
  </View>;
}
const s = StyleSheet.create({
  position: { position: "absolute", top: "38%", left: 0, right: 0, alignItems: "center" },
  hint: { alignItems: "center", gap: 2, padding: 10, borderRadius: 24, backgroundColor: "rgba(0,0,0,0.5)" },
});
