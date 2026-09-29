import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useIsFocused } from "expo-router";
import { AppState, FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { BrandMark } from "@/components/BrandMark";
import { AgentMessage } from "@/components/AgentTasteMessage";
import { PrimaryButton } from "@/components/PrimaryButton";
import { RenderedVideo } from "@/components/RenderedVideo";
import { ScreenShell } from "@/components/ScreenShell";
import { ContentMakingLoader } from "@/components/ContentMakingLoader";
import { SwipeDecisionCard } from "@/components/SwipeDecisionCard";
import { useContent } from "@/context/ContentContext";
import { colors, fonts } from "@/theme";
import type { ContentConcept } from "@shared/content";
import { discoverFeedItems } from "@shared/discover";
import { useFirstSwipeHint } from "@/lib/use-first-swipe-hint";

export default function HomeScreen() {
  const { concepts, discover, feedback, review } = useContent();
  const { batch, error, preparing, refresh, ensureInitial } = discover;
  const items = discoverFeedItems(concepts).filter((item) => discover.batchIds.includes(item.discoverOrigin?.batchId ?? ""));
  const [height, setHeight] = useState(600);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const previousIds = useRef<string[]>([]);
  const itemIds = items.map((item) => item.id).join("|");
  const removed = previousIds.current.some((id) => !items.some((item) => item.id === id));
  const visibleId = previousIds.current[activeRef.current];
  const visibleIndex = items.findIndex((item) => item.id === visibleId);
  const initialIndex = removed && visibleIndex >= 0 ? visibleIndex : Math.min(activeRef.current, items.length);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const list = useRef<FlatList<ContentConcept | null>>(null);
  const focused = useIsFocused();
  const [readyVideoId, setReadyVideoId] = useState<string | null>(null);
  useEffect(() => { if (!focused || !appActive) setReadyVideoId(null); }, [focused, appActive]);
  const showSwipeHint = useFirstSwipeHint(items[active]?.id,
    appActive && feedback.ready && !feedback.busy && readyVideoId === items[active]?.id, focused);
  const latestDiscover = useRef(discover); latestDiscover.current = discover;
  useEffect(() => { if (focused) void (latestDiscover.current.batch ? refresh() : ensureInitial()); }, [focused, refresh, ensureInitial]);
  const refreshFeedback = feedback.refresh;
  useEffect(() => { if (focused) void refreshFeedback(); }, [focused, refreshFeedback]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setAppActive(state === "active"));
    return () => subscription.remove();
  }, []);
  useLayoutEffect(() => {
    const ids = itemIds ? itemIds.split("|") : [];
    previousIds.current = ids;
    activeRef.current = initialIndex; setActive(initialIndex);
    // Preserve the current position when batches are appended or content changes.
    if (removed) list.current?.scrollToOffset({ offset: initialIndex * height, animated: false });
  }, [itemIds]);

  const waiting = preparing || discover.loading || (!batch && !error);
  const needsRetry = Boolean(error || batch?.status === "failed" || feedback.error);
  async function explore() {
    if (feedback.error) { await refreshFeedback(); return; }
    if (batch?.status === "failed") await discover.retry();
    else if (!batch) await ensureInitial();
    else await discover.generate();
  }
  return <ScreenShell>
    <View style={s.header}><BrandMark /><Text style={s.home}>HOME</Text></View>
    <View style={s.heading}>
      <Text accessibilityRole="header" style={s.title}>Discover</Text>
      <AgentMessage>I’ve made you tons of fresh content. Scroll to explore.</AgentMessage>
    </View>
    {feedback.error ? <Text accessibilityRole="alert" style={s.feedbackError}>{feedback.error}</Text> : null}
    <View style={s.feed} onLayout={(event) => setHeight(Math.max(1, event.nativeEvent.layout.height))}>
      <FlatList ref={list} testID="discover-feed" data={[...items, null]} keyExtractor={(item) => item?.id ?? "more"} pagingEnabled snapToInterval={height} decelerationRate="fast" showsVerticalScrollIndicator={false}
        directionalLockEnabled alwaysBounceHorizontal={false} scrollEnabled={!feedback.busy}
        getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
        onScroll={(event) => { const index = Math.round(event.nativeEvent.contentOffset.y / height); activeRef.current = index; setActive(index); }} scrollEventThrottle={100}
        extraData={{ active, focused, appActive, batch, waiting, needsRetry, height, feedbackReady: feedback.ready, feedbackBusy: feedback.busy, showSwipeHint }}
        initialNumToRender={2} maxToRenderPerBatch={3} windowSize={3}
        renderItem={({ item, index }) => <View style={{ height, paddingHorizontal: 16, paddingBottom: 8 }}>
          {item?.rendered ? <SwipeDecisionCard key={item.id} disabled={!focused || active !== index || !feedback.ready || feedback.busy}
            showSwipeHint={active === index && showSwipeHint}
            keepLabel={item.status === "loved" ? "Saved" : "Save Content"} tossLabel={item.status === "tossed" ? "Tossed" : "Toss"} keepAccessibilityLabel={"Save Content: " + item.title} tossAccessibilityLabel={"Toss " + item.title}
            onDecision={async (choice) => {
              const saved = await review(item.id, choice === "keep" ? "loved" : "tossed");
              if (saved && activeRef.current === index) {
                const next = Math.min(index + 1, items.length);
                activeRef.current = next; setActive(next);
                list.current?.scrollToOffset({ offset: next * height, animated: false });
              }
              return saved;
            }}>
            {focused && appActive && active === index
              ? <RenderedVideo key={item.rendered.jobId} uri={item.rendered.url} jobId={item.rendered.jobId} post={item.post} height={Math.max(120, height - 82)} autoPlay compactActions hideDownload swipeMode onReadyToPlay={() => setReadyVideoId(item.id)} />
              : <View style={[s.poster, { height: Math.max(120, height - 82) }]} />}
          </SwipeDecisionCard> : <ScrollView contentContainerStyle={s.more} showsVerticalScrollIndicator={false}>
            {waiting ? <ContentMakingLoader /> : <>
              <View style={s.shapes} pointerEvents="none"><View style={s.limeShape} /><View style={s.purpleShape}><Sparkles size={42} color={colors.ink} /></View><View style={s.peachShape} /></View>
              <Text accessibilityRole="header" style={s.moreTitle}>{needsRetry ? "Let’s give that another try" : "Want some more fresh content?"}</Text>
              {needsRetry ? <Text accessibilityRole="alert" style={s.error}>Your saved videos are safe. We couldn’t finish that request.</Text> : null}
              <PrimaryButton variant="yellow" disabled={feedback.busy} onPress={() => void explore()}>{needsRetry ? "Try again" : "Yes, explore 5 more"}</PrimaryButton>
            </>}
          </ScrollView>}
        </View>} />
    </View>
  </ScreenShell>;
}
const s = StyleSheet.create({
  header: { paddingHorizontal: 22, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  home: { fontSize: 10, letterSpacing: 1.5, color: colors.muted },
  heading: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 12, gap: 8 },
  title: { color: colors.ink, fontFamily: fonts.heading, fontSize: 29 },
  feed: { flex: 1 },
  poster: { borderRadius: 28, backgroundColor: colors.ink },
  more: { flexGrow: 1, borderRadius: 28, borderTopRightRadius: 80, borderBottomLeftRadius: 64, padding: 26, backgroundColor: "#E8E0FF", justifyContent: "center", gap: 26 },
  moreTitle: { fontSize: 30, lineHeight: 38, fontFamily: fonts.heading, color: colors.ink, letterSpacing: -0.6 },
  shapes: { height: 130, justifyContent: "center", alignItems: "center" },
  purpleShape: { width: 112, height: 112, borderRadius: 24, borderTopRightRadius: 58, backgroundColor: "#BCABFF", alignItems: "center", justifyContent: "center", transform: [{ rotate: "-12deg" }] },
  limeShape: { position: "absolute", left: 10, bottom: 0, width: 58, height: 58, borderRadius: 29, borderBottomLeftRadius: 6, backgroundColor: "#B5EF53", transform: [{ rotate: "14deg" }] },
  peachShape: { position: "absolute", right: 12, top: 0, width: 48, height: 48, borderRadius: 12, borderTopLeftRadius: 30, backgroundColor: "#FFA480", transform: [{ rotate: "18deg" }] },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  feedbackError: { color: colors.danger, fontSize: 12, lineHeight: 17, paddingHorizontal: 22, paddingBottom: 8 },
});
