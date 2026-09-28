import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams, useIsFocused } from "expo-router";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import type { StudioJob, StudioVideoInput } from "@shared/studio";
import { CreatorStudio } from "@/components/CreatorStudio";
import { PrimaryButton } from "@/components/PrimaryButton";
import { RenderedVideo } from "@/components/RenderedVideo";
import { WorkspacePage, workspace as s } from "@/components/WorkspacePage";
import { useContent } from "@/context/ContentContext";
import { getStudioJob, startStudioJob, studioRequestId } from "@/lib/studio-api";
import { colors } from "@/theme";
import { useBilling } from "@/context/BillingContext";
import { SubscriptionPlans } from "@/components/SubscriptionPlans";

export default function StudioScreen() {
  const params = useLocalSearchParams<{ reuseJobId?: string }>();
  const billing = useBilling();
  if (billing.loading) return <WorkspacePage compact title="Studio" subtitle="Checking your plan…"><ActivityIndicator color={colors.green} /></WorkspacePage>;
  if (!billing.status?.studioAccess) return <WorkspacePage compact title="Unlock Studio" subtitle="Choose your creator. Make it yours."><SubscriptionPlans /></WorkspacePage>;
  return params.reuseJobId ? <CaptionEditor key={params.reuseJobId} id={params.reuseJobId} /> : <CreatorStudio />;
}

function CaptionEditor({ id }: { id: string }) {
  const focused = useIsFocused();
  const { importVideo } = useContent();
  const [original, setOriginal] = useState<StudioJob | null>(null);
  const [job, setJob] = useState<StudioJob | null>(null);
  const [hook, setHook] = useState("");
  const [demoCaption, setDemoCaption] = useState("");
  const [position, setPosition] = useState<StudioVideoInput["demoTextPosition"]>("top");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef<StudioVideoInput | null>(null);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const importRef = useRef(importVideo); importRef.current = importVideo;
  const imported = useRef("");
  useEffect(() => {
    mounted.current = true;
    void getStudioJob(id).then((value) => {
      if (!mounted.current) return;
      if (!value.canReuse) throw new Error("This video has no saved creator footage to reuse.");
      setOriginal(value); setHook(value.input.hook); setDemoCaption(value.input.demoCaption); setPosition(value.input.demoTextPosition);
    }).catch((reason) => { if (mounted.current) setError(reason.message); });
    return () => { mounted.current = false; };
  }, [id]);
  useEffect(() => {
    if (!job || ["succeeded", "failed"].includes(job.status)) return;
    let active = true;
    const timer = setTimeout(() => { void getStudioJob(job.id).then((value) => { if (active) setJob(value); }).catch(() => { if (active) { setError("Connection interrupted. Checking your saved job again shortly."); setJob({ ...job }); } }); }, 3000);
    return () => { active = false; clearTimeout(timer); };
  }, [job]);
  useEffect(() => { if (job?.status === "succeeded" && job.videoUrl && imported.current !== job.id) { imported.current = job.id; importRef.current(job); } }, [job]);
  async function render() {
    if (!original || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      attempt.current ??= { ...original.input, id: studioRequestId(), uploadId: undefined, creatorId: undefined, savedCreatorJobId: undefined, post: undefined, reuseJobId: original.id, hook, demoCaption, demoTextPosition: position, approved: true };
      const value = await startStudioJob(attempt.current);
      if (mounted.current) setJob(value);
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : "Couldn’t start this render."); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  function editAgain() {
    if (job?.status === "succeeded") {
      setOriginal(job);
      setHook(job.input.hook);
      setDemoCaption(job.input.demoCaption);
      setPosition(job.input.demoTextPosition);
    }
    setJob(null); attempt.current = null; setError("");
  }
  const locked = busy || Boolean(attempt.current);
  return <WorkspacePage title="Keep the footage. Change the words." subtitle="Your original clips and timing stay the same. No Higgsfield generation.">
    <Pressable onPress={() => router.setParams({ reuseJobId: "" })} style={s.chip}><Text style={s.copy}>← Back to creator library</Text></Pressable>
    {job ? <View style={s.panel}><Text style={s.sectionTitle}>{job.status === "succeeded" ? "Your video is ready" : job.status.replaceAll("_", " ")}</Text>{focused && job.videoUrl ? <RenderedVideo uri={job.videoUrl} jobId={job.id} post={job.post} onEditCaptions={job.status === "succeeded" ? editAgain : undefined} /> : !["succeeded", "failed"].includes(job.status) ? <ActivityIndicator color={colors.green} /> : null}{job.error ? <Text style={{ color: colors.danger }}>{job.error}</Text> : null}{job.status === "failed" ? <PrimaryButton onPress={editAgain}>Back to captions</PrimaryButton> : null}</View> : <View style={s.panel}>
      {!original && !error ? <ActivityIndicator color={colors.green} /> : null}
      {[{ label: "Hook caption", value: hook, set: setHook }, { label: "Demo caption", value: demoCaption, set: setDemoCaption }].map((field) => <View key={field.label} style={{ gap: 8 }}><Text style={s.copy}>{field.label}</Text><TextInput accessibilityLabel={field.label} editable={!locked} multiline maxLength={180} value={field.value} onChangeText={field.set} style={{ backgroundColor: colors.canvas, padding: 14, borderRadius: 16, minHeight: 90, fontSize: 15, lineHeight: 22, color: colors.ink }} /></View>)}
      <Text style={s.small}>Demo text placement</Text><View style={s.row}>{(["top", "middle", "bottom"] as const).map((value) => <Pressable key={value} disabled={locked} accessibilityRole="radio" accessibilityState={{ checked: position === value }} onPress={() => setPosition(value)} style={[s.chip, position === value && s.selected]}><Text style={s.copy}>{value}</Text></Pressable>)}</View>
      <Text style={s.small}>FFmpeg re-renders your saved footage. Gemini writes fresh post copy and hashtags. Text, storage and server usage still apply.</Text>
      <PrimaryButton disabled={!original || !hook.trim() || !demoCaption.trim() || busy} loading={busy} onPress={() => void render()}>{attempt.current ? "Retry connection (same request)" : "Regenerate video"}</PrimaryButton>
    </View>}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
  </WorkspacePage>;
}
