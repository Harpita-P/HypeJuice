import { useVideoPlayer, VideoView } from "expo-video";
import { useState, useEffect, useRef } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Download, Pencil, Share2 } from "lucide-react-native";
import { colors, fonts } from "@/theme";
import { prepareVideoShare, saveVideo, type PreparedVideoShare } from "@/lib/video-export";
import type { PostCopy } from "@shared/post-copy";
import { PostCopyPanel } from "./PostCopyPanel";
import { useVideoAutoplay } from "@/lib/use-video-autoplay";

export function RenderedVideo({ uri, jobId, height, autoPlay = true, post, compactActions = false, hideExportActions = false, hideDownload = false, swipeMode = false, onEditCaptions, contentFit = "contain", dimmed = false, onReadyToPlay }: { uri: string; jobId: string; height?: number; autoPlay?: boolean; post?: PostCopy; compactActions?: boolean; hideExportActions?: boolean; hideDownload?: boolean; swipeMode?: boolean; onEditCaptions?: () => void; contentFit?: "contain" | "cover"; dimmed?: boolean; onReadyToPlay?: () => void }) {
  const { height: screenHeight } = useWindowDimensions();
  const player = useVideoPlayer(uri, (instance) => { instance.muted = true; instance.loop = true; });
  const autoplay = useVideoAutoplay(player, autoPlay);
  const [status, setStatus] = useState(player.status);
  const readyCallback = useRef(onReadyToPlay); readyCallback.current = onReadyToPlay;
  useEffect(() => { if (status === "readyToPlay") readyCallback.current?.(); }, [status, uri]);
  useEffect(() => {
    const subscription = player.addListener("statusChange", (event) => setStatus(event.status));
    setStatus(player.status);
    return () => subscription.remove();
  }, [player]);
  return <View style={{ gap: 12 }}>
    <View {...autoplay} style={{ height: height ?? Math.max(320, Math.min(760, screenHeight * 0.72)), backgroundColor: colors.ink, borderRadius: 20, overflow: "hidden" }}>
    <VideoView pointerEvents={swipeMode ? "none" : "auto"} player={player} nativeControls={!swipeMode} contentFit={contentFit} playsInline surfaceType="textureView" fullscreenOptions={{ enable: !swipeMode }} style={{ width: "100%", height: "100%" }} />
    {swipeMode ? <Pressable accessibilityRole="button" accessibilityLabel="Play or pause video" onPress={() => { if (player.playing) player.pause(); else player.play(); }} style={StyleSheet.absoluteFill} /> : null}
    {dimmed ? <View testID="taste-reading-overlay" pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.28)" }]} /> : null}
    <PostCopyPanel post={post} />
    {!hideExportActions && compactActions ? <View pointerEvents="box-none" style={s.exportOverlay}><VideoExportActions jobId={jobId} compact hideDownload={hideDownload} /></View> : null}
    {onEditCaptions ? <Pressable accessibilityRole="button" accessibilityLabel="Edit captions" accessibilityHint="Change the captions and regenerate this video using the same footage." onPress={onEditCaptions} style={[s.button, s.iconButton, s.editOverlay]}><Pencil size={19} color="white" /></Pressable> : null}
    {status === "loading" ? <ActivityIndicator color={colors.yellow} style={{ position: "absolute", top: "50%", alignSelf: "center" }} /> : null}
    {status === "error" ? <Text accessibilityRole="alert" style={{ position: "absolute", top: "45%", color: "white", padding: 20 }}>Couldn’t play this video. Check your connection and reopen the video to try again.</Text> : null}
    </View>
    {!hideExportActions && !compactActions ? <VideoExportActions jobId={jobId} hideDownload={hideDownload} /> : null}
  </View>;
}

function VideoExportActions({ jobId, compact = false, hideDownload = false }: { jobId: string; compact?: boolean; hideDownload?: boolean }) {
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
          ? hideDownload ? "Couldn’t open sharing. Try again, or save to your library to download." : "Couldn’t open sharing. Try again or use Download."
          : error instanceof Error ? (hideDownload ? error.message.replace("Use Download instead.", "Save to your library to download instead.") : error.message) : "Couldn’t export the video. Please try again.");
      }
    } finally {
      share?.dispose();
      locked.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  return <View style={{ gap: 8 }}>
    <View style={[s.actions, compact && s.compactRow]}>
      {!hideDownload ? <Pressable accessibilityRole="button" accessibilityLabel="Download video" accessibilityState={{ disabled: !!busy, busy: busy === "download" }} disabled={!!busy} onPress={() => void exportVideo("download")} style={[s.button, s.download, compact && s.iconButton, busy && s.disabled]}>
        {busy === "download" ? <ActivityIndicator color={compact ? "white" : colors.ink} /> : <Download size={19} color={compact ? "white" : colors.ink} />}
        {!compact ? <Text style={s.label}>{busy === "download" ? "Saving…" : "Download"}</Text> : null}
      </Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={shareReady ? "Share video now" : "Share video"} accessibilityState={{ disabled: !!busy, busy: busy === "share" }} disabled={!!busy} onPress={() => void exportVideo("share")} style={[s.button, compact && s.iconButton, busy && s.disabled]}>
        {busy === "share" ? <ActivityIndicator color={compact ? "white" : colors.ink} /> : <Share2 size={19} color={compact ? "white" : colors.ink} />}
        {!compact ? <Text style={s.label}>{busy === "share" ? "Preparing…" : shareReady ? "Share now" : "Share"}</Text> : null}
      </Pressable>
    </View>
    {message ? <Text accessibilityRole={failed ? "alert" : undefined} accessibilityLiveRegion="polite" style={[{ color: failed ? colors.danger : colors.muted, fontSize: 13 }, compact && s.overlayMessage]}>{message}</Text> : null}
  </View>;
}

const s = StyleSheet.create({
  editOverlay: { position: "absolute", top: 10, left: 10 },
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
