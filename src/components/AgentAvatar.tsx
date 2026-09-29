import { useEffect, useRef } from "react";
import { useIsFocused } from "expo-router";
import { AccessibilityInfo, Animated, AppState, Easing, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/theme";

/** The carton’s four-point sparkle, used consistently for agent messages. */
export function AgentAvatar({ size = 40 }: { size?: number }) {
  const focused = useIsFocused();
  const sparkle = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let alive = true;
    let reduced = true;
    let foreground = AppState.currentState === "active";
    let preferenceChanged = false;
    let animation: Animated.CompositeAnimation | undefined;
    const update = () => {
      animation?.stop();
      sparkle.setValue(1);
      if (!alive || !focused || !foreground || reduced) return;
      const twinkle = (toValue: number, duration: number) => Animated.timing(sparkle, {
        toValue, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false,
      });
      animation = Animated.loop(Animated.sequence([
        Animated.delay(1400), twinkle(0, 600), Animated.delay(400), twinkle(1, 600),
      ]));
      animation.start();
    };
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      preferenceChanged = true; reduced = value; update();
    });
    const appState = AppState.addEventListener("change", (state) => {
      foreground = state === "active"; update();
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (!alive || preferenceChanged) return;
      reduced = value; update();
    }).catch(() => { /* Keep the star still if the motion preference is unavailable. */ });
    return () => { alive = false; animation?.stop(); sparkle.setValue(1); motion.remove(); appState.remove(); };
  }, [focused, sparkle]);

  return <View accessibilityRole="image" accessibilityLabel="HypeJuice agent" style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <Svg width={size * 0.7} height={size * 0.7} viewBox="0 0 32 32">
      <Path d="M15 3 Q16 1 17 3 L19 10 Q20 12 22 13 L29 15 Q31 16 29 17 L22 19 Q20 20 19 22 L17 29 Q16 31 15 29 L13 22 Q12 20 10 19 L3 17 Q1 16 3 15 L10 13 Q12 12 13 10 Z" fill="white" transform="rotate(-10 16 16) translate(1.6 0) scale(0.9 1)" />
    </Svg>
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{ position: "absolute", top: size * 0.12, right: size * 0.12, width: size * 0.22, height: size * 0.22, opacity: sparkle, transform: [{ scale: sparkle }] }}>
      <Svg width="100%" height="100%" viewBox="0 0 32 32">
        <Path d="M16 1 Q18 13 31 16 Q18 19 16 31 Q14 19 1 16 Q14 13 16 1 Z" fill="white" />
      </Svg>
    </Animated.View>
  </View>;
}
