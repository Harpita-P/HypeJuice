import { useVideoPlayer, VideoView } from "expo-video";
import { useState, useEffect, useRef } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Download, Share2 } from "lucide-react-native";
import { colors, fonts } from "@/theme";
import { prepareVideoShare, saveVideo, type PreparedVideoShare } from "@/lib/video-export";
import type { PostCopy } from "@shared/post-copy";
import { PostCopyPanel } from "./PostCopyPanel";

export function RenderedVideo({ uri, jobId, height, autoPlay = false, post, compactActions = false }: { uri: string; jobId: string; height?: number; autoPlay?: boolean; post?: PostCopy; compactActions?: boolean }) {
  const { height: screenHeight } = useWindowDimensions();
  const player = useVideoPlayer(uri, (instance) => { instance.muted = true; instance.loop = autoPlay; if (autoPlay) instance.play(); });
  const [status, setStatus] = useState(player.status);
  useEffect(() => {
    const subscription = player.addListener("statusChange", (event) => setStatus(event.status));
    return () => subscription.remove();
  }, [player]);
  return <View style={{ gap: 12 }}>
    <View style={{ height: height ?? Math.max(320, Math.min(760, screenHeight * 0.72)), backgroundColor: colors.ink, borderRadius: 20, overflow: "hidden" }}>
    <VideoView player={player} nativeControls contentFit="contain" playsInline surfaceType="textureView" fullscreenOptions={{ enable: true }} style={{ width: "100%", height: "100%" }} />
    <PostCopyPanel post={post} />
    {compactActions ? <View pointerEvents="box-none" style={s.exportOverlay}><VideoExportActions jobId={jobId} compact /></View> : null}
    {status === "loading" ? <ActivityIndicator color={colors.yellow} style={{ position: "absolute", top: "50%", alignSelf: "center" }} /> : null}
    {status === "error" ? <Text accessibilityRole="alert" style={{ position: "absolute", top: "45%", color: "white", padding: 20 }}>Couldn’t play this video. Open Studio → Recent renders to refresh its private playback link.</Text> : null}
    </View>
    {!compactActions ? <VideoExportActions jobId={jobId} /> : null}
  </View>;
}

function VideoExportActions({ jobId, compact = false }: { jobId: string; compact?: boolean }) {
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [shareReady, setShareReady] = useState(false);
  const prepared = useRef<PreparedVideoShare | null>(null);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; prepared.current?.dispose(); prepared.current = null; };
  }, []);

  async function exportVideo(action: "download" | "share") {
    if (locked.current) return;
    locked.current = true;
    setBusy(action); setMessage(""); setFailed(false);
    let share: PreparedVideoShare | null = null;
    try {
      if (action === "download") {
        const result = await saveVideo(jobId);
        if (mounted.current) setMessage(result);
      } else {
        // On web, use the prepared file on the next tap without awaiting any network work.
        if (prepared.current) {
          share = prepared.current; prepared.current = null;
          setShareReady(false);
        } else {
          share = await prepareVideoShare(jobId);
          if (!mounted.current) return;
          if (Platform.OS === "web") {
            prepared.current = share; share = null;
            setShareReady(true); setMessage("Video ready. Tap Share now to choose where to send it.");
            return;
          }
        }
        await share.share();
      }
    } catch (error) {
      if (mounted.current && !(error instanceof Error && error.name === "AbortError")) {
        setFailed(true);
        setMessage(action === "share" && share
          ? "Couldn’t open sharing. Try again or use Download."
          : error instanceof Error ? error.message : "Couldn’t export the video. Please try again.");
      }
    } finally {
      share?.dispose();
      locked.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  return <View style={{ gap: 8 }}>
    <View style={[s.actions, compact && s.compactRow]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Download video" accessibilityState={{ disabled: !!busy, busy: busy === "download" }} disabled={!!busy} onPress={() => void exportVideo("download")} style={[s.button, s.download, compact && s.iconButton, busy && s.disabled]}>
        {busy === "download" ? <ActivityIndicator color={compact ? "white" : colors.ink} /> : <Download size={19} color={compact ? "white" : colors.ink} />}
        {!compact ? <Text style={s.label}>{busy === "download" ? "Saving…" : "Download"}</Text> : null}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={shareReady ? "Share video now" : "Share video"} accessibilityState={{ disabled: !!busy, busy: busy === "share" }} disabled={!!busy} onPress={() => void exportVideo("share")} style={[s.button, compact && s.iconButton, busy && s.disabled]}>
        {busy === "share" ? <ActivityIndicator color={compact ? "white" : colors.ink} /> : <Share2 size={19} color={compact ? "white" : colors.ink} />}
        {!compact ? <Text style={s.label}>{busy === "share" ? "Preparing…" : shareReady ? "Share now" : "Share"}</Text> : null}
      </Pressable>
    </View>
    {message ? <Text accessibilityRole={failed ? "alert" : undefined} accessibilityLiveRegion="polite" style={[{ color: failed ? colors.danger : colors.muted, fontSize: 13 }, compact && s.overlayMessage]}>{message}</Text> : null}
  </View>;
}

const s = StyleSheet.create({
  exportOverlay: { position: "absolute", top: 10, right: 10, left: 10 },
  compactRow: { justifyContent: "flex-end", gap: 6 },
  iconButton: { flexGrow: 0, flexShrink: 0, flexBasis: 44, width: 44, height: 44, minHeight: 44, padding: 0, paddingHorizontal: 0, paddingVertical: 0, borderColor: "#FFFFFF30", backgroundColor: "rgba(0,0,0,0.42)" },
  overlayMessage: { color: "white", backgroundColor: "rgba(0,0,0,0.75)", padding: 10, borderRadius: 12 },
  actions: { flexDirection: "row", gap: 10 },
  button: { flex: 1, minHeight: 48, paddingHorizontal: 10, paddingVertical: 12, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  download: { backgroundColor: colors.yellow, borderColor: colors.yellow },
  disabled: { opacity: 0.65 },
  label: { color: colors.ink, fontFamily: fonts.heading, fontSize: 14 },
});
