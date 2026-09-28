import { useEffect, useRef, useState } from "react";
import { useIsFocused } from "expo-router";
import { ActivityIndicator, AppState, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { BrandMark } from "@/components/BrandMark";
import { ContentActions } from "@/components/ContentCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { RenderedVideo } from "@/components/RenderedVideo";
import { ScreenShell } from "@/components/ScreenShell";
import { useContent } from "@/context/ContentContext";
import { colors, fonts } from "@/theme";
import type { ContentConcept } from "@shared/content";

export default function HomeScreen() {
  const { concepts, discover, feedback } = useContent();
  const { batch, config, error, preparing, refresh } = discover;
  const items = concepts.filter((item) => item.collection === "discover" && item.rendered)
    .sort((a, b) => a.batch - b.batch || (a.discoverOrigin?.index ?? 0) - (b.discoverOrigin?.index ?? 0));
  const [height, setHeight] = useState(600);
  const [active, setActive] = useState(0);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const list = useRef<FlatList<ContentConcept | null>>(null);
  const focused = useIsFocused();
  useEffect(() => { if (focused) void refresh(); }, [focused, refresh]);
  const refreshFeedback = feedback.refresh;
  useEffect(() => { if (focused) void refreshFeedback(); }, [focused, refreshFeedback]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setAppActive(state === "active"));
    return () => subscription.remove();
  }, []);
  const completed = batch?.jobs.filter((job) => job.status === "succeeded").length ?? 0;
  const progress = batch?.status === "writing" ? "Writing five fresh caption pairs…"
    : batch?.status === "rendering" ? "Stitching your videos · " + completed + "/5 ready"
    : "Preparing clips and starting your batch…";

  return <ScreenShell>
    <View style={s.header}><BrandMark compact /><Text style={s.home}>HOME</Text></View>
    <View style={s.heading}><Text accessibilityRole="header" style={s.title}>Discover</Text><Text style={s.subtitle}>Fresh captions. Real demos. Your next post.</Text></View>
    <View style={s.feed} onLayout={(event) => setHeight(Math.max(1, event.nativeEvent.layout.height))}>
      <FlatList ref={list} data={[...items, null]} keyExtractor={(item) => item?.id ?? "more"} pagingEnabled snapToInterval={height} decelerationRate="fast" showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
        onScroll={(event) => setActive(Math.round(event.nativeEvent.contentOffset.y / height))} scrollEventThrottle={100}
        extraData={{ active, focused, appActive, batch, preparing, error, config, height }}
        initialNumToRender={2} maxToRenderPerBatch={3} windowSize={3}
        renderItem={({ item, index }) => <View style={{ height, paddingHorizontal: 12, paddingBottom: 8 }}>
          {item?.rendered ? <View style={s.card}>
            {focused && appActive && active === index
              ? <RenderedVideo key={item.rendered.jobId} uri={item.rendered.url} jobId={item.rendered.jobId} post={item.post} height={Math.max(120, height - 86)} autoPlay compactActions />
              : <View style={[s.poster, { flex: 1 }]}><Text style={s.meta}>Video ready</Text></View>}
            <ContentActions item={item} onIgnore={() => list.current?.scrollToIndex({ index: index + 1, animated: true })} />
          </View> : <ScrollView contentContainerStyle={s.more} showsVerticalScrollIndicator={false}>
            <Sparkles size={34} color={colors.green} />
            <Text accessibilityRole="header" style={s.moreTitle}>{preparing ? "Making your next five" : batch?.status === "failed" ? "Let’s finish this batch" : items.length ? "Want some more fresh content?" : "Five fresh takes on your app"}</Text>
            <Text style={s.subtitle}>{preparing ? progress : "Short, first-person hooks and demo captions—paired with saved creators and clips of your app."}</Text>
            <Text style={s.disclaimer}>{config ? config.creatorCount + " shared creator clips · 3-second hooks\n" : ""}No new Higgsfield generation. Gemini text, server, and storage usage still apply.</Text>
            {batch?.error ? <Text accessibilityRole="alert" style={s.error}>{batch.error}</Text> : null}
            {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
            {feedback.error ? <Text accessibilityRole="alert" style={s.error}>{feedback.error}</Text> : null}
            {config && !config.ready ? <Text style={s.error}>Setup needed: {config.missing.join(", ")}</Text> : null}
            {preparing || discover.loading ? <ActivityIndicator color={colors.green} />
              : batch?.status === "failed" ? <>
                <PrimaryButton onPress={() => void discover.retry()}>{batch.jobs.length ? "Retry unfinished videos" : "Try captions again"}</PrimaryButton>
                <Text style={s.disclaimer}>{batch.jobs.length ? "Keeps the same captions and footage. Finished videos aren’t re-rendered." : "Retries Gemini caption writing; no character generation."}</Text>
              </> : <PrimaryButton disabled={!config?.ready || !feedback.ready || feedback.busy} onPress={() => void discover.generate()}>{discover.hasPendingRequest ? "Retry connection (same batch)" : items.length ? "Yes, make 5 more" : "Create my first 5 videos"}</PrimaryButton>}
            <Pressable accessibilityRole="button" disabled={discover.loading || feedback.busy} onPress={() => { void refresh(); void refreshFeedback(); }} style={s.refresh}><Text style={s.refreshText}>Refresh saved batches & preferences</Text></Pressable>
          </ScrollView>}
        </View>} />
    </View>
  </ScreenShell>;
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 22, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  home: { fontSize: 10, letterSpacing: 1.5, color: colors.muted },
  heading: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 8, gap: 2 },
  title: { color: colors.ink, fontFamily: fonts.heading, fontSize: 29 },
  subtitle: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  feed: { flex: 1 },
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: 28, padding: 8, gap: 8, borderWidth: 1, borderColor: colors.border },
  meta: { fontSize: 9, color: colors.muted },
  poster: { borderRadius: 20, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  disclaimer: { fontSize: 11, color: colors.muted, lineHeight: 17 },
  more: { flexGrow: 1, borderRadius: 28, padding: 24, backgroundColor: colors.greenSoft, justifyContent: "center", gap: 16 },
  moreTitle: { fontSize: 26, lineHeight: 33, fontFamily: fonts.heading, color: colors.ink },
  refresh: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  refreshText: { color: colors.green, fontSize: 12, fontFamily: fonts.heading },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
