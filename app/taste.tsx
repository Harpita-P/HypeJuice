import { useCallback, useEffect, useRef, useState } from "react";
import { useIsFocused, useRouter } from "expo-router";
import { useVideoPlayer, VideoView, type VideoPlayer } from "expo-video";
import { ArrowLeft, Check } from "lucide-react-native";
import { ActivityIndicator, AppState, ScrollView, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandMark } from "@/components/BrandMark";
import { AgentTasteMessage } from "@/components/AgentTasteMessage";
import { OnboardingStep } from "@/components/OnboardingStep";
import { PrimaryButton } from "@/components/PrimaryButton";
import { PreloadedRenderedVideo } from "@/components/RenderedVideo";
import { ScreenShell } from "@/components/ScreenShell";
import { SwipeDecisionCard } from "@/components/SwipeDecisionCard";
import { ContentMakingLoader } from "@/components/ContentMakingLoader";
import { useAppProfile } from "@/context/AppProfileContext";
import { useContent } from "@/context/ContentContext";
import { tasteReviewComplete } from "@shared/feedback";
import { colors, fonts } from "@/theme";

const prepareTastePlayer = (player: VideoPlayer) => { player.muted = true; player.loop = true; };

export default function TasteScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [cardWidth, setCardWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [headingHeight, setHeadingHeight] = useState(120);
  const bottomPadding = Math.max(12, insets.bottom);
  // Reserve room for headings, swipe actions (52 + 14 gap), and progress (28 + 8).
  // Fit the complete footage inside the available space without cropping it.
  const videoHeight = Math.max(120, Math.min(
    (cardWidth || Math.min(width, 560) - 52) * 16 / 9,
    (viewportHeight || height - insets.top - 52) - headingHeight - 10 - 102 - bottomPadding,
  ));
  const focused = useIsFocused();
  const { analysis, setAnalysis } = useAppProfile();
  const { concepts: allConcepts, taste, discover, feedback, review } = useContent();
  const { ensureInitial: prepareDiscover } = discover;
  const { refresh: refreshTaste } = taste;
  const { refresh: refreshFeedback } = feedback;
  const [index, setIndex] = useState(0);
  const [introDoneBatch, setIntroDoneBatch] = useState<string | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => subscription.remove();
  }, []);
  const [entering, setEntering] = useState(false);
  const [entryError, setEntryError] = useState("");
  const entryLocked = useRef(false);
  const autoEnteredBatch = useRef<string | null>(null);
  useEffect(() => {
    if (focused) { void refreshTaste(); void refreshFeedback(); }
  }, [focused, refreshTaste, refreshFeedback]);
  useEffect(() => { setIndex(0); }, [taste.batch?.id]);
  useEffect(() => { if (focused) void prepareDiscover(); }, [focused, prepareDiscover]);
  const concepts = allConcepts.filter((item) => item.collection === "taste" && item.discoverOrigin?.batchId === taste.batch?.id && item.rendered)
    .sort((a, b) => (a.discoverOrigin?.index ?? 0) - (b.discoverOrigin?.index ?? 0));
  const item = concepts[index];
  const complete = tasteReviewComplete(concepts, feedback.ready, feedback.busy) && taste.batch?.status === "succeeded";
  // A Taste batch always has three slots. Keep their buffered players alive
  // across card remounts instead of replacing the rear preview on every swipe.
  const firstPlayer = useVideoPlayer(concepts[0]?.rendered?.url ?? null, prepareTastePlayer);
  const secondPlayer = useVideoPlayer(concepts[1]?.rendered?.url ?? null, prepareTastePlayer);
  const thirdPlayer = useVideoPlayer(concepts[2]?.rendered?.url ?? null, prepareTastePlayer);
  const players = [firstPlayer, secondPlayer, thirdPlayer];
  useEffect(() => {
    [firstPlayer, secondPlayer, thirdPlayer].forEach((player, position) => {
      if (position !== index || !focused || !foreground || complete) player.pause();
    });
  }, [firstPlayer, secondPlayer, thirdPlayer, index, focused, foreground, complete]);
  const hasThree = concepts.length === 3;
  const introVisible = index === 0 && Boolean(taste.batch?.id) && introDoneBatch !== taste.batch?.id && !complete;
  // The gesture belongs to the front card, not a media-ready event that can
  // arrive late. Show it during the intro and give it its full duration after.
  const showSwipeHint = focused && foreground && !entering;
  useEffect(() => {
    const batchId = taste.batch?.id;
    if (!focused || !foreground || !hasThree || !batchId || !introVisible) return;
    const timer = setTimeout(() => setIntroDoneBatch(batchId), 3000);
    return () => clearTimeout(timer);
  }, [focused, foreground, hasThree, taste.batch?.id, introVisible]);
  const discoverReady = allConcepts.filter((entry) => entry.collection === "discover" && entry.rendered && discover.batchIds.includes(entry.discoverOrigin?.batchId ?? "")).length >= 5;
  useEffect(() => {
    if (focused && !hasThree) router.replace("/prepare-taste");
  }, [focused, hasThree, router]);
  const saving = Boolean(item?.rendered && feedback.saving[item.rendered.jobId]);
  const openWorkspace = useCallback(async () => {
    if (!analysis || !complete || !discoverReady || entryLocked.current) return;
    entryLocked.current = true; setEntering(true); setEntryError("");
    try {
      await setAnalysis({ ...analysis, confirmedAt: new Date().toISOString() });
      router.replace("/(main)/home");
    } catch { setEntryError("Couldn’t open your workspace. Your saved preferences are safe. Try again."); }
    finally { entryLocked.current = false; setEntering(false); }
  }, [analysis, complete, discoverReady, setAnalysis, router]);
  useEffect(() => {
    if (!focused || !complete || !discoverReady || !taste.batch?.id || autoEnteredBatch.current === taste.batch.id) return;
    // Completion is based on persisted ratings, never just the card index.
    // One automatic attempt per batch; errors expose an explicit retry button.
    const batchId = taste.batch.id;
    // Let the personalized-content welcome be seen, even if Discover is already ready.
    const timer = setTimeout(() => {
      autoEnteredBatch.current = batchId;
      void openWorkspace();
    }, 1800);
    return () => clearTimeout(timer);
  }, [focused, complete, discoverReady, taste.batch?.id, openWorkspace]);
  async function rate(verdict: "loved" | "tossed") {
    if (!item) return false;
    const saved = await review(item.id, verdict);
    if (saved && index < 2) setIndex(index + 1);
    return saved;
  }

  if (!hasThree) return <ScreenShell><View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18 }}><BrandMark /><ActivityIndicator color={colors.green} /></View></ScreenShell>;
  if (complete) return <ScreenShell><View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 18 }}>
    <BrandMark />
    {discoverReady ? <View style={s.welcome}>
      <View style={s.welcomeCheck}><Check size={38} color={colors.ink} /></View>
      <Text accessibilityRole="header" style={s.title}>Awesome, I’ve got your vibe.</Text>
      <Text style={s.welcomeCopy}>I’ve personalized some fresh content for you. Let’s explore.</Text>
    </View> : <><Text accessibilityRole="header" style={s.title}>Getting your personalized content ready</Text><ContentMakingLoader /></>}
    {!discoverReady && (discover.error || discover.batch?.error) ? <Text accessibilityRole="alert" style={s.error}>{discover.error || discover.batch?.error}</Text> : null}
    {!discoverReady && !discover.preparing && !discover.loading && (discover.error || discover.batch?.status === "failed") ? <PrimaryButton onPress={() => void (discover.batch?.status === "failed" ? discover.retry() : discover.batch ? discover.refresh() : prepareDiscover())}>Retry preparing Discover</PrimaryButton> : null}
    {entryError ? <><Text accessibilityRole="alert" style={s.error}>{entryError}</Text><PrimaryButton disabled={entering} loading={entering} onPress={() => void openWorkspace()}>Retry opening workspace</PrimaryButton></> : null}
  </View></ScreenShell>;
  return <ScreenShell>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Back to setup" disabled={entering} onPress={() => router.back()} style={s.back}><ArrowLeft color={colors.ink} size={21} /></Pressable><BrandMark /></View>
    <ScrollView onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)} directionalLockEnabled alwaysBounceHorizontal={false} contentContainerStyle={[s.content, { paddingBottom: bottomPadding }]} showsVerticalScrollIndicator={false}>
      <View onLayout={(event) => setHeadingHeight(event.nativeEvent.layout.height)} style={{ gap: 4 }}>
      <OnboardingStep number={3} title="Content Taste" />
      <AgentTasteMessage />
      </View>
      {hasThree && item?.rendered ? <View onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)} style={{ gap: 8, marginHorizontal: 10 }}>
        <SwipeDecisionCard key={item.id} lowerSwipeHint showSwipeHint={showSwipeHint} hintDuringIntro={introVisible} disabled={!feedback.ready || feedback.busy || !focused || entering || introVisible} keepLabel="Love it" tossLabel="Toss" keepAccessibilityLabel={"Love video " + (index + 1)} tossAccessibilityLabel={"Toss video " + (index + 1)} onDecision={(choice) => rate(choice === "keep" ? "loved" : "tossed")} rearCards={concepts.slice(index + 1).map((next, offset) => ({ id: next.id, content: <View style={{ height: videoHeight }}>{focused && next.rendered ? <VideoView player={players[index + offset + 1]} nativeControls={false} contentFit="contain" playsInline surfaceType="textureView" style={{ width: "100%", height: "100%" }} /> : null}</View> }))}>
          {focused ? <PreloadedRenderedVideo player={players[index]} uri={item.rendered.url} jobId={item.rendered.jobId} height={videoHeight} contentFit="contain" dimmed={introVisible} autoPlay={foreground} hideExportActions swipeMode /> : <View style={{ height: videoHeight }} />}
        </SwipeDecisionCard>
        <View style={s.reviewProgress}>{concepts.map((entry, position) => <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={"Review video " + (position + 1)} disabled={feedback.busy || introVisible} onPress={() => setIndex(position)} style={s.progressTarget}><View style={[s.progressBar, position === index && { backgroundColor: colors.ink }, entry.status !== "pending" && { backgroundColor: colors.green }]} /></Pressable>)}{saving ? <ActivityIndicator size="small" color={colors.green} /> : complete ? <Check size={16} color={colors.green} /> : null}</View>
      </View> : null}
      {taste.config && !taste.config.ready ? <Text style={s.error}>Setup needed: {taste.config.missing.join(", ")}</Text> : null}
      {taste.error || taste.batch?.error ? <Text accessibilityRole="alert" style={s.error}>{taste.error || taste.batch?.error}</Text> : null}
      {feedback.error ? <Text accessibilityRole="alert" style={s.error}>{feedback.error}</Text> : null}
      {entryError ? <Text accessibilityRole="alert" style={s.error}>{entryError}</Text> : null}
      {!hasThree || taste.error || feedback.error ? <Pressable accessibilityRole="button" disabled={feedback.busy || taste.loading} onPress={() => { void refreshTaste(); void refreshFeedback(); }} style={s.refresh}><Text style={s.note}>Refresh videos & saved preferences</Text></Pressable> : null}
    </ScrollView>
  </ScreenShell>;
}

const s = StyleSheet.create({
  reviewProgress: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }, progressTarget: { minHeight: 28, minWidth: 44, justifyContent: "center" }, progressBar: { height: 4, borderRadius: 4, backgroundColor: colors.border },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingVertical: 4 },
  back: { padding: 12, borderRadius: 24, backgroundColor: colors.surface },
  content: { paddingHorizontal: 16, gap: 10 },
  reviewTitle: { fontSize: 23, lineHeight: 29 },
  title: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 36, color: colors.ink, letterSpacing: -0.6 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  refresh: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  welcome: { padding: 24, gap: 20, backgroundColor: "#B5EF53", borderRadius: 30, borderTopRightRadius: 64 },
  welcomeCheck: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#FFE044", alignItems: "center", justifyContent: "center", transform: [{ rotate: "-8deg" }] },
  welcomeCopy: { fontSize: 17, lineHeight: 26, color: colors.ink },
});
