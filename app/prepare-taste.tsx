import { useEffect, useRef, useState } from "react";
import { useIsFocused, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, Sparkles } from "lucide-react-native";
import { BrandMark } from "@/components/BrandMark";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenShell } from "@/components/ScreenShell";
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
    <View style={s.body}>
      <View style={s.spark}><Sparkles size={36} color={colors.ink} /></View>
      <Text accessibilityRole="header" style={s.title}>Finding your content vibe</Text>
      <Text style={s.copy}>{taste.batch?.status === "writing" ? "Writing three fresh takes for your app…" : "I’m putting together three videos for you to try."}</Text>
      {waiting ? <ActivityIndicator accessibilityLabel="Preparing Content Taste videos" color={colors.green} /> : null}
      <View style={s.dots}>{[0, 1, 2].map((index) => <View key={index} style={[s.dot, index < ready && s.done]} />)}</View>
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      {!waiting && taste.batch?.status === "failed" ? <PrimaryButton onPress={() => void taste.retry()}>Retry unfinished videos</PrimaryButton> : null}
      {!waiting && (!taste.batch || !feedback.ready) ? <PrimaryButton onPress={() => setRefreshAttempt((value) => value + 1)}>Retry connection</PrimaryButton> : null}
    </View>
  </ScreenShell>;
}
const s = StyleSheet.create({
  header: { paddingHorizontal: 22, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, justifyContent: "center", padding: 32, gap: 24 }, spark: { width: 88, height: 88, borderRadius: 32, backgroundColor: "#FFE044", alignItems: "center", justifyContent: "center", alignSelf: "center" },
  title: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 37, textAlign: "center", color: colors.ink }, copy: { fontSize: 16, lineHeight: 24, color: colors.muted, textAlign: "center" }, dots: { flexDirection: "row", gap: 8, justifyContent: "center" }, dot: { width: 36, height: 5, borderRadius: 4, backgroundColor: colors.border }, done: { backgroundColor: colors.green }, error: { fontSize: 13, lineHeight: 20, color: colors.danger, textAlign: "center" },
});
