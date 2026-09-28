import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { getStudioJob } from "@/lib/studio-api";
import { colors } from "@/theme";

/** Muted tile preview. Only mounted for visible tiles while Library is active. */
export function LibraryVideoPreview({ uri, jobId }: { uri: string; jobId: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.muted = true;
    instance.loop = true;
    instance.play();
  });
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
          if (active) player.play();
        } catch { /* Keep the tile tappable so the full result can be opened. */ }
      }
    }
    const subscription = player.addListener("statusChange", (event) => { void update(event.status); });
    void update(player.status);
    return () => { active = false; subscription.remove(); };
  }, [jobId, player]);

  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <VideoView player={player} nativeControls={false} contentFit="contain" playsInline surfaceType="textureView" style={StyleSheet.absoluteFill} />
    {status === "loading" ? <ActivityIndicator color={colors.yellow} style={styles.indicator} /> : null}
    {status === "error" ? <Text style={styles.error}>Preview unavailable · tap to open</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  indicator: { position: "absolute", top: "50%", alignSelf: "center" },
  error: { color: colors.surface, fontSize: 12, textAlign: "center", marginHorizontal: 12, marginTop: "50%" },
});
