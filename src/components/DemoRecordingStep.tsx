import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import { ArrowUpRight, Hand, Images, Plus, Smartphone, Sparkles, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { DemoClip } from "@shared/app-brief";
import { MAX_DEMO_CLIPS } from "@shared/creative-profile";
import { getDemoClipUri, releaseDemoClipUri, storeDemoClip } from "@/lib/demo-storage";
import { colors, fonts } from "@/theme";
import { useVideoAutoplay } from "@/lib/use-video-autoplay";
import { AgentMessage } from "./AgentTasteMessage";

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
    <AgentMessage>Show me your app doing its thing. I’ll pair these moments with creator hooks to make people want to try it.</AgentMessage>
    {!clips.length ? <View testID="demo-moments-invitation" style={styles.invitation}>
      <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.art}>
        <View style={styles.sun} />
        <View style={styles.backPhone}><View style={styles.speaker} /><Hand size={36} color={colors.ink} strokeWidth={1.7} /><View style={styles.mockLine} /></View>
        <View style={styles.frontPhone}><View style={styles.speaker} /><View style={styles.mockFeature}><Sparkles size={27} color={colors.ink} /></View><View style={styles.mockLine} /><View style={styles.mockShortLine} /><View style={styles.mockButton}><ArrowUpRight size={18} color={colors.ink} /></View></View>
        <View style={styles.sparkle}><Sparkles size={30} color={colors.ink} /></View>
      </View>
      <View style={styles.formats}>
        <View style={styles.format}><Smartphone size={15} color={colors.ink} /><Text style={styles.formatText}>On screen</Text></View>
        <View style={styles.format}><Hand size={15} color={colors.ink} /><Text style={styles.formatText}>In someone’s hands</Text></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Choose videos of your app" disabled={busy} onPress={() => void importClips()} style={({ pressed }) => [styles.chooseButton, (pressed || busy) && styles.dimmed]}>
        {busy ? <ActivityIndicator color={colors.ink} /> : <Images size={21} color={colors.ink} />}
        <Text style={styles.chooseText}>{busy ? "Getting your moments ready…" : "Choose app moments"}</Text>
        {!busy ? <ArrowUpRight size={20} color={colors.ink} /> : null}
      </Pressable>
      <Text style={styles.guidance}>About 10 seconds is a great start</Text>
    </View> : <>
    <View style={styles.gridHeading}>
      <Text style={styles.galleryTitle}>Your app moments</Text>
      {clips.length < MAX_DEMO_CLIPS ? <Pressable accessibilityRole="button" accessibilityLabel="Choose more videos of your app" disabled={busy} onPress={() => void importClips()} style={({ pressed }) => [styles.chooseMore, (pressed || busy) && styles.dimmed]}>
        {busy ? <ActivityIndicator size="small" color={colors.ink} /> : <Plus size={17} color={colors.ink} />}
        <Text style={styles.moreText}>{busy ? "Adding…" : "Choose more"}</Text>
      </Pressable> : null}
    </View>
    <View testID="demo-moments-gallery" style={styles.grid}>
    {clips.map((clip, index) => <View key={clip.id} style={styles.clip}>
      <View>
        <InlineClipPreview clip={clip} index={index} height={232} autoPlay={autoPlay} />
        <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Remove clip ${index + 1}`} onPress={() => onChange(clips.filter((item) => item.id !== clip.id))} style={styles.remove}><X size={16} color="white" /></Pressable>
      </View>
      <TextInput accessibilityLabel={`What recording ${index + 1} shows`} editable={!busy} value={clip.shows} onChangeText={(shows) => onChange(clips.map((item) => item.id === clip.id ? { ...item, shows } : item))} multiline maxLength={500} placeholder="What’s happening here?" placeholderTextColor={colors.muted} style={styles.input} />
    </View>)}
    </View>
    </>}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  gridHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  guidance: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  invitation: { backgroundColor: "#E8DFFA", borderRadius: 28, borderBottomLeftRadius: 10, padding: 18, gap: 16, overflow: "hidden" },
  art: { height: 170, alignItems: "center", justifyContent: "center" },
  sun: { position: "absolute", width: 146, height: 146, borderRadius: 73, backgroundColor: colors.yellow },
  backPhone: { position: "absolute", width: 83, height: 134, borderRadius: 18, backgroundColor: "#F6B397", borderWidth: 2, borderColor: colors.ink, alignItems: "center", justifyContent: "space-evenly", transform: [{ translateX: -40 }, { rotate: "-14deg" }] },
  frontPhone: { width: 91, height: 153, borderRadius: 19, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.ink, alignItems: "center", justifyContent: "space-evenly", transform: [{ translateX: 23 }, { rotate: "9deg" }] },
  speaker: { width: 24, height: 4, borderRadius: 2, backgroundColor: colors.ink },
  mockFeature: { width: 59, height: 48, borderRadius: 12, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  mockLine: { width: 50, height: 5, backgroundColor: "#DAD8CD", borderRadius: 3 },
  mockShortLine: { width: 33, height: 5, backgroundColor: "#DAD8CD", borderRadius: 3 },
  mockButton: { width: 56, height: 24, borderRadius: 12, backgroundColor: colors.yellow, alignItems: "center", justifyContent: "center" },
  sparkle: { position: "absolute", top: 9, right: 20, transform: [{ rotate: "12deg" }] },
  formats: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: 10 },
  format: { flexDirection: "row", alignItems: "center", gap: 5 },
  formatText: { color: colors.ink, fontSize: 12, fontFamily: fonts.heading },
  chooseButton: { minHeight: 54, borderRadius: 18, backgroundColor: colors.yellow, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 12 },
  chooseText: { color: colors.ink, fontFamily: fonts.heading, fontSize: 15, flexShrink: 1 },
  dimmed: { opacity: 0.65 },
  galleryTitle: { color: colors.ink, fontFamily: fonts.heading, fontSize: 17, flexShrink: 1 },
  chooseMore: { minHeight: 44, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.yellow, borderRadius: 22 },
  moreText: { color: colors.ink, fontFamily: fonts.heading, fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  clip: { width: "47%", minWidth: 0, gap: 8 },
  remove: { position: "absolute", top: 4, right: 4, zIndex: 1, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#00000080" },
  input: { minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 3, paddingVertical: 6, fontSize: 13, lineHeight: 19, color: colors.ink, textAlignVertical: "top" },
  error: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  inlinePreview: { height: 150, borderRadius: 14, overflow: "hidden", backgroundColor: "#10120F", alignItems: "center", justifyContent: "center" },
  video: { width: "100%", height: "100%" },
  previewStatus: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#10120F99" },
  previewError: { color: "white", fontSize: 13, lineHeight: 20, padding: 20, textAlign: "center" },
});
