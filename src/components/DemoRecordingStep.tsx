import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import { Plus, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { DemoClip } from "@shared/app-brief";
import { MAX_DEMO_CLIPS } from "@shared/creative-profile";
import { getDemoClipUri, releaseDemoClipUri, storeDemoClip } from "@/lib/demo-storage";
import { colors } from "@/theme";
import { useVideoAutoplay } from "@/lib/use-video-autoplay";

function ClipPlayer({ uri, autoPlay = true }: { uri: string; autoPlay?: boolean }) {
  const player = useVideoPlayer(uri, (instance) => { instance.muted = true; instance.loop = true; });
  const autoplay = useVideoAutoplay(player, autoPlay);
  const [status, setStatus] = useState(player.status);
  useEffect(() => {
    setStatus(player.status);
    const subscription = player.addListener("statusChange", (event) => setStatus(event.status));
    return () => subscription.remove();
  }, [player]);
  return <View {...autoplay} style={StyleSheet.absoluteFill}>
    <VideoView player={player} nativeControls contentFit="contain" playsInline fullscreenOptions={{ enable: true }} style={styles.video} />
    {status === "loading" ? <View pointerEvents="none" style={styles.previewStatus}><ActivityIndicator color="white" /></View> : null}
    {status === "error" ? <View style={styles.previewStatus}><Text style={styles.previewError}>This video couldn’t be played. Try importing an MP4 or MOV recording again.</Text></View> : null}
  </View>;
}

export function InlineClipPreview({ clip, index, height = 150, autoPlay = true }: { clip: DemoClip; index: number; height?: number; autoPlay?: boolean }) {
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { id, localPath, storage } = clip;
  useEffect(() => {
    let active = true;
    let resolvedUri: string | null = null;
    setUri(null); setError("");
    void getDemoClipUri(clip).then((value) => {
      if (!active) { releaseDemoClipUri(value); return; }
      resolvedUri = value;
      setUri(value);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : "Couldn’t load this recording.");
    });
    return () => { active = false; if (resolvedUri) releaseDemoClipUri(resolvedUri); };
    // Editing the clip's note must not reload or interrupt its player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, localPath, storage]);

  return <View style={[styles.inlinePreview, { height }]} accessibilityLabel={`Clip ${index + 1} preview`}>
    {uri ? <ClipPlayer uri={uri} autoPlay={autoPlay} /> : error ? <Text accessibilityRole="alert" style={styles.previewError}>{error}</Text> : <ActivityIndicator color="white" />}
  </View>;
}

export function DemoRecordingStep({ clips, onChange, onBusyChange, autoPlay = true }: {
  clips: DemoClip[]; onChange: (clips: DemoClip[]) => void; onBusyChange: (busy: boolean) => void; autoPlay?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function importClips() {
    if (busy) return;
    const remaining = MAX_DEMO_CLIPS - clips.length;
    if (remaining <= 0) return;
    setBusy(true); onBusyChange(true); setError("");
    try {
      if (Platform.OS === "ios") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) throw new Error("Allow photo library access in Settings to choose clips of your app in action.");
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], allowsMultipleSelection: true, selectionLimit: remaining, allowsEditing: false });
      if (result.canceled) return;
      const added: DemoClip[] = [];
      const errors: string[] = [];
      for (const asset of result.assets) {
        // Some platforms do not enforce the native picker's selection limit.
        if (added.length >= remaining) break;
        try {
          if (asset.type && asset.type !== "video") throw new Error("Choose a video recording, not an image.");
          added.push(await storeDemoClip(asset));
          onChange([...clips, ...added]);
        } catch (reason) { errors.push(reason instanceof Error ? reason.message : "Couldn’t import this recording."); }
      }
      if (errors.length) setError(`${errors.length} recording(s) couldn’t be imported. ${errors[0]}`);
      else if (result.assets.length > remaining) setError(`Added the first ${remaining} clip${remaining === 1 ? "" : "s"}. This setup has ${MAX_DEMO_CLIPS} slots.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn’t open your recordings. Please try again.");
    } finally { setBusy(false); onBusyChange(false); }
  }

  return <View style={styles.container}>
    <Text style={styles.copy}>We’ll pair creator hooks with real clips of your app, so people can see how it works and why they should love it.</Text>
    <View style={styles.gridHeading}><Text style={styles.guidance}>10-second clips work well here</Text><Text style={styles.count}>{clips.length}/{MAX_DEMO_CLIPS}</Text></View>
    <View style={styles.grid}>
    {clips.map((clip, index) => <View key={clip.id} style={styles.clip}>
      <Text style={styles.slotTitle}>Clip {index + 1}</Text>
      <View>
        <InlineClipPreview clip={clip} index={index} autoPlay={autoPlay} />
        <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Remove clip ${index + 1}`} onPress={() => onChange(clips.filter((item) => item.id !== clip.id))} style={styles.remove}><X size={18} color={colors.ink} /></Pressable>
      </View>
      <TextInput accessibilityLabel={`What recording ${index + 1} shows`} editable={!busy} value={clip.shows} onChangeText={(shows) => onChange(clips.map((item) => item.id === clip.id ? { ...item, shows } : item))} multiline maxLength={500} placeholder="What does this show?" placeholderTextColor={colors.muted} style={styles.input} />
    </View>)}
    {Array.from({ length: Math.max(0, MAX_DEMO_CLIPS - clips.length) }, (_, offset) => {
      const number = clips.length + offset + 1;
      return <Pressable key={`empty-${number}`} accessibilityRole="button" accessibilityLabel={`Add clip ${number}`} disabled={busy} onPress={() => void importClips()} style={[styles.clip, styles.emptyClip]}>
        <Text style={styles.slotTitle}>Clip {number}</Text>
        <View style={styles.emptyContent}>
          <View style={styles.plusCircle}>{busy && offset === 0 ? <ActivityIndicator color={colors.ink} /> : <Plus size={25} color={colors.ink} />}</View>
          <Text style={styles.name}>{busy && offset === 0 ? "Adding clips…" : "Add a clip"}</Text>
        </View>
      </Pressable>;
    })}
    </View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  gridHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  guidance: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 19 },
  count: { color: colors.green, fontSize: 13, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  clip: { width: "47%", flexGrow: 1, minWidth: 0, minHeight: 268, borderRadius: 22, padding: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  slotTitle: { color: colors.muted, fontSize: 12, fontWeight: "700", paddingHorizontal: 3 },
  emptyClip: { borderStyle: "dashed", borderColor: "#AFB99C", backgroundColor: "#F0F3E7" },
  emptyContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingBottom: 24 },
  plusCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  name: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  remove: { position: "absolute", top: 2, right: 2, zIndex: 1, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFFE6" },
  input: { minHeight: 60, backgroundColor: colors.canvas, borderRadius: 12, padding: 9, fontSize: 13, lineHeight: 19, color: colors.ink, textAlignVertical: "top" },
  error: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  inlinePreview: { height: 150, borderRadius: 14, overflow: "hidden", backgroundColor: "#10120F", alignItems: "center", justifyContent: "center" },
  video: { width: "100%", height: "100%" },
  previewStatus: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#10120F99" },
  previewError: { color: "white", fontSize: 13, lineHeight: 20, padding: 20, textAlign: "center" },
});
