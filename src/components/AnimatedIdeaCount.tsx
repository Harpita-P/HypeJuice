import { useEffect, useRef, useState } from "react";
import { useIsFocused } from "expo-router";
import { AccessibilityInfo, Animated, AppState, Easing, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/theme";

const counts = ["10+", "50+", "100+"];

export function AnimatedIdeaCount({ compact = false }: { compact?: boolean }) {
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [reduced, setReduced] = useState(true);
  const [index, setIndex] = useState(2);
  const visibility = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let alive = true; let changed = false;
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => { changed = true; setReduced(value); });
    const app = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (alive && !changed) setReduced(value); }).catch(() => {});
    return () => { alive = false; motion.remove(); app.remove(); };
  }, []);
  useEffect(() => {
    visibility.setValue(1);
    if (reduced) { setIndex(2); return; }
    if (!focused || !foreground) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let animation: Animated.CompositeAnimation;
    setIndex(0);
    const fade = (toValue: number, duration: number) => Animated.timing(visibility, {
      toValue, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true, isInteraction: false,
    });
    const schedule = () => {
      timer = setTimeout(() => {
        animation = fade(0, 180);
        animation.start(({ finished }) => {
          if (!alive || !finished) return;
          setIndex((current) => (current + 1) % counts.length);
          animation = fade(1, 240);
          animation.start(({ finished: entered }) => { if (alive && entered) schedule(); });
        });
      }, 1700);
    };
    schedule();
    return () => { alive = false; clearTimeout(timer); animation?.stop(); };
  }, [focused, foreground, reduced, visibility]);
  const numberStyle = [s.number, compact && s.compact];
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
    {/* Reserve the widest value so neighboring copy never shifts. */}
    <Text style={[...numberStyle, { opacity: 0 }]}>100+</Text>
    <Animated.Text testID="landing-idea-count" style={[...numberStyle, s.overlay, { opacity: visibility, transform: [{ translateY: visibility.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }]}>{counts[index]}</Animated.Text>
  </View>;
}
const s = StyleSheet.create({
  number: { fontFamily: fonts.heading, color: colors.ink, fontSize: 48, lineHeight: 54, letterSpacing: -2 },
  compact: { fontSize: 42, lineHeight: 48 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0 },
});
