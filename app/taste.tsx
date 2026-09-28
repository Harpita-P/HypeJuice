import { useEffect, useState } from "react";
import { useIsFocused, useRouter } from "expo-router";
import { ArrowLeft, Heart, Sparkles, X } from "lucide-react-native";
import { ActivityIndicator, ScrollView, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandMark } from "@/components/BrandMark";
import { OnboardingStep } from "@/components/OnboardingStep";
import { PrimaryButton } from "@/components/PrimaryButton";
import { RenderedVideo } from "@/components/RenderedVideo";
import { ScreenShell } from "@/components/ScreenShell";
import { useAppProfile } from "@/context/AppProfileContext";
import { useContent } from "@/context/ContentContext";
import { tasteReviewComplete } from "@shared/feedback";
import { colors, fonts } from "@/theme";

export default function TasteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const focused = useIsFocused();
  const { analysis, setAnalysis } = useAppProfile();
  const { concepts: allConcepts, taste, feedback, review } = useContent();
  const { refresh: refreshTaste } = taste;
  const { refresh: refreshFeedback } = feedback;
  const [index, setIndex] = useState(0);
  const [entering, setEntering] = useState(false);
  const [entryError, setEntryError] = useState("");
  useEffect(() => {
    if (focused) { void refreshTaste(); void refreshFeedback(); }
  }, [focused, refreshTaste, refreshFeedback]);
  useEffect(() => { setIndex(0); }, [taste.batch?.id]);
  const concepts = allConcepts.filter((item) => item.collection === "taste" && item.discoverOrigin?.batchId === taste.batch?.id && item.rendered)
    .sort((a, b) => (a.discoverOrigin?.index ?? 0) - (b.discoverOrigin?.index ?? 0));
  const rated = concepts.filter((item) => item.status !== "pending").length;
  const item = concepts[index];
  const complete = tasteReviewComplete(concepts, feedback.ready, feedback.busy) && taste.batch?.status === "succeeded";
  const hasThree = concepts.length === 3;
  const saving = Boolean(item?.rendered && feedback.saving[item.rendered.jobId]);
  async function rate(verdict: "loved" | "tossed") {
    if (!item) return;
    const saved = await review(item.id, verdict);
    if (saved && index < 2) setIndex(index + 1);
  }

  return <ScreenShell>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Back to setup" onPress={() => router.back()} style={s.back}><ArrowLeft color={colors.ink} size={21} /></Pressable><BrandMark compact /></View>
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <OnboardingStep number={3} title="Content Taste" />
      <Text accessibilityRole="header" style={[s.title, hasThree && s.reviewTitle]}>{hasThree ? "Find your content vibe" : "Let’s find your\ncontent vibe"}</Text>
      {!hasThree ? <View style={s.agent}><Sparkles size={21} color={colors.green} /><Text style={s.copy}>I’ll try three different caption directions. Love what feels right, toss what doesn’t—I’ll remember for the next batch.</Text></View> : null}
      {hasThree && item?.rendered ? <View style={s.card}>
        <View style={s.tabs}>{concepts.map((entry, position) => <Pressable key={entry.id} accessibilityRole="tab" accessibilityLabel={"Video " + (position + 1)} accessibilityState={{ selected: index === position }} disabled={feedback.busy} onPress={() => setIndex(position)} style={[s.tab, index === position && s.tabSelected]}>
          <Text style={s.tabText}>{position + 1} / 3{entry.status === "loved" ? " ♥" : entry.status === "tossed" ? " ×" : ""}</Text>
        </Pressable>)}</View>
        {focused ? <RenderedVideo key={item.rendered.jobId} uri={item.rendered.url} jobId={item.rendered.jobId} post={item.post} height={Math.max(340, Math.min(660, (height - insets.top - insets.bottom) * 0.65))} autoPlay compactActions /> : null}
        <View style={s.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={"Toss video " + (index + 1)} accessibilityState={{ selected: item.status === "tossed", disabled: !feedback.ready || feedback.busy }} disabled={!feedback.ready || feedback.busy} onPress={() => void rate("tossed")} style={[s.action, item.status === "tossed" && s.tossed]}>
            <X size={20} color={colors.ink} /><Text style={s.actionText}>Toss</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={"Love video " + (index + 1)} accessibilityState={{ selected: item.status === "loved", disabled: !feedback.ready || feedback.busy }} disabled={!feedback.ready || feedback.busy} onPress={() => void rate("loved")} style={[s.action, s.love]}>
            <Heart size={20} color={colors.ink} fill={item.status === "loved" ? colors.ink : "transparent"} /><Text style={s.actionText}>Love it</Text>
          </Pressable>
        </View>
        {saving ? <ActivityIndicator color={colors.green} /> : <Text style={s.note}>{item.status === "loved" ? "Saved to Favorites. You can edit captions from Library later." : item.status === "tossed" ? "Noted. I’ll use this as a signal to try a different caption direction." : "Love it saves to Favorites—not Launch Bucket."}</Text>}
      </View> : <View style={s.card}>
        <Text style={s.sectionTitle}>{taste.preparing ? taste.batch?.status === "writing" ? "Writing three fresh takes…" : "Putting your videos together…" : taste.batch?.status === "failed" ? "Let’s finish your three videos" : "Three videos, made for your app"}</Text>
        <Text style={s.note}>{taste.preparing ? concepts.length + " of 3 videos ready. Using saved creator footage and your app demos." : "Fresh hook and demo captions over saved clips. No new Higgsfield generation; Gemini text and server/storage usage still apply."}</Text>
        {taste.preparing || taste.loading ? <ActivityIndicator color={colors.green} /> : taste.batch?.status === "failed" ? <PrimaryButton onPress={() => void taste.retry()}>{taste.batch.jobs.length ? "Retry unfinished videos" : "Try captions again"}</PrimaryButton> : !taste.batch ? <PrimaryButton disabled={!taste.config?.ready || !feedback.ready} onPress={() => void taste.generate()}>{taste.hasPendingRequest ? "Retry connection (same batch)" : "Make my 3 videos"}</PrimaryButton> : null}
      </View>}
      {taste.config && !taste.config.ready ? <Text style={s.error}>Setup needed: {taste.config.missing.join(", ")}</Text> : null}
      {taste.error || taste.batch?.error ? <Text accessibilityRole="alert" style={s.error}>{taste.error || taste.batch?.error}</Text> : null}
      {feedback.error ? <Text accessibilityRole="alert" style={s.error}>{feedback.error}</Text> : null}
      {entryError ? <Text accessibilityRole="alert" style={s.error}>{entryError}</Text> : null}
      <Pressable accessibilityRole="button" disabled={feedback.busy || taste.loading} onPress={() => { void refreshTaste(); void refreshFeedback(); }} style={s.refresh}><Text style={s.note}>Refresh videos & saved preferences</Text></Pressable>
    </ScrollView>
    <View style={[s.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
      <Text accessibilityLiveRegion="polite" style={s.progress}>{rated} of 3 rated · {feedback.busy ? "Saving your preference…" : "Your choices steer Discover"}</Text>
      <PrimaryButton disabled={!analysis || !complete || entering} loading={entering} onPress={async () => {
        if (!analysis || !complete || entering) return;
        setEntering(true); setEntryError("");
        try {
          await setAnalysis({ ...analysis, confirmedAt: new Date().toISOString() });
          router.replace("/(main)/home");
        } catch { setEntryError("Couldn’t open your workspace. Your saved preferences are safe—try again."); }
        finally { setEntering(false); }
      }}>Open my workspace</PrimaryButton>
    </View>
  </ScreenShell>;
}

const s = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingVertical: 8 },
  back: { padding: 12, borderRadius: 24, backgroundColor: colors.surface },
  content: { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  reviewTitle: { fontSize: 23, lineHeight: 29 },
  title: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 36, color: colors.ink, letterSpacing: -0.6 },
  agent: { flexDirection: "row", gap: 12, padding: 16, backgroundColor: colors.greenSoft, borderRadius: 22 },
  copy: { flex: 1, fontSize: 14, lineHeight: 21, color: colors.ink },
  note: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  card: { padding: 8, gap: 10, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { color: colors.ink, fontFamily: fonts.heading, fontSize: 20 },
  tabs: { flexDirection: "row", gap: 8 },
  tab: { flex: 1, minHeight: 44, padding: 10, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  tabSelected: { backgroundColor: colors.yellowSoft },
  tabText: { color: colors.ink, fontFamily: fonts.heading, fontSize: 13 },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1, minHeight: 52, borderRadius: 26, gap: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  actionText: { color: colors.ink, fontFamily: fonts.heading, fontSize: 15 },
  tossed: { backgroundColor: colors.greenSoft },
  love: { backgroundColor: colors.yellow },
  error: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  refresh: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  footer: { paddingHorizontal: 22, paddingTop: 10, gap: 8, backgroundColor: colors.canvas },
  progress: { textAlign: "center", fontSize: 12, color: colors.muted },
});
