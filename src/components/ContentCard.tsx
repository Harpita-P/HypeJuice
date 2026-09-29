import { useState } from "react";
import { useIsFocused, useRouter } from "expo-router";
import { Star, Check, Pencil, Rocket, UserRound, X } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { type ContentConcept } from "@shared/content";
import { useAppProfile } from "@/context/AppProfileContext";
import { useContent } from "@/context/ContentContext";
import { BriefEditSheet } from "./BriefEditSheet";
import { InlineClipPreview } from "./DemoRecordingStep";
import { RenderedVideo } from "./RenderedVideo";
import { colors, fonts } from "@/theme";

export function ContentCard({ item }: { item: ContentConcept }) {
  const { analysis } = useAppProfile();
  const [editing, setEditing] = useState(false);
  const focused = useIsFocused();
  const router = useRouter();
  const clip = analysis?.demoClips?.find((entry) => entry.id === item.clipId);
  if (item.rendered) return <View style={s.card}>
    <View style={s.row}><Text style={s.eyebrow}>HOOK + DEMO</Text><Text style={s.badge}>Rendered video · silent</Text></View>
    <Text accessibilityRole="header" style={s.title}>{item.title}</Text>
    {focused ? <RenderedVideo key={item.rendered.url} uri={item.rendered.url} jobId={item.rendered.jobId} post={item.post} onEditCaptions={() => router.navigate({ pathname: "/(main)/studio", params: { reuseJobId: item.rendered!.jobId } })} /> : null}
    <ContentActions item={item} />
    <Text style={s.small}>Caption changes are rendered in Studio using your saved footage. FFmpeg runs on your server, with no new Higgsfield generation or rendering API fee.</Text>
  </View>;
  return <View style={s.card}>
    <View style={s.row}><Text style={s.eyebrow}>HOOK + DEMO</Text><Text style={s.badge}>Concept preview</Text></View>
    <Text accessibilityRole="header" style={s.title}>{item.title}</Text>
    <View style={s.hook}>
      <View style={s.row}><UserRound size={25} color={colors.yellow} /><Text style={s.creator}>{item.creator} · placeholder</Text></View>
      <Text style={s.hookText}>{item.hook}</Text>
      <Text style={s.hookHint}>Silent creator hook · on-screen caption</Text>
    </View>
    {item.creatorPrompt ? <Text style={s.small}>Creator direction: {item.creatorPrompt}</Text> : null}
    <View style={s.demo}>
      <Text style={s.label}>THEN, YOUR APP IN ACTION</Text>
      {clip ? focused ? <InlineClipPreview clip={clip} index={analysis?.demoClips?.indexOf(clip) ?? 0} /> : null : <Text style={s.copy}>Demo clip unavailable. Return to setup to add one.</Text>}
      <Text style={s.caption}>{item.demoCaption}</Text>
      <Text style={s.payoff}>{item.payoff}</Text>
    </View>
    <Text style={s.small}>Storyboard only · not a rendered video</Text>
    <ContentActions item={item} onEdit={() => setEditing(true)} />
    {editing ? <ContentEditor item={item} onClose={() => setEditing(false)} /> : null}
  </View>;
}

export function ContentActions({ item, onEdit, onIgnore, reviewable = false }: { item: ContentConcept; onEdit?: () => void; onIgnore?: () => void; reviewable?: boolean }) {
  const { act, feedback, review } = useContent();
  const ratingBusy = !feedback.ready || feedback.busy;
  return <View style={{ gap: 6 }}><View style={s.actions}>
    {reviewable ? <Pressable accessibilityRole="button" accessibilityLabel={`Love ${item.title}`} disabled={ratingBusy} onPress={() => void review(item.id, "loved")} style={[s.action, item.status === "loved" && s.selected]}><Check size={17} color={colors.ink} /><Text style={s.actionText}>{item.status === "loved" ? "Loved" : "Love it"}</Text></Pressable> : <Pressable accessibilityRole="button" accessibilityLabel={`${item.saved ? "Unstar" : "Star"}: ${item.title}`} accessibilityState={{ selected: item.saved }} onPress={() => act(item.id, item.saved ? "unsave" : "save")} style={[s.action, item.saved && s.selected]}><Star size={17} color={colors.ink} fill={item.saved ? colors.ink : "transparent"} /><Text style={s.actionText}>{item.saved ? "Starred" : "Star"}</Text></Pressable>}
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.queued ? "Remove from" : "Add to"} Liftoff: ${item.title}`} accessibilityHint="Changes your launch selection. Does not publish the video." onPress={() => act(item.id, item.queued ? "unqueue" : "queue")} style={[s.action, s.love]}><Rocket size={17} color={colors.ink} /><Text style={s.actionText}>{item.queued ? "In Liftoff" : "Liftoff"}</Text></Pressable>
    {onEdit ? <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.title}`} onPress={onEdit} style={s.action}><Pencil size={17} color={colors.ink} /><Text style={s.actionText}>Captions</Text></Pressable> : null}
    {onIgnore ? <Pressable accessibilityRole="button" accessibilityLabel={`${reviewable ? "Toss" : "Ignore"} ${item.title}`} disabled={reviewable && ratingBusy} onPress={() => { if (reviewable) void review(item.id, "tossed").then((saved) => { if (saved) onIgnore(); }); else { act(item.id, "ignore"); onIgnore(); } }} style={s.action}><X size={17} color={colors.ink} /><Text style={s.actionText}>{reviewable ? "Toss" : "Skip"}</Text></Pressable> : null}
  </View>{feedback.error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{feedback.error}</Text> : null}</View>;
}

export function ContentEditor({ item, onClose }: { item: ContentConcept; onClose: () => void }) {
  const { captions } = useContent();
  const [draft, setDraft] = useState(item);
  const [error, setError] = useState("");
  return <BriefEditSheet title="Edit captions" visible onClose={onClose} error={error} onSave={() => {
    if (![draft.hook, draft.demoCaption, draft.payoff].every((value) => value.trim())) { setError("Add a caption for each part of the story."); return; }
    captions(item.id, draft); onClose();
  }}>
    <Text style={s.copy}>Change the on-screen captions. The creator and video footage stay the same.</Text>
    {([['hook', 'Creator hook caption'], ['demoCaption', 'Demo caption'], ['payoff', 'Payoff caption']] as const).map(([key, label]) => <View key={key} style={s.field}>
      <Text style={s.caption}>{label}</Text><TextInput accessibilityLabel={label} multiline maxLength={400} value={draft[key]} onChangeText={(value) => setDraft({ ...draft, [key]: value })} style={s.input} />
    </View>)}
  </BriefEditSheet>;
}

const s = StyleSheet.create({
  card: { padding: 18, gap: 14, borderRadius: 28, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  eyebrow: { color: colors.green, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  badge: { color: colors.muted, fontSize: 10, backgroundColor: colors.canvas, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  title: { fontFamily: fonts.heading, color: colors.ink, fontSize: 23 },
  hook: { borderRadius: 22, padding: 22, minHeight: 200, gap: 22, justifyContent: "space-between", backgroundColor: colors.ink },
  creator: { color: "#DBDDCF", fontSize: 11, flex: 1 },
  hookText: { color: colors.surface, fontFamily: fonts.heading, fontSize: 25, lineHeight: 33 },
  hookHint: { color: "#BFC4B4", fontSize: 10 },
  demo: { gap: 12, backgroundColor: "#F4F6ED", padding: 13, borderRadius: 20 },
  label: { fontSize: 9, color: colors.green, letterSpacing: 1, fontWeight: "700" },
  caption: { color: colors.ink, fontFamily: fonts.heading, fontSize: 14, lineHeight: 21 },
  payoff: { color: colors.green, fontSize: 14, lineHeight: 21 },
  small: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: "row", gap: 7 },
  action: { flex: 1, minHeight: 48, borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: colors.canvas },
  actionText: { fontSize: 12, fontFamily: fonts.heading, color: colors.ink },
  love: { backgroundColor: colors.yellow },
  field: { gap: 8 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, minHeight: 90, color: colors.ink, fontSize: 15, lineHeight: 22, textAlignVertical: "top" },
  selected: { backgroundColor: colors.greenSoft, borderColor: colors.green },
});
