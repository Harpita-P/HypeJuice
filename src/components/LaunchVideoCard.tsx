import { useEffect, useRef, useState } from "react";
import { useIsFocused, useRouter } from "expo-router";
import { ActivityIndicator, AppState, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Camera, Check, Flame, Music2, Play, X } from "lucide-react-native";
import type { ContentConcept } from "@shared/content";
import type { YouTubeTrackingView } from "@shared/youtube-tracking";
import { youtubeVideoId } from "@shared/youtube-tracking";
import { youtubeTrackingRequest } from "@/lib/youtube-tracking-api";
import { useContent } from "@/context/ContentContext";
import { LibraryVideoPreview } from "./LibraryVideoPreview";
import { BriefEditSheet } from "./BriefEditSheet";
import { YouTubeMetrics } from "./YouTubeMetrics";
import { colors, fonts } from "@/theme";

const platforms = ["YouTube", "TikTok", "Facebook", "IG Reels", "LinkedIn"] as const;
function PlatformIcon({ name, active }: { name: typeof platforms[number]; active: boolean }) {
  const color = active ? "#D92D2D" : colors.muted;
  if (name === "YouTube") return <View style={{ backgroundColor: color, borderRadius: 6, width: 27, height: 19, alignItems: "center", justifyContent: "center" }}><Play size={12} color="white" fill="white" /></View>;
  if (name === "TikTok") return <Music2 size={23} color={color} />;
  if (name === "IG Reels") return <Camera size={23} color={color} />;
  return <Text style={{ color, fontSize: name === "Facebook" ? 27 : 20, fontWeight: "800" }}>{name === "Facebook" ? "f" : "in"}</Text>;
}

export function LaunchVideoCard({ item, preview = true, topPerformer = false, onMetrics }: { item: ContentConcept; preview?: boolean; topPerformer?: boolean; onMetrics: (id: string, data: YouTubeTrackingView) => void }) {
  const { act } = useContent(); const router = useRouter(); const focused = useIsFocused();
  const [data, setData] = useState<YouTubeTrackingView | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false); const [url, setUrl] = useState(""); const [confirmed, setConfirmed] = useState(false);
  const [comingSoon, setComingSoon] = useState(false);
  const mounted = useRef(true); const requestBusy = useRef(false);
  const jobId = item.rendered?.jobId;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function request(action?: "connect" | "refresh" | "disconnect") {
    if (!jobId || requestBusy.current) return;
    requestBusy.current = true; setBusy(true); setError("");
    try {
      const next = await youtubeTrackingRequest(jobId, action, action === "connect" ? { url, confirmed } : undefined);
      if (!mounted.current) return;
      setData(next); onMetrics(jobId, next); if (action === "connect") setEditing(false);
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : "Couldn’t load tracking."); }
    finally { requestBusy.current = false; if (mounted.current) setBusy(false); }
  }
  useEffect(() => {
    if (!focused || !jobId) return;
    void request();
    const timer = setInterval(() => { if (AppState.currentState === "active") void request(); }, 60_000);
    const listener = AppState.addEventListener("change", (state) => { if (state === "active") void request(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, [focused, jobId]);
  return <View testID="liftoff-card" style={[s.card, topPerformer && s.topCard]}>
    <View style={s.top}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Watch ${item.title}`} onPress={() => router.push({ pathname: "/content/[id]", params: { id: item.id } })} style={s.video}>
        {item.rendered && preview && focused ? <LibraryVideoPreview uri={item.rendered.url} jobId={item.rendered.jobId} /> : <Play size={32} color={colors.yellow} />}
        <View style={s.playPill}><Play size={12} color="white" fill="white" /><Text style={s.playText}>Watch</Text></View>
      </Pressable>
      <View style={s.summary}>
        <View style={s.row}><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.title} from Liftoff`} onPress={() => act(item.id, "unqueue")} style={s.icon}><X size={16} color={colors.muted} /></Pressable>
          {topPerformer ? <View accessibilityLabel="Top views among your linked posts" style={s.fireBadge}><View style={s.flame}><Flame size={48} color="#B83716" fill="#FF742E" strokeWidth={1.7} /><View style={s.spark} /></View><Text style={s.badgeLabel}>Top views</Text></View> : null}
        </View>
        <Text numberOfLines={3} style={s.title}>{item.hook || item.title}</Text>
      </View>
    </View>
    <Text style={s.integrationLabel}>Choose an integration</Text>
    <View style={s.platforms}>{platforms.map((name) => <View key={name} style={s.platformCell}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${name}${name === "YouTube" ? " Shorts: connect posted video" : ": coming soon"}`} accessibilityState={{ disabled: name === "YouTube" && !jobId, selected: name === "YouTube" && !!data?.connection }} disabled={name === "YouTube" && !jobId} onPress={() => { if (name !== "YouTube") { setComingSoon(true); return; } setEditing(true); setError(""); setConfirmed(false); setUrl(data?.connection ? `https://youtube.com/shorts/${data.connection.videoId}` : ""); }} style={[s.platform, name === "YouTube" && s.youtube, name !== "YouTube" && { opacity: 0.4 }]}>
        <PlatformIcon name={name} active={name === "YouTube"} />{name === "YouTube" && data?.connection ? <View style={s.check}><Check size={9} color="white" /></View> : null}
      </Pressable>
    </View>)}</View>
    {data?.connection ? <YouTubeMetrics data={data} busy={busy} refresh={() => void request("refresh")} disconnect={() => void request("disconnect")} /> : null}
    {busy ? <ActivityIndicator size="small" color={colors.green} /> : null}
    {error && !editing ? <Pressable accessibilityRole="button" onPress={() => void request()}><Text accessibilityRole="alert" style={s.error}>{error} Tap to retry.</Text></Pressable> : null}
    {editing ? <BriefEditSheet title={data?.connection ? "Connected post" : "Connect your post"} visible onClose={() => { if (!busy) setEditing(false); }} saveLabel={data?.connection ? "Done" : "Connect & track"} saveDisabled={!data?.connection && (!confirmed || !url.trim())} saveLoading={busy} error={error} onSave={() => {
      if (data?.connection) { setEditing(false); return; }
      try { youtubeVideoId(url); } catch (reason) { setError((reason as Error).message); return; }
      void request("connect");
    }}>
      <Text style={s.copy}>Paste your post link to see how it’s landing.</Text>
      <TextInput accessibilityLabel="Post link" placeholder="Paste your post link" value={url} editable={!busy && !data?.connection} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={s.input} />
      {!data?.connection ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} disabled={busy} onPress={() => setConfirmed(!confirmed)} style={[s.row, { gap: 12, paddingVertical: 8 }]}><View style={[s.checkbox, confirmed && { backgroundColor: colors.green }]}>{confirmed ? <Check size={16} color="white" /> : null}</View><Text style={[s.copy, { flex: 1 }]}>This is my post of this video. Track its public metrics for me.</Text></Pressable> : null}
      {data && !data.configured ? <Text style={s.error}>This integration needs to be configured on the server.</Text> : null}
      <Text style={s.small}>Public posts only. Checks are kept for 28 days and deleted when you disconnect. A link doesn’t verify ownership. Agent chat uses counts, not comment text.</Text>
      <View style={s.row}><Pressable accessibilityRole="link" onPress={() => void Linking.openURL("https://www.youtube.com/t/terms")}><Text style={s.link}>Platform terms</Text></Pressable><Pressable accessibilityRole="link" onPress={() => void Linking.openURL("https://policies.google.com/privacy")}><Text style={s.link}>Privacy policy</Text></Pressable></View>
    </BriefEditSheet> : null}
    <Modal visible={comingSoon} transparent animationType="fade" onRequestClose={() => setComingSoon(false)}>
      <View style={s.popupBackdrop}><Pressable accessibilityLabel="Dismiss integration notice" style={StyleSheet.absoluteFill} onPress={() => setComingSoon(false)} /><View style={s.popup}><Text style={s.title}>Integration coming soon</Text><Pressable accessibilityRole="button" onPress={() => setComingSoon(false)} style={s.popupButton}><Text style={s.title}>Got it</Text></Pressable></View></View>
    </Modal>
  </View>;
}
const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 28, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 14 },
  topCard: { borderColor: "#EACB55", backgroundColor: "#FFF9DE", borderTopRightRadius: 48 },
  top: { flexDirection: "row", gap: 14 }, video: { width: "39%", aspectRatio: 9 / 16, backgroundColor: colors.ink, borderRadius: 16, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  summary: { flex: 1, gap: 7 }, row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 5 },
  title: { color: colors.ink, fontFamily: fonts.heading, fontSize: 16, lineHeight: 23 },
  small: { color: colors.muted, fontSize: 11, lineHeight: 17 }, copy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  icon: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" }, link: { color: colors.green, fontSize: 12, fontWeight: "600" },
  fireBadge: { alignItems: "center", padding: 8, paddingHorizontal: 12, borderRadius: 24, borderTopLeftRadius: 8, backgroundColor: "#FFE36E", transform: [{ rotate: "7deg" }] },
  flame: { position: "relative" }, spark: { position: "absolute", width: 9, height: 9, backgroundColor: "#FF742E", right: -5, top: 7, transform: [{ rotate: "45deg" }] },
  badgeLabel: { color: "#7B2C15", fontFamily: fonts.heading, fontSize: 12, marginTop: 1 },
  integrationLabel: { color: colors.ink, fontFamily: fonts.heading, fontSize: 13 },
  playPill: { position: "absolute", bottom: 8, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#171A13A0", padding: 8, borderRadius: 20 }, playText: { color: "white", fontSize: 10 },
  platforms: { flexDirection: "row", justifyContent: "space-between", gap: 4 }, platformCell: { alignItems: "center", gap: 5, flex: 1 },
  platform: { width: 46, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }, youtube: { backgroundColor: "#FDEAE8", borderWidth: 1, borderColor: "#F2BFB8" },
  check: { position: "absolute", right: -2, top: -2, padding: 3, borderRadius: 10, backgroundColor: colors.green },
  input: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, color: colors.ink, fontSize: 14 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: colors.green, alignItems: "center", justifyContent: "center" },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  popupBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#171A1370", padding: 24 },
  popup: { backgroundColor: colors.canvas, padding: 24, borderRadius: 28, gap: 22, width: "100%", maxWidth: 340, alignItems: "center" },
  popupButton: { backgroundColor: colors.yellow, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 28 },
});
