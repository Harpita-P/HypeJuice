import { useState } from "react";
import { useRouter } from "expo-router";
import { CalendarDays, Send } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { planError, type ContentConcept } from "@shared/content";
import { BriefEditSheet } from "@/components/BriefEditSheet";
import { ContentCard } from "@/components/ContentCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { WorkspacePage, workspace as s } from "@/components/WorkspacePage";
import { useContent } from "@/context/ContentContext";
import { colors } from "@/theme";

export default function LaunchScreen() {
  const router = useRouter();
  const { concepts } = useContent();
  const [planning, setPlanning] = useState<ContentConcept | null>(null);
  const loved = concepts.filter((item) => item.queued);
  return <WorkspacePage title="Launch Bucket" subtitle="Your yes-pile. Shape it, then plan its moment.">
    <View style={[s.panel, { backgroundColor: colors.yellowSoft }]}><Send size={25} color={colors.ink} /><Text style={s.sectionTitle}>{loved.length} item{loved.length === 1 ? "" : "s"} in your bucket</Text><Text style={s.small}>Planning only. Items are labeled as concept previews or finished videos. Nothing here is scheduled or published.</Text></View>
    {loved.map((item) => <View key={item.id} style={{ gap: 10 }}>
      <ContentCard item={item} />
      <Pressable accessibilityRole="button" accessibilityLabel={`Plan ${item.title}`} onPress={() => setPlanning(item)} style={local.planButton}>
        <CalendarDays color={colors.green} size={22} /><View style={{ flex: 1, gap: 4 }}><Text style={s.sectionTitle}>{item.plan ? item.plan.channel : "Pick a posting moment"}</Text><Text style={s.small}>{item.plan ? `${item.plan.date} · ${item.plan.time} · ${item.plan.timezone}\nDraft plan · not scheduled` : "Channel, date & time · draft plan"}</Text></View>
      </Pressable>
    </View>)}
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
    <Text style={s.copy}>Save a draft plan for this concept. Connecting channels and automatic publishing come later.</Text>
    <View style={{ gap: 8 }}>{["TikTok", "Instagram Reels", "YouTube Shorts"].map((channel) => <Pressable key={channel} accessibilityRole="radio" accessibilityState={{ checked: plan.channel === channel }} onPress={() => setPlan({ ...plan, channel })} style={[s.chip, plan.channel === channel && s.selected]}><Text style={s.copy}>{channel}</Text></Pressable>)}</View>
    <Text style={s.copy}>Date</Text><TextInput accessibilityLabel="Posting date" placeholder="YYYY-MM-DD" value={plan.date} maxLength={10} onChangeText={(date) => setPlan({ ...plan, date })} style={local.input} />
    <Text style={s.copy}>Time · 24-hour format</Text><TextInput accessibilityLabel="Posting time" placeholder="HH:MM" value={plan.time} maxLength={5} onChangeText={(time) => setPlan({ ...plan, time })} style={local.input} />
    <Text style={s.small}>Your device timezone: {plan.timezone}</Text>
    {item.plan ? <Pressable accessibilityRole="button" onPress={() => { savePlan(item.id, undefined); onClose(); }} style={s.chip}><Text style={s.copy}>Clear draft plan</Text></Pressable> : null}
  </BriefEditSheet>;
}

const local = StyleSheet.create({
  planButton: { padding: 18, borderRadius: 22, backgroundColor: colors.greenSoft, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  input: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, fontSize: 16, color: colors.ink },
});
