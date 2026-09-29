import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { LANDING_VIDEOS } from "@/config/landing-videos";
import { colors, fonts } from "@/theme";

export function LandingShowcase() {
  const [space, setSpace] = useState({ height: 240, width: 390 });
  const cardHeight = Math.max(0, Math.min(266, space.height - 54, space.width / 1.57));
  const cardWidth = cardHeight * 9 / 16;
  const [index, setIndex] = useState(0);
  const [retries, setRetries] = useState<Record<string, number>>({});
  const move = (direction: number) => setIndex((current) => (current + direction + LANDING_VIDEOS.length) % LANDING_VIDEOS.length);
  const swipe = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
    onPanResponderRelease: (_, gesture) => { if (Math.abs(gesture.dx) > 24) move(gesture.dx < 0 ? 1 : -1); },
    onPanResponderTerminationRequest: () => false,
  })).current;
  return <View testID="landing-showcase" style={s.stage} onLayout={({ nativeEvent: { layout } }) => setSpace({ height: layout.height, width: layout.width })}>
    <View {...swipe.panHandlers} style={[s.carousel, { height: cardHeight + 14 }]}>
      {LANDING_VIDEOS.map((video, number) => {
        const centered = number === index;
        const side = number === (index + 1) % LANDING_VIDEOS.length ? 1 : -1;
        const width = centered ? cardWidth : cardWidth * 0.9;
        return <View key={video.id} testID={centered ? "landing-center-video" : "landing-side-video"} style={[s.position, {
          width, height: centered ? cardHeight : cardHeight * 0.9, marginLeft: -width / 2,
          top: centered ? 8 : 26, zIndex: centered ? 3 : 1,
          transform: [{ translateX: centered ? 0 : side * cardWidth * 0.73 }, { rotate: centered ? "-2deg" : `${side * 9}deg` }],
        }]}>
          <View testID="landing-video-tile" style={s.card}>
            <ShowcaseVideo key={`${video.id}:${retries[video.id] ?? 0}`} url={video.url} centered={centered} onEnd={() => move(1)} onRetry={() => setRetries((current) => ({ ...current, [video.id]: (current[video.id] ?? 0) + 1 }))} />
          </View>
        </View>;
      })}
      <View testID="landing-caption-overlay" pointerEvents="none" style={s.caption}>
        <Text style={s.captionText}>Content that actually gets people curious about your app</Text>
      </View>
    </View>
    <View style={s.controls}>
      <View style={s.dots}>{LANDING_VIDEOS.map((video, number) => <Pressable key={video.id} accessibilityRole="button" accessibilityLabel={`Show example video ${number + 1}`} accessibilityState={{ selected: index === number }} onPress={() => setIndex(number)} style={s.dotTarget}><View style={[s.dot, index === number && s.selected]} /></Pressable>)}</View>
    </View>
  </View>;
}

function ShowcaseVideo({ url, centered, onEnd, onRetry }: { url: string; centered: boolean; onEnd: () => void; onRetry: () => void }) {
  const player = useVideoPlayer(url, (instance) => { instance.muted = true; instance.loop = false; });
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState == null || AppState.currentState === "active");
  const [status, setStatus] = useState(player.status);
  const next = useRef(onEnd); next.current = onEnd;
  const isCenter = useRef(centered); isCenter.current = centered;
  useEffect(() => {
    const update = () => setForeground(AppState.currentState == null || AppState.currentState === "active");
    const subscription = AppState.addEventListener("change", update);
    update();
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    // Side tiles stay paused on their first frame. Each centered clip gets full playback
    // from the beginning before its end event advances the carousel.
    if (!centered) { player.pause(); player.currentTime = 0; return; }
    if (!focused || !foreground) { player.pause(); return; }
    player.currentTime = 0;
    const subscription = player.addListener("statusChange", ({ status }) => { if (status === "readyToPlay") player.play(); });
    if (player.status === "readyToPlay") player.play();
    return () => subscription.remove();
  }, [centered, focused, foreground, player]);
  useEffect(() => {
    setStatus(player.status);
    const end = player.addListener("playToEnd", () => { if (isCenter.current) next.current(); });
    const update = player.addListener("statusChange", ({ status }) => setStatus(status));
    return () => { end.remove(); update.remove(); };
  }, [player]);
  return <View style={StyleSheet.absoluteFill}>
    <VideoView pointerEvents="none" player={player} nativeControls={false} contentFit="contain" playsInline surfaceType="textureView" style={s.video} />
    {status === "error" ? <Pressable accessibilityRole="button" accessibilityLabel="Retry example video" onPress={onRetry} style={s.retry}><Text style={s.retryText}>Tap to retry</Text></Pressable> : null}
    {status === "loading" ? <ActivityIndicator accessibilityLabel="Loading example video" color={colors.yellow} style={s.loading} /> : null}
  </View>;
}
const s = StyleSheet.create({
  stage: { flex: 1, minHeight: 0, marginHorizontal: -22, justifyContent: "center" }, carousel: { overflow: "hidden" },
  position: { position: "absolute", left: "50%", borderRadius: 22, shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  card: { flex: 1, backgroundColor: colors.ink, borderRadius: 22, overflow: "hidden", borderWidth: 2, borderColor: colors.canvas },
  video: { width: "100%", height: "100%" },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: -3 },
  loading: { position: "absolute", top: "38%", alignSelf: "center" }, retry: { marginTop: 35, padding: 10 }, retryText: { color: "white", fontSize: 10, textAlign: "center" },
  caption: { position: "absolute", alignSelf: "center", width: "72%", maxWidth: 280, bottom: 16, zIndex: 4, elevation: 3, backgroundColor: "#000000", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  captionText: { color: "white", fontFamily: fonts.heading, fontSize: 13, lineHeight: 17, textAlign: "center" },
  dots: { flexDirection: "row" }, dotTarget: { width: 36, height: 40, alignItems: "center", justifyContent: "center" },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.border }, selected: { width: 17, backgroundColor: colors.ink },
});
