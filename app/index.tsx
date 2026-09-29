import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Zap } from "lucide-react-native";

import { BrandMark } from "@/components/BrandMark";
import { LandingShowcase } from "@/components/LandingShowcase";
import { AnimatedIdeaCount } from "@/components/AnimatedIdeaCount";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenShell } from "@/components/ScreenShell";
import { colors, fonts } from "@/theme";
import { useAppProfile } from "@/context/AppProfileContext";
import { AccountSettings } from "@/components/AccountSettings";

export default function WelcomeScreen() {
  const router = useRouter();
  const { analysis, hydrated } = useAppProfile();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const compact = height < 740 || width < 360;

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BrandMark />
        <LandingShowcase />
        <View style={styles.heroCopy}>
          <Text accessibilityRole="header" style={[styles.title, compact && styles.compactTitle]}>You built the app.{"\n"}Now let's make{"\n"}<Text style={styles.highlight}>some noise.</Text></Text>
          <Text style={styles.subtitle}>
            HypeJuice learns your app inside out to make it your audience’s next obsession, creating organic AI UGC videos that make people stop, watch, and want in.
          </Text>
          <View accessible accessibilityRole="header" accessibilityLabel="100+ New Ideas from your AI Growth Agent in seconds" style={styles.experiments}>
            <View style={styles.experimentRow}>
              <AnimatedIdeaCount compact={compact} />
              <Text style={styles.experimentLabel}>New Ideas from your AI Growth Agent</Text>
            </View>
            <View style={styles.speedBadge}><Zap size={14} color={colors.yellow} fill={colors.yellow} /><Text style={styles.speedText}>IN SECONDS</Text></View>
          </View>
        </View>
        <AccountSettings />
      </ScrollView>
      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <PrimaryButton disabled={!hydrated} onPress={() => router.push(analysis?.confirmedAt ? "/(main)/home" : analysis ? "/brief" : "/connect")}>{analysis?.confirmedAt ? "Open my workspace" : analysis ? "Continue setup" : "Get Started"}</PrimaryButton>
        {analysis ? <Pressable accessibilityRole="button" onPress={() => router.push("/connect")} style={styles.another}><Text style={styles.footer}>Connect another app</Text></Pressable> : null}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 16, paddingBottom: 16, paddingHorizontal: 22, paddingTop: 14 },
  footer: { color: colors.muted, fontSize: 12, textAlign: "center" },
  heroCopy: { gap: 14 },
  title: { color: colors.ink, fontSize: 38, fontFamily: fonts.heading, letterSpacing: -1.4, lineHeight: 43, textAlign: "center" },
  compactTitle: { fontSize: 33, lineHeight: 39, letterSpacing: -1.2 },
  highlight: { backgroundColor: colors.yellow },
  subtitle: { color: colors.ink, fontSize: 18, lineHeight: 27, maxWidth: 460 },
  experiments: { alignSelf: "center", width: "100%", maxWidth: 320, backgroundColor: colors.yellow, borderRadius: 22, borderBottomLeftRadius: 8, padding: 12, gap: 3 },
  experimentRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  experimentLabel: { flex: 1, fontFamily: fonts.heading, color: colors.ink, fontSize: 16, lineHeight: 20 },
  speedBadge: { alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.ink, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, transform: [{ rotate: "-3deg" }] },
  speedText: { fontFamily: fonts.heading, color: "white", fontSize: 10, letterSpacing: 0.8 },
  cta: { paddingHorizontal: 22, paddingTop: 12, backgroundColor: colors.canvas, gap: 6 },
  another: { minHeight: 36, alignItems: "center", justifyContent: "center" },
});
