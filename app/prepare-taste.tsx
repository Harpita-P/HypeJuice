import { useEffect, useRef, useState } from "react";
import { useIsFocused, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, Check, Film, Sparkles } from "lucide-react-native";
import { BrandMark } from "@/components/BrandMark";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenShell } from "@/components/ScreenShell";
import { AgentWorkVisual } from "@/components/AgentWorkVisual";
import { AgentTypingText } from "@/components/AgentTypingText";
import { useContent } from "@/context/ContentContext";
import { useAppProfile } from "@/context/AppProfileContext";
import { colors, fonts } from "@/theme";

// Generation lives between demo setup and Content Taste, not on the review page.
export default function PrepareTasteScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const { analysis, hydrated } = useAppProfile();
  const { taste, feedback, concepts } = useContent();
  const latest = useRef(taste); latest.current = taste;
  const [initializing, setInitializing] = useState(true);
  const [refreshAttempt, setRefreshAttempt] = useState(0);
  const navigated = useRef(false);
  const { refresh } = taste;
  const refreshFeedback = feedback.refresh;
  useEffect(() => {
    if (hydrated && !analysis && focused) router.replace("/connect");
  }, [hydrated, analysis, focused, router]);
  useEffect(() => {
    if (!analysis) return;
    let active = true;
    setInitializing(true);
    void (async () => {
      // Refresh first: revisiting this transition must not submit another batch.
      const [existing] = await Promise.all([refresh(), refreshFeedback()]);
      if (!active) return;
      if (existing === null) await latest.current.generate();
      if (active) setInitializing(false);
    })();
    return () => { active = false; };
  }, [analysis?.analyzedAt, refresh, refreshFeedback, refreshAttempt]);
  const ready = concepts.filter((item) => item.collection === "taste" && item.discoverOrigin?.batchId === taste.batch?.id && item.rendered).length;
  useEffect(() => {
    if (!focused || initializing || !feedback.ready || taste.batch?.status !== "succeeded" || ready !== 3 || navigated.current) return;
    navigated.current = true;
    router.replace("/taste");
  }, [focused, initializing, feedback.ready, taste.batch?.status, ready, router]);
  const waiting = initializing || taste.preparing || taste.loading;
  const error = taste.error || taste.batch?.error || feedback.error;
  return <ScreenShell>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Back to demo clips" onPress={() => router.back()} style={s.back}><ArrowLeft size={20} color={colors.ink} /></Pressable><BrandMark /></View>
    <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
      <AgentWorkVisual active={waiting && focused} mode="content" />
      <AgentTypingText accessibilityRole="header" style={s.title}>Let’s turn your app into a conversation.</AgentTypingText>
      <Text style={s.copy}>I’m creating three different takes for your app. Your picks will shape what I make next.</Text>
      <View style={s.recipe}><View style={s.recipeIcon}><Sparkles size={23} color={colors.ink} /></View><View style={{ flex: 1, gap: 5 }}><Text style={s.recipeTitle}>Your app. Three fresh angles.</Text><Text style={s.recipeCopy}>Audience hooks, creator moments, and your app in action.</Text></View></View>
      <View style={s.activity}>
        {waiting ? <ActivityIndicator accessibilityLabel="Preparing Content Taste videos" color={colors.green} size="small" /> : null}
        <Text accessibilityLiveRegion="polite" style={s.status}>{error && !waiting ? "I couldn’t finish just yet. Let’s try again." : taste.batch?.status === "writing" ? "Finding hooks worth stopping for" : taste.batch?.status === "rendering" ? "Bringing your three takes to life" : "Shaping your first creative directions"}</Text>
      </View>
      <View accessibilityLabel={`${ready} of 3 sample videos ready`} style={s.dots}>{[0, 1, 2].map((index) => <View key={index} style={[s.dot, index < ready && s.done]}>{index < ready ? <Check size={17} color={colors.ink} /> : <Film size={17} color={colors.muted} />}</View>)}</View>
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      {!waiting && taste.batch?.status === "failed" ? <PrimaryButton onPress={() => void taste.retry()}>Retry unfinished videos</PrimaryButton> : null}
      {!waiting && (!taste.batch || !feedback.ready) ? <PrimaryButton onPress={() => setRefreshAttempt((value) => value + 1)}>Retry connection</PrimaryButton> : null}
    </ScrollView>
  </ScreenShell>;
}
const s = StyleSheet.create({
  header: { paddingHorizontal: 22, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  body: { flexGrow: 1, justifyContent: "center", padding: 26, gap: 20, paddingBottom: 40 },
  title: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 37, textAlign: "center", color: colors.ink }, copy: { fontSize: 16, lineHeight: 24, color: colors.muted, textAlign: "center" },
  recipe: { padding: 18, backgroundColor: "#E6DBFF", borderRadius: 24, borderTopRightRadius: 46, flexDirection: "row", gap: 12, alignItems: "center" }, recipeIcon: { width: 44, height: 44, backgroundColor: "#CBB6FC", borderRadius: 14, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-8deg" }] },
  recipeTitle: { fontFamily: fonts.heading, color: colors.ink, fontSize: 16, lineHeight: 22 }, recipeCopy: { fontSize: 13, lineHeight: 20, color: colors.muted },
  activity: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }, status: { flexShrink: 1, fontSize: 13, lineHeight: 20, color: colors.green, textAlign: "center" },
  dots: { flexDirection: "row", gap: 9, justifyContent: "center" }, dot: { width: 40, height: 32, borderRadius: 12, backgroundColor: "#EAE7DC", justifyContent: "center", alignItems: "center" }, done: { backgroundColor: "#BCE775" }, error: { fontSize: 13, lineHeight: 20, color: colors.danger, textAlign: "center" },
});
