import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw } from "lucide-react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import type { YouTubeCounts, YouTubeTrackingView } from "@shared/youtube-tracking";
import { colors, fonts } from "@/theme";

const metrics = [["views", "Views"], ["likes", "Likes"], ["comments", "Comments"]] as const;
export function YouTubeMetrics({ data, busy, refresh, disconnect }: { data: YouTubeTrackingView; busy: boolean; refresh: () => void; disconnect: () => void }) {
  const [expanded, setExpanded] = useState(false); const [metric, setMetric] = useState<keyof YouTubeCounts>("views");
  const [confirm, setConfirm] = useState(false);
  const latest = data.snapshots.at(-1);
  const samples = data.snapshots.filter((sample) => sample.counts?.[metric] != null);
  const values = samples.map((sample) => ({ time: Date.parse(sample.checkedAt), value: sample.counts![metric]! }));
  const max = Math.max(1, ...values.map((point) => point.value));
  const from = values[0]?.time ?? 0; const duration = Math.max(1, (values.at(-1)?.time ?? from) - from);
  const points = values.map((point) => ({ x: 10 + (point.time - from) / duration * 280, y: 78 - point.value / max * 65 }));
  return <View style={s.panel}>
    <View style={s.row}><Text style={s.source}>YOUTUBE · REPORTED COUNTS</Text><Pressable accessibilityRole="button" accessibilityLabel="Refresh YouTube metrics" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={refresh} style={s.icon}>{busy ? <ActivityIndicator size="small" color={colors.green} /> : <RefreshCw size={17} color={colors.green} />}</Pressable></View>
    <View style={s.row}>{metrics.map(([key, label]) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={`Show ${label.toLowerCase()} history`} accessibilityState={{ selected: metric === key }} onPress={() => { setMetric(key); setExpanded(true); }} style={[s.stat, expanded && metric === key && s.selected]}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={s.value}>{latest?.counts?.[key] == null ? "—" : latest.counts[key].toLocaleString()}</Text><Text style={s.label}>{label}</Text>
    </Pressable>)}</View>
    {latest?.issue ? <Text accessibilityRole="alert" style={s.error}>{latest.issue} Previous observations remain in history.</Text> : null}
    <View style={s.row}><Text accessibilityLiveRegion="polite" style={[s.small, { flex: 1 }]}>{latest ? `${latest.issue ? "Last attempt" : "Last checked"} ${new Date(latest.checkedAt).toLocaleString()}` : "Waiting for the first check"}</Text><Pressable accessibilityRole="button" accessibilityLabel={expanded ? "Hide metrics history" : "Show metrics history"} onPress={() => setExpanded(!expanded)} style={s.toggle}><Text style={s.link}>History</Text>{expanded ? <ChevronUp size={16} color={colors.green} /> : <ChevronDown size={16} color={colors.green} />}</Pressable></View>
    {expanded ? <View style={{ gap: 8 }}>
      <Text style={s.small}>{metrics.find(([key]) => key === metric)?.[1]} · captured totals · last 28 days</Text>
      {values.length >= 2 ? <>
        <Text style={s.small}>{max.toLocaleString()}</Text>
        <Svg width="100%" height={90} viewBox="0 0 300 90" accessibilityLabel={`${metric} history: ${values.map((point) => `${new Date(point.time).toLocaleString()}: ${point.value}`).join("; ")}`} accessibilityRole="image">
          <Line x1={10} y1={78} x2={290} y2={78} stroke={colors.border} />
          <Polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={colors.green} strokeWidth={2.5} />
          {points.length < 40 ? points.map((point, index) => <Circle key={index} cx={point.x} cy={point.y} r={2.5} fill={colors.green} />) : null}
        </Svg>
        <View style={s.row}><Text style={s.small}>{new Date(from).toLocaleString()}</Text><Text style={s.small}>{new Date(values.at(-1)!.time).toLocaleString()}</Text></View>
      </> : <Text style={s.small}>Your timeline starts when you connect. The next hourly check adds another point—earlier performance isn’t available from a link.</Text>}
      <Text style={s.small}>Checks run hourly while the server is online. Missing counts aren’t zero. No AI scoring or automatic learning.</Text>
      {data.connection ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`https://www.youtube.com/watch?v=${data.connection!.videoId}`)} style={s.toggle}><ExternalLink size={15} color={colors.green} /><Text style={s.link}>Open posted video on YouTube</Text></Pressable> : null}
      <Pressable disabled={busy} accessibilityRole="button" onPress={() => setConfirm(!confirm)}><Text style={s.small}>Disconnect tracking</Text></Pressable>
      {confirm ? <View style={{ gap: 8 }}><Text style={s.small}>Delete this link and its stored metrics? Your YouTube post stays live.</Text><Pressable disabled={busy} onPress={disconnect} style={s.toggle}><Text style={s.error}>Yes, disconnect and delete metrics</Text></Pressable></View> : null}
    </View> : null}
  </View>;
}
const s = StyleSheet.create({
  panel: { gap: 8, padding: 12, borderRadius: 18, backgroundColor: colors.canvas },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  source: { color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  icon: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  stat: { flex: 1, gap: 4, padding: 8, borderRadius: 12, minHeight: 60 }, selected: { backgroundColor: colors.greenSoft },
  value: { fontFamily: fonts.heading, color: colors.ink, fontSize: 21 }, label: { color: colors.muted, fontSize: 12 },
  small: { color: colors.muted, fontSize: 10, lineHeight: 16 }, error: { color: colors.danger, fontSize: 11, lineHeight: 17 },
  toggle: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5 }, link: { color: colors.green, fontSize: 12, fontWeight: "600" },
});
