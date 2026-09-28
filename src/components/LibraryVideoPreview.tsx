import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { getStudioJob } from "@/lib/studio-api";
import { colors } from "@/theme";
import { useVideoAutoplay } from "@/lib/use-video-autoplay";

/** Muted tile preview. Only mounted for visible tiles while Library is active. */
export function LibraryVideoPreview({ uri, jobId, autoPlay = true }: { uri: string; jobId: string; autoPlay?: boolean }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.muted = true;
    instance.loop = true;
  });
  const autoplay = useVideoAutoplay(player, autoPlay);
  const [status, setStatus] = useState(player.status);
  const refreshed = useRef(false);
  useEffect(() => {
    let active = true;
    async function update(next: typeof player.status) {
      if (!active) return;
      setStatus(next);
      if (next === "error" && !refreshed.current) {
        refreshed.current = true;
        try {
          const job = await getStudioJob(jobId);
          if (!active || !job.videoUrl) return;
          await player.replaceAsync(job.videoUrl);
        } catch { /* Keep the tile tappable so the full result can be opened. */ }
      }
    }
    const subscription = player.addListener("statusChange", (event) => { void update(event.status); });
    void update(player.status);
    return () => { active = false; subscription.remove(); };
  }, [jobId, player, autoPlay]);

  return <View {...autoplay} pointerEvents="none" style={StyleSheet.absoluteFill}>
    <VideoView player={player} nativeControls={false} contentFit="contain" playsInline surfaceType="textureView" style={StyleSheet.absoluteFill} />
    {status === "loading" ? <ActivityIndicator color={colors.yellow} style={styles.indicator} /> : null}
    {status === "error" ? <Text style={styles.error}>Preview unavailable · tap to open</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  indicator: { position: "absolute", top: "50%", alignSelf: "center" },
  error: { color: colors.surface, fontSize: 12, textAlign: "center", marginHorizontal: 12, marginTop: "50%" },
});
