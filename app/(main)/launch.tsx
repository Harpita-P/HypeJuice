import { useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { planError, type ContentConcept } from "@shared/content";
import { BriefEditSheet } from "@/components/BriefEditSheet";
import { LaunchVideoCard } from "@/components/LaunchVideoCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { WorkspacePage, workspace as s } from "@/components/WorkspacePage";
import { useContent } from "@/context/ContentContext";
import { colors } from "@/theme";

export default function LaunchScreen() {
  const router = useRouter();
  const { concepts } = useContent();
  const [planning, setPlanning] = useState<ContentConcept | null>(null);
  const loved = concepts.filter((item) => item.queued);
  return <WorkspacePage title="Launch Bucket" subtitle="Post it. Connect it. See how it’s doing.">
    <Text style={s.small}>{loved.length} video{loved.length === 1 ? "" : "s"} · Manual posting, real YouTube metrics</Text>
    {loved.map((item, index) => <LaunchVideoCard key={item.rendered?.jobId ?? item.id} item={item} preview={index < 3} onPlan={() => setPlanning(item)} />)}
    {!loved.length ? <View style={s.panel}><Text style={s.sectionTitle}>Make room for the good ones</Text><Text style={s.copy}>Tap Launch in Discover or Library to add a concept here. Saving to Library doesn’t automatically queue a post.</Text><PrimaryButton onPress={() => router.navigate("/(main)/library")}>Browse concepts</PrimaryButton></View> : null}
    {planning ? <PlanEditor item={planning} onClose={() => setPlanning(null)} /> : null}
  </WorkspacePage>;
}

function PlanEditor({ item, onClose }: { item: ContentConcept; onClose: () => void }) {
  const { plan: savePlan } = useContent();
  const [plan, setPlan] = useState(item.plan ?? { channel: "Instagram Reels", date: "", time: "", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  const [error, setError] = useState("");
  return <BriefEditSheet title="Plan its moment" visible onClose={onClose} error={error} onSave={() => {
    const problem = planError(plan);
    if (problem) { setError(problem); return; }
    savePlan(item.id, plan); onClose();
  }}>
    <Text style={s.copy}>Save a draft posting plan. This does not schedule or publish the video. After posting manually, connect its YouTube link in the bucket.</Text>
    <View style={{ gap: 8 }}>{["TikTok", "Instagram Reels", "YouTube Shorts"].map((channel) => <Pressable key={channel} accessibilityRole="radio" accessibilityState={{ checked: plan.channel === channel }} onPress={() => setPlan({ ...plan, channel })} style={[s.chip, plan.channel === channel && s.selected]}><Text style={s.copy}>{channel}</Text></Pressable>)}</View>
    <Text style={s.copy}>Date</Text><TextInput accessibilityLabel="Posting date" placeholder="YYYY-MM-DD" value={plan.date} maxLength={10} onChangeText={(date) => setPlan({ ...plan, date })} style={local.input} />
    <Text style={s.copy}>Time · 24-hour format</Text><TextInput accessibilityLabel="Posting time" placeholder="HH:MM" value={plan.time} maxLength={5} onChangeText={(time) => setPlan({ ...plan, time })} style={local.input} />
    <Text style={s.small}>Your device timezone: {plan.timezone}</Text>
    {item.plan ? <Pressable accessibilityRole="button" onPress={() => { savePlan(item.id, undefined); onClose(); }} style={s.chip}><Text style={s.copy}>Clear draft plan</Text></Pressable> : null}
  </BriefEditSheet>;
}

const local = StyleSheet.create({
  input: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, fontSize: 16, color: colors.ink },
});
