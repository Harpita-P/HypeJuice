import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowUpRight, Sparkles } from "lucide-react-native";
import { latestViewSnapshot, rankedLiftoff } from "@shared/liftoff";
import type { YouTubeTrackingView } from "@shared/youtube-tracking";
import { AgentAvatar } from "@/components/AgentAvatar";
import { LiftoffChat } from "@/components/LiftoffChat";
import { LaunchVideoCard } from "@/components/LaunchVideoCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { WorkspacePage, workspace as s } from "@/components/WorkspacePage";
import { useContent } from "@/context/ContentContext";
import { useAppProfile } from "@/context/AppProfileContext";
import { colors, fonts } from "@/theme";

export default function LaunchScreen() {
  const router = useRouter();
  const { concepts } = useContent();
  const { analysis } = useAppProfile();
  const [metrics, setMetrics] = useState<Record<string, YouTubeTrackingView>>({});
  const [chatOpen, setChatOpen] = useState(false);
  const onMetrics = useCallback((id: string, data: YouTubeTrackingView) => setMetrics((current) => ({ ...current, [id]: data })), []);
  const items = rankedLiftoff(concepts.filter((item) => item.queued), metrics);
  const topViews = latestViewSnapshot(metrics[items[0]?.rendered?.jobId ?? ""])?.counts?.views;
  const jobIds = items.flatMap((item) => item.rendered ? [item.rendered.jobId] : []);
  return <WorkspacePage title="Liftoff" subtitle="See what’s landing. Find your next big idea.">
    <Pressable accessibilityRole="button" accessibilityLabel="Ask your growth agent" onPress={() => setChatOpen(true)} style={local.agent}>
      <View pointerEvents="none" style={local.orbit} /><AgentAvatar />
      <View style={{ flex: 1, gap: 4 }}><Text style={local.agentTitle}>Let’s find your next hit</Text><Text style={local.agentCopy}>Ask me about your results</Text></View>
      <View style={local.arrow}><ArrowUpRight size={22} color={colors.ink} /></View>
    </Pressable>
    {items.length ? <View style={local.heading}><Text style={s.sectionTitle}>Your content in the wild</Text><Sparkles size={23} color={colors.green} /></View> : null}
    {items.map((item, index) => <LaunchVideoCard key={item.rendered?.jobId ?? item.id} item={item} preview={index < 3} topPerformer={index === 0 && topViews != null && topViews > 0} onMetrics={onMetrics} />)}
    {!items.length ? <View style={s.panel}><Text style={s.sectionTitle}>Give your content a runway</Text><Text style={s.copy}>Tap a rocket in your Library. Connect a post here to see what takes off.</Text><PrimaryButton onPress={() => router.navigate("/(main)/library")}>Open Library</PrimaryButton></View> : null}
    <LiftoffChat key={analysis?.analyzedAt ?? "empty"} visible={chatOpen} onClose={() => setChatOpen(false)} jobIds={jobIds} />
  </WorkspacePage>;
}

const local = StyleSheet.create({
  heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  agent: { padding: 18, borderRadius: 28, borderTopRightRadius: 54, backgroundColor: "#CBBBFF", flexDirection: "row", alignItems: "center", gap: 12, overflow: "hidden" },
  orbit: { position: "absolute", width: 100, height: 100, backgroundColor: "#B3A0F4", borderRadius: 50, right: -30, top: -30 },
  agentTitle: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 24, color: colors.ink },
  agentCopy: { fontSize: 12, color: colors.ink, lineHeight: 18 },
  arrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#EAE1FF", alignItems: "center", justifyContent: "center" },
});
