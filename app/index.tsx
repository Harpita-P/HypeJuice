import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Zap } from "lucide-react-native";

import { BrandMark } from "@/components/BrandMark";
import { LandingShowcase } from "@/components/LandingShowcase";
import { AnimatedIdeaCount } from "@/components/AnimatedIdeaCount";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenShell } from "@/components/ScreenShell";
import { colors, fonts } from "@/theme";
import { useAppProfile } from "@/context/AppProfileContext";

export default function WelcomeScreen() {
  const router = useRouter();
  const { analysis, hydrated } = useAppProfile();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const compact = height - insets.top - insets.bottom < 700 || width < 360;

  return (
    <ScreenShell>
      <View testID="landing-content" style={[styles.content, compact && styles.compactContent]}>
        <BrandMark size={compact ? 32 : 42} />
        <LandingShowcase />
        <View style={[styles.heroCopy, compact && styles.compactHero]}>
          <Text accessibilityRole="header" style={[styles.title, compact && styles.compactTitle]}>You built the app.{"\n"}Now let's{"\n"}<Text style={styles.highlight}>make some noise.</Text></Text>
          <Text style={[styles.subtitle, compact && styles.compactSubtitle]}>
            HypeJuice learns your app inside out to make it your audience’s next obsession, creating fun AI UGC style videos that make people stop, watch, and want in.
          </Text>
          <View accessible accessibilityRole="header" accessibilityLabel="100+ New Ideas from your AI Growth Agent in seconds" style={styles.experiments}>
            <View style={styles.experimentRow}>
              <AnimatedIdeaCount compact={compact} />
              <View style={styles.experimentCopy}>
                <Text style={[styles.experimentLabel, compact && styles.compactLabel]}>New Ideas from your AI Growth Agent</Text>
                <View style={styles.speedBadge}><Zap size={12} color={colors.yellow} fill={colors.yellow} /><Text style={styles.speedText}>IN SECONDS</Text></View>
              </View>
            </View>
          </View>
        </View>
      </View>
      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <PrimaryButton disabled={!hydrated} onPress={() => router.push(analysis?.confirmedAt ? "/(main)/home" : analysis ? "/brief" : "/paywall")}>{analysis?.confirmedAt ? "Open my workspace" : analysis ? "Continue setup" : "Get Started"}</PrimaryButton>
        {analysis ? <Pressable accessibilityRole="button" onPress={() => router.push("/connect")} style={styles.another}><Text style={styles.footer}>Connect another app</Text></Pressable> : null}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, minHeight: 0, gap: 8, paddingBottom: 4, paddingHorizontal: 22, paddingTop: 8 },
  compactContent: { gap: 4, paddingTop: 4 },
  footer: { color: colors.muted, fontSize: 12, textAlign: "center" },
  heroCopy: { gap: 10 },
  compactHero: { gap: 8 },
  title: { color: colors.ink, fontSize: 32, fontFamily: fonts.heading, letterSpacing: -1.2, lineHeight: 37, textAlign: "center" },
  compactTitle: { fontSize: 24, lineHeight: 28, letterSpacing: -0.8 },
  highlight: { backgroundColor: colors.yellow },
  subtitle: { color: colors.ink, fontSize: 18, lineHeight: 27, maxWidth: 460 },
  compactSubtitle: { fontSize: 14, lineHeight: 19 },
  experiments: { alignSelf: "center", width: "100%", maxWidth: 320, backgroundColor: colors.yellow, borderRadius: 22, borderBottomLeftRadius: 8, padding: 10 },
  experimentRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  experimentCopy: { flex: 1, gap: 5 },
  experimentLabel: { fontFamily: fonts.heading, color: colors.ink, fontSize: 16, lineHeight: 20 },
  compactLabel: { fontSize: 13, lineHeight: 16 },
  speedBadge: { alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.ink, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, transform: [{ rotate: "-3deg" }] },
  speedText: { fontFamily: fonts.heading, color: "white", fontSize: 10, letterSpacing: 0.8 },
  cta: { paddingHorizontal: 22, paddingTop: 12, backgroundColor: colors.canvas, gap: 6 },
  another: { minHeight: 36, alignItems: "center", justifyContent: "center" },
});
