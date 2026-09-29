import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Play } from "lucide-react-native";
import { colors, fonts } from "@/theme";

// Intentionally no media source yet. Replace this placeholder with an approved,
// hosted showcase clip, not a bundled file or private user generated video.

export function LandingShowcase() {
  const { height } = useWindowDimensions();
  const compact = height < 740;
  const cardHeight = compact ? 146 : 176;
  const cardWidth = cardHeight * 9 / 16;
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    let changed = false;
    let animation: Animated.CompositeAnimation | undefined;
    const finish = () => { animation?.stop(); entrance.setValue(1); };
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", (reduced) => { changed = true; if (reduced) finish(); });
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!alive) return;
      if (reduced || changed) { finish(); return; }
      animation = Animated.timing(entrance, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false });
      animation.start();
    }).catch(finish);
    return () => { alive = false; listener.remove(); animation?.stop(); };
  }, [entrance]);

  return <View testID="landing-showcase" style={[s.stage, { height: cardHeight + 10 }]}>
    <Animated.View accessible accessibilityRole="image" accessibilityLabel="Example video placeholder" testID="landing-video-placeholder" style={[s.card, {
      width: cardWidth, height: cardHeight, opacity: entrance,
      transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }, { rotate: "-3deg" }],
    }]}>
      <View pointerEvents="none" style={s.disc} />
      <Text style={s.preview}>PREVIEW</Text>
      <View style={s.play}><Play size={18} color={colors.ink} fill={colors.ink} strokeWidth={1.4} /></View>
      <View style={s.caption}><Text style={s.captionText}>Your app deserves its main character moment</Text></View>
    </Animated.View>
  </View>;
}
const s = StyleSheet.create({
  stage: { justifyContent: "center", alignItems: "center" },
  card: { backgroundColor: "#D7C9F4", borderRadius: 18, padding: 8, borderWidth: 1, borderColor: "#B5A6D3", overflow: "hidden" },
  disc: { position: "absolute", width: 90, height: 90, borderRadius: 45, backgroundColor: "#FFFFFF30", top: 24, right: -30 },
  preview: { fontFamily: fonts.heading, fontSize: 7, letterSpacing: 1, color: colors.ink },
  play: { position: "absolute", alignSelf: "center", top: "31%", width: 34, height: 34, borderRadius: 17, backgroundColor: "#FFFFFF90", alignItems: "center", justifyContent: "center", paddingLeft: 2 },
  caption: { marginTop: "auto", backgroundColor: colors.ink, padding: 6, borderRadius: 7 },
  captionText: { color: "white", fontFamily: fonts.heading, fontSize: 9, lineHeight: 12, textAlign: "center" },
});
