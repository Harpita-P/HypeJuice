import { useRouter } from "expo-router";
import { Link2, Sparkles, WandSparkles } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { BrandMark } from "@/components/BrandMark";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenShell } from "@/components/ScreenShell";
import { colors, fonts, radii } from "@/theme";
import { useAppProfile } from "@/context/AppProfileContext";

export default function WelcomeScreen() {
  const router = useRouter();
  const { analysis, hydrated } = useAppProfile();

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BrandMark />

        <View style={styles.heroCopy}>
          <Text style={styles.title}>Turn your app into content people want to watch.</Text>
          <Text style={styles.subtitle}>
            Give GrowthBanana the context once. It learns your product, collaborates on ideas,
            and helps you ship creator-style videos consistently.
          </Text>
        </View>

        <View style={styles.previewCard}>
          <View style={styles.previewTop}>
            <BrandMark compact inverted />
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LEARNING YOUR APP</Text>
            </View>
          </View>

          <View style={styles.chatBubble}>
            <Sparkles color={colors.yellow} size={20} />
            <Text style={styles.chatText}>
              I found your strongest product promise. Want me to turn it into three hook angles?
            </Text>
          </View>

          <View style={styles.sourceRow}>
            <View style={styles.sourceCard}>
              <Link2 color={colors.ink} size={19} />
              <View>
                <Text style={styles.sourceLabel}>App Store</Text>
                <Text style={styles.sourceMeta}>Features + positioning</Text>
              </View>
            </View>
            <View style={[styles.sourceCard, styles.sourceCardYellow]}>
              <WandSparkles color={colors.ink} size={19} />
              <View>
                <Text style={styles.sourceLabel}>App DNA</Text>
                <Text style={styles.sourceMeta}>Ready to shape</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.stepRow}>
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={styles.stepDot} />
          <View style={styles.stepDot} />
        </View>

        <PrimaryButton disabled={!hydrated} onPress={() => router.push(analysis?.confirmedAt ? "/(main)/home" : analysis ? "/brief" : "/connect")}>{analysis?.confirmedAt ? "Open my workspace" : analysis ? "Continue setup" : "Get Started"}</PrimaryButton>
        {analysis ? <Pressable accessibilityRole="button" onPress={() => router.push("/connect")}><Text style={styles.footer}>Connect another app</Text></Pressable> : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  chatBubble: {
    alignItems: "flex-start",
    backgroundColor: "#292C24",
    borderColor: "#3D4037",
    borderRadius: radii.medium,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 18,
  },
  chatText: { color: colors.surface, flex: 1, fontSize: 17, fontWeight: "600", lineHeight: 24 },
  content: { flexGrow: 1, gap: 28, paddingBottom: 30, paddingHorizontal: 22, paddingTop: 14 },
  eyebrow: { color: colors.green, fontSize: 12, fontWeight: "900", letterSpacing: 1.4 },
  footer: { color: colors.muted, fontSize: 12, textAlign: "center" },
  heroCopy: { gap: 14, marginTop: 8 },
  liveDot: { backgroundColor: colors.yellow, borderRadius: 4, height: 7, width: 7 },
  livePill: {
    alignItems: "center",
    backgroundColor: "#2E3129",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  liveText: { color: "#CFD2C8", fontSize: 9, fontWeight: "800", letterSpacing: 0.7 },
  previewCard: {
    backgroundColor: colors.black,
    borderRadius: radii.large,
    gap: 20,
    overflow: "hidden",
    padding: 20,
    shadowColor: colors.ink,
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 25,
  },
  previewTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sourceCard: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderRadius: radii.medium,
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 72,
    padding: 13,
  },
  sourceCardYellow: { backgroundColor: colors.yellow },
  sourceLabel: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  sourceMeta: { color: colors.muted, fontSize: 9, marginTop: 2 },
  sourceRow: { flexDirection: "row", gap: 10 },
  stepDot: { backgroundColor: colors.border, borderRadius: 5, height: 6, width: 6 },
  stepDotActive: { backgroundColor: colors.ink, width: 24 },
  stepRow: { flexDirection: "row", gap: 7, justifyContent: "center" },
  subtitle: { color: colors.muted, fontSize: 17, lineHeight: 25 },
  title: { color: colors.ink, fontSize: 40, fontFamily: fonts.heading, letterSpacing: -1.2, lineHeight: 46 },
});
