import { FileText, Sparkles, Users } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, Modal, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/theme";

export function AppLearningModal({ visible }: { visible: boolean }) {
  const shuffle = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (!visible || reduceMotion) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(shuffle, { toValue: 1, duration: 850, useNativeDriver: true, isInteraction: false }),
      Animated.timing(shuffle, { toValue: 0, duration: 850, useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => { animation.stop(); shuffle.setValue(0); };
  }, [visible, reduceMotion, shuffle]);

  return <Modal visible={visible} transparent animationType={reduceMotion ? "none" : "fade"} statusBarTranslucent onRequestClose={() => {}}>
    <View style={styles.backdrop}>
      <View accessibilityViewIsModal style={styles.panel}>
        <View style={styles.pages} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.sheet, styles.backSheet]} />
          <Animated.View style={[styles.sheet, styles.frontSheet, { transform: [
            { translateX: shuffle.interpolate({ inputRange: [0, 1], outputRange: [-5, 8] }) },
            { rotate: shuffle.interpolate({ inputRange: [0, 1], outputRange: ["-7deg", "6deg"] }) },
          ] }]}><FileText size={32} color={colors.ink} strokeWidth={1.6} /></Animated.View>
        </View>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title}>I’m learning about your app…</Text>
        <View style={styles.topics}>
          <View style={styles.topic}><FileText size={19} color={colors.green} /><Text style={styles.topicText}>What it does</Text></View>
          <View style={styles.topic}><Sparkles size={19} color={colors.green} /><Text style={styles.topicText}>Its overall vibe</Text></View>
          <View style={styles.topic}><Users size={19} color={colors.green} /><Text style={styles.topicText}>Its strongest potential audiences</Text></View>
        </View>
        <ActivityIndicator accessibilityLabel="Learning about your app" color={colors.green} />
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#171A1370" },
  panel: { width: "100%", maxWidth: 360, backgroundColor: colors.surface, borderRadius: 32, padding: 28, alignItems: "center", gap: 24 },
  pages: { width: 80, height: 90, marginTop: 6 },
  sheet: { position: "absolute", width: 65, height: 80, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#D5DAC7" },
  backSheet: { backgroundColor: colors.greenSoft, left: 12, top: 5, transform: [{ rotate: "10deg" }] },
  frontSheet: { backgroundColor: colors.yellow, left: 2, top: 0 },
  title: { color: colors.ink, fontSize: 28, lineHeight: 35, fontFamily: fonts.heading, letterSpacing: -0.5, textAlign: "center" },
  topics: { width: "100%", gap: 16 },
  topic: { flexDirection: "row", gap: 12, alignItems: "center" },
  topicText: { flex: 1, color: colors.muted, fontSize: 14, lineHeight: 20 },
});
