import { useEffect, useRef, useState } from "react";
import { useIsFocused, useRouter } from "expo-router";
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { CalendarDays, Camera, Check, Bookmark, Music2, Play, X } from "lucide-react-native";
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

export function LaunchVideoCard({ item, onPlan, preview = true }: { item: ContentConcept; onPlan: () => void; preview?: boolean }) {
  const { act } = useContent(); const router = useRouter(); const focused = useIsFocused();
  const [data, setData] = useState<YouTubeTrackingView | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false); const [url, setUrl] = useState(""); const [confirmed, setConfirmed] = useState(false);
  const mounted = useRef(true); const requestBusy = useRef(false);
  const jobId = item.rendered?.jobId;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function request(action?: "connect" | "refresh" | "disconnect") {
    if (!jobId || requestBusy.current) return;
    requestBusy.current = true; setBusy(true); setError("");
    try {
      const next = await youtubeTrackingRequest(jobId, action, action === "connect" ? { url, confirmed } : undefined);
      if (!mounted.current) return;
      setData(next); if (action === "connect") setEditing(false);
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
  const latest = data?.snapshots.at(-1);
  return <View style={s.card}>
    <View style={s.top}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Watch ${item.title}`} onPress={() => router.push({ pathname: "/content/[id]", params: { id: item.id } })} style={s.video}>
        {item.rendered && preview && focused ? <LibraryVideoPreview uri={item.rendered.url} jobId={item.rendered.jobId} /> : <Play size={32} color={colors.yellow} />}
        <View style={s.playPill}><Play size={12} color="white" fill="white" /><Text style={s.playText}>Watch</Text></View>
      </Pressable>
      <View style={s.summary}>
        <View style={s.row}><Text style={[s.status, data?.connection && { color: colors.green }]}>{data?.connection ? "POST LINKED" : item.rendered ? "READY TO POST" : "CONCEPT PREVIEW"}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.title} from bucket`} onPress={() => act(item.id, "unqueue")} style={s.icon}><X size={16} color={colors.muted} /></Pressable></View>
        <Text numberOfLines={3} style={s.title}>{item.hook || item.title}</Text>
        {data?.connection ? <Text numberOfLines={2} style={s.small}>{latest?.channel ? `YouTube · ${latest.channel}` : "YouTube post connected"}</Text> : <Text style={s.small}>Post it yourself, then connect the link below.</Text>}
        <View style={s.row}>
          <Pressable accessibilityRole="button" accessibilityLabel={item.saved ? "Remove bookmark" : "Save bookmark"} onPress={() => act(item.id, item.saved ? "unsave" : "save")} style={s.icon}><Bookmark size={19} color={item.saved ? "#7D6614" : colors.muted} fill={item.saved ? "#7D6614" : "transparent"} /></Pressable>
          <Pressable accessibilityRole="button" onPress={onPlan} style={s.draft}><CalendarDays size={16} color={colors.green} /><Text style={s.link}>{item.plan ? "Edit plan" : "Plan"}</Text></Pressable>
        </View>
        {item.plan ? <Text style={s.small}>{item.plan.date} · {item.plan.time}{"\n"}Draft only · not scheduled</Text> : null}
      </View>
    </View>
    <View style={s.platforms}>{platforms.map((name) => <View key={name} style={s.platformCell}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${name}${name === "YouTube" ? " Shorts: connect posted video" : ": coming soon"}`} accessibilityState={{ disabled: name !== "YouTube" || !jobId, selected: name === "YouTube" && !!data?.connection }} disabled={name !== "YouTube" || !jobId} onPress={() => { setEditing(true); setError(""); setConfirmed(false); setUrl(data?.connection ? `https://youtube.com/shorts/${data.connection.videoId}` : ""); }} style={[s.platform, name === "YouTube" && s.youtube, name !== "YouTube" && { opacity: 0.4 }]}>
        <PlatformIcon name={name} active={name === "YouTube"} />{name === "YouTube" && data?.connection ? <View style={s.check}><Check size={9} color="white" /></View> : null}
      </Pressable><Text style={s.platformName}>{name}</Text>
    </View>)}</View>
    {data?.connection ? <YouTubeMetrics data={data} busy={busy} refresh={() => void request("refresh")} disconnect={() => void request("disconnect")} /> : <Text style={s.small}>{jobId ? "YouTube Shorts tracking is ready to connect. Other platforms coming soon." : "Finish rendering this concept to connect a published post."}</Text>}
    {busy ? <ActivityIndicator size="small" color={colors.green} /> : null}
    {error && !editing ? <Pressable accessibilityRole="button" onPress={() => void request()}><Text accessibilityRole="alert" style={s.error}>{error} Tap to retry.</Text></Pressable> : null}
    {editing ? <BriefEditSheet title={data?.connection ? "Connected YouTube post" : "Connect your YouTube Short"} visible onClose={() => { if (!busy) setEditing(false); }} saveLabel={data?.connection ? "Done" : "Connect & track"} saveDisabled={!data?.connection && (!confirmed || !url.trim())} saveLoading={busy} error={error} onSave={() => {
      if (data?.connection) { setEditing(false); return; }
      try { youtubeVideoId(url); } catch (reason) { setError((reason as Error).message); return; }
      void request("connect");
    }}>
      <Text style={s.copy}>Already posted? Add the public link to see views, likes, and comments here. Tracking starts now; automatic learning comes later.</Text>
      <TextInput accessibilityLabel="YouTube video link" placeholder="https://youtube.com/shorts/..." value={url} editable={!busy && !data?.connection} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={s.input} />
      {!data?.connection ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} disabled={busy} onPress={() => setConfirmed(!confirmed)} style={[s.row, { gap: 12, paddingVertical: 8 }]}><View style={[s.checkbox, confirmed && { backgroundColor: colors.green }]}>{confirmed ? <Check size={16} color="white" /> : null}</View><Text style={[s.copy, { flex: 1 }]}>This is my post of this video. Track its public metrics for me.</Text></Pressable> : <Text style={s.copy}>{latest?.title}</Text>}
      {data && !data.configured ? <Text style={s.error}>Server setup needed: add YOUTUBE_DATA_API_KEY and enable YouTube Data API v3.</Text> : null}
      <Text style={s.small}>Only public videos are supported. A pasted link doesn’t verify channel ownership or Shorts classification. Hourly observations are kept for 28 days; disconnecting removes them. No comment text is collected or sent to AI.</Text>
      <View style={s.row}><Pressable accessibilityRole="link" onPress={() => void Linking.openURL("https://www.youtube.com/t/terms")}><Text style={s.link}>YouTube terms</Text></Pressable><Pressable accessibilityRole="link" onPress={() => void Linking.openURL("https://policies.google.com/privacy")}><Text style={s.link}>Google privacy</Text></Pressable></View>
    </BriefEditSheet> : null}
  </View>;
}
const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 26, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 14 },
  top: { flexDirection: "row", gap: 14 }, video: { width: "39%", aspectRatio: 9 / 16, backgroundColor: colors.ink, borderRadius: 16, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  summary: { flex: 1, gap: 7 }, row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 5 },
  status: { fontSize: 9, color: colors.muted, letterSpacing: 0.6, fontWeight: "700", flex: 1 }, title: { color: colors.ink, fontFamily: fonts.heading, fontSize: 16, lineHeight: 23 },
  small: { color: colors.muted, fontSize: 11, lineHeight: 17 }, copy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  icon: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" }, draft: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 }, link: { color: colors.green, fontSize: 12, fontWeight: "600" },
  playPill: { position: "absolute", bottom: 8, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#171A13A0", padding: 8, borderRadius: 20 }, playText: { color: "white", fontSize: 10 },
  platforms: { flexDirection: "row", justifyContent: "space-between", gap: 4 }, platformCell: { alignItems: "center", gap: 5, flex: 1 },
  platform: { width: 46, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }, youtube: { backgroundColor: "#FDEAE8", borderWidth: 1, borderColor: "#F2BFB8" }, platformName: { color: colors.muted, fontSize: 9 },
  check: { position: "absolute", right: -2, top: -2, padding: 3, borderRadius: 10, backgroundColor: colors.green },
  input: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, color: colors.ink, fontSize: 14 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: colors.green, alignItems: "center", justifyContent: "center" },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
});
