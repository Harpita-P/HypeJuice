import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useIsFocused } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { StudioConfig, StudioJob, StudioVideoInput } from "@shared/studio";
import { StudioVideoInputSchema } from "@shared/studio";
import { PrimaryButton } from "@/components/PrimaryButton";
import { RenderedVideo } from "@/components/RenderedVideo";
import { WorkspacePage, workspace as s } from "@/components/WorkspacePage";
import { useAppProfile } from "@/context/AppProfileContext";
import { useContent } from "@/context/ContentContext";
import { getStudioConfig, getStudioJob, getStudioJobs, startStudioJob, studioRequestId, uploadStudioDemo } from "@/lib/studio-api";
import { colors } from "@/theme";

const LABELS = { queued: "Preparing your video", writing_post: "Writing your post caption & hashtags", submitting_creator: "Starting creator generation", generating: "Generating your creator", assembling_local: "Adding text & stitching on your server", submitting_render: "Starting video assembly", rendering: "Adding captions & stitching clips", saving: "Saving your finished video", succeeded: "Your video is ready", failed: "This video needs attention" };

export default function StudioScreen() {
  const { analysis } = useAppProfile();
  const { importVideo } = useContent();
  const params = useLocalSearchParams<{ reuseJobId?: string }>();
  const focused = useIsFocused();
  const clips = analysis?.demoClips ?? [];
  const profileKey = analysis?.sources.find((source) => source.url)?.url ?? analysis?.brief.appName ?? "";
  const [config, setConfig] = useState<StudioConfig | null>(null);
  const [prompt, setPrompt] = useState("");
  const [clipId, setClipId] = useState(clips[0]?.id ?? "");
  const [hook, setHook] = useState("");
  const [demoCaption, setDemoCaption] = useState(clips[0]?.shows ?? "");
  const [seconds, setSeconds] = useState(String(Math.min(10, (clips[0]?.durationMs ?? 10000) / 1000)));
  const [position, setPosition] = useState<StudioVideoInput["demoTextPosition"]>("top");
  const [approved, setApproved] = useState(false);
  const [job, setJob] = useState<StudioJob | null>(null);
  const [reuse, setReuse] = useState<StudioJob | null>(null);
  const [recent, setRecent] = useState<StudioJob[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const attempt = useRef<{ input: StudioVideoInput; uploaded: boolean } | null>(null);
  const imported = useRef("");
  const loadedParam = useRef("");
  const importLatest = useRef(importVideo); importLatest.current = importVideo;

  async function refreshConfig() { try { setConfig(await getStudioConfig()); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t reach your API server."); } }
  useEffect(() => { void refreshConfig(); }, []);
  function useOriginal(original: StudioJob) {
    if (!original.canReuse) { setError("This job has no saved creator footage to reuse."); return; }
    setReuse(original); setJob(null); attempt.current = null; setApproved(false);
    setPrompt(original.input.prompt); setClipId(original.input.clipId); setHook(original.input.hook);
    setDemoCaption(original.input.demoCaption); setSeconds(String(original.input.demoSeconds)); setPosition(original.input.demoTextPosition); setError("");
  }
  useEffect(() => {
    if (!params.reuseJobId || !config?.ready || loadedParam.current === params.reuseJobId) return;
    loadedParam.current = params.reuseJobId;
    void getStudioJob(params.reuseJobId).then(useOriginal).catch((reason) => { loadedParam.current = ""; setError(reason.message); });
  }, [params.reuseJobId, config?.ready]);
  useEffect(() => {
    if (!job || ["succeeded", "failed"].includes(job.status)) return;
    let active = true;
    const timer = setTimeout(() => {
      void getStudioJob(job.id).then((value) => { if (active) { setJob(value); setError(""); } }).catch((reason) => { if (active) setError("Connection interrupted. Your job may still be running. " + reason.message); });
    }, 3000);
    return () => { active = false; clearTimeout(timer); };
  }, [job]);
  useEffect(() => {
    if (job?.status === "succeeded" && job.videoUrl && imported.current !== job.id) {
      imported.current = job.id; importLatest.current(job);
    }
  }, [job]);

  async function generate() {
    if (busyRef.current || !approved || !analysis) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      if (!attempt.current) {
        const id = studioRequestId();
        const parsed = StudioVideoInputSchema.safeParse({ id, appName: analysis.brief.appName, brief: analysis.brief, profileKey, clipId,
          ...(reuse ? { reuseJobId: reuse.id } : { uploadId: studioRequestId() }),
          prompt, hook, demoCaption, demoSeconds: Number(seconds), demoTextPosition: position, approved: true });
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check your inputs.");
        const clip = clips.find((entry) => entry.id === clipId);
        if (!reuse && (!clip || (clip.durationMs && Number(seconds) > clip.durationMs / 1000))) throw new Error("Choose a demo length that fits the uploaded clip.");
        attempt.current = { input: parsed.data, uploaded: Boolean(reuse) };
      }
      const pending = attempt.current;
      if (!pending.uploaded) {
        const clip = clips.find((entry) => entry.id === pending.input.clipId);
        if (!clip) throw new Error("Choose an available demo clip.");
        await uploadStudioDemo(clip, pending.input.uploadId!); pending.uploaded = true;
      }
      setJob(await startStudioJob(pending.input));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t start this video."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function loadRecent() {
    try { setRecent((await getStudioJobs()).filter((entry) => entry.input.profileKey === profileKey)); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t load renders."); }
  }
  const locked = busy || Boolean(attempt.current);
  return <WorkspacePage title="Your creative studio" subtitle="A three-second creator hook. Your real app. One silent video.">
    {!config?.ready ? <View style={s.panel}><Text style={s.sectionTitle}>Connect video generation</Text><Text style={s.copy}>{config ? "Add these server settings to .env: " + config.missing.join(", ") : "Checking your API server…"}</Text><Text style={s.small}>Higgsfield + local FFmpeg + private Supabase storage. Install FFmpeg on the API server and restart after setting the keys.</Text><PrimaryButton onPress={() => void refreshConfig()}>Check setup</PrimaryButton></View> : null}
    {job ? <View style={s.panel}>
      <Text accessibilityRole="header" style={s.sectionTitle}>{LABELS[job.status]}</Text>
      {job.status === "succeeded" && job.videoUrl ? <>
        {focused ? <RenderedVideo key={job.videoUrl} uri={job.videoUrl} jobId={job.id} post={job.post} /> : null}
        <Text style={s.copy}>Added to Library · Studio created</Text>
      </> : !["failed", "succeeded"].includes(job.status) ? <ActivityIndicator color={colors.green} /> : null}
      {job.error ? <Text style={local.error}>{job.error}</Text> : null}
      <Text selectable style={s.small}>Job ID: {job.id}</Text>
      <Pressable accessibilityRole="button" onPress={() => { void getStudioJob(job.id).then((value) => { imported.current = ""; setJob(value); setError(""); }).catch((reason) => setError(reason.message)); }} style={s.chip}><Text style={s.copy}>Check status / refresh playback</Text></Pressable>
      {job.canReuse && ["succeeded", "failed"].includes(job.status) ? <PrimaryButton onPress={() => useOriginal(job)}>{job.status === "failed" ? "Retry assembly with saved footage" : "Edit captions & re-render"}</PrimaryButton> : null}
      {["succeeded", "failed"].includes(job.status) ? <Pressable accessibilityRole="button" onPress={() => { setJob(null); setReuse(null); setApproved(false); attempt.current = null; setError(""); }} style={s.chip}><Text style={s.copy}>Start a new video</Text></Pressable> : null}
    </View> : <>
      <View style={s.panel}>
        <Text style={s.sectionTitle}>{reuse ? "Keep the footage. Change the words." : "Describe your creator"}</Text>
        <TextInput accessibilityLabel="Creator prompt" editable={!locked && !reuse} value={prompt} onChangeText={setPrompt} multiline maxLength={2000} placeholder="An adult female creator, close-up iPhone selfie at home, reacting with wide-eyed surprise and bringing one hand over her mouth…" placeholderTextColor={colors.muted} style={local.input} />
        <Text style={s.small}>{reuse ? "Reuses the original creator and demo footage with a 3-second hook. Higgsfield will not be called." : "Fictional adult creator · 3-second final hook · portrait · no speech or generated text. Higgsfield generates its 4-second minimum; we trim the saved clip in assembly."} A separate post caption and up to five relevant hashtags are written with Gemini; text usage applies.</Text>
      </View>
      <View style={s.panel}><Text style={s.sectionTitle}>Fixed on-screen captions</Text>
        {[{ label: "Hook caption", value: hook, set: setHook }, { label: "Demo caption", value: demoCaption, set: setDemoCaption }].map((field) => <View key={field.label} style={{ gap: 8 }}><Text style={s.copy}>{field.label}</Text><TextInput accessibilityLabel={field.label} editable={!locked} multiline maxLength={180} value={field.value} onChangeText={field.set} style={local.input} /></View>)}
        <Text style={s.small}>Bold white text, black outline. No subtitle animation. Hook text is centered; choose where the demo text sits.</Text>
        <View style={s.row}>{(["top", "middle", "bottom"] as const).map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={"Demo caption " + value} accessibilityState={{ checked: position === value }} disabled={locked} onPress={() => setPosition(value)} style={[s.chip, position === value && s.selected]}><Text style={s.copy}>{value}</Text></Pressable>)}</View>
      </View>
      {!reuse ? <View style={s.panel}><Text style={s.sectionTitle}>Your demo clip</Text>
        {clips.map((clip, index) => <Pressable key={clip.id} accessibilityRole="radio" accessibilityLabel={"Use clip " + (index + 1)} accessibilityState={{ checked: clipId === clip.id }} disabled={locked} onPress={() => { setClipId(clip.id); setSeconds(String(Math.min(10, (clip.durationMs ?? 10000) / 1000))); }} style={[s.chip, clipId === clip.id && s.selected]}><Text style={s.copy}>Clip {index + 1} · {clip.shows}</Text></Pressable>)}
        <Text style={s.copy}>Seconds to use from the start (1–10)</Text><TextInput accessibilityLabel="Demo seconds" editable={!locked} keyboardType="decimal-pad" value={seconds} onChangeText={setSeconds} style={local.shortInput} />
        <Text style={s.small}>The full app interface is fitted without cropping. Existing clip audio is muted.</Text>
      </View> : null}
      <View style={[s.panel, { backgroundColor: colors.yellowSoft }]}><Text style={s.sectionTitle}>{reuse ? "Approve caption rendering" : "Approve this test video"}</Text>
        <Text style={s.copy}>{reuse ? "Reuses your saved footage. Captions and stitching run on your server with FFmpeg—no Higgsfield or Creatomate charge." : "Uses paid Higgsfield credits for one creator clip. FFmpeg adds text and stitches your demo on your server, with no rendering API fee."} Output is 720 × 1280. Storage and server costs still apply.</Text>
        <Pressable accessibilityRole="checkbox" accessibilityLabel={reuse ? "Approve local assembly" : "Approve paid generation"} accessibilityState={{ checked: approved }} disabled={locked} onPress={() => setApproved(!approved)} style={s.chip}><Text style={s.copy}>{approved ? "☑" : "☐"} {reuse ? "Render using my saved footage" : "I approve this paid Higgsfield request"}</Text></Pressable>
        <PrimaryButton disabled={!config?.ready || !approved || (!reuse && !clips.length)} loading={busy} onPress={() => void generate()}>{busy ? "Uploading / starting…" : attempt.current ? "Retry connection (same request)" : reuse ? "Render captions with saved footage" : "Generate 1 video"}</PrimaryButton>
        {attempt.current ? <Text selectable style={s.small}>Request ID: {attempt.current.input.id}. Retry keeps this ID to avoid duplicate generation.</Text> : null}
      </View>
    </>}
    {error ? <Text accessibilityRole="alert" style={local.error}>{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={!config?.ready} onPress={() => void loadRecent()} style={s.chip}><Text style={s.copy}>Recent renders for this app</Text></Pressable>
    {recent.map((entry) => <Pressable key={entry.id} accessibilityRole="button" onPress={() => { setJob(entry); attempt.current = null; imported.current = ""; }} style={s.panel}><Text style={s.copy}>{entry.input.hook}</Text><Text style={s.small}>{LABELS[entry.status]} · {new Date(entry.createdAt).toLocaleString()}</Text></Pressable>)}
    <Text style={s.small}>One-founder local test. Jobs and private cloud videos survive app reloads; keep this API server running. Publishing is not connected.</Text>
  </WorkspacePage>;
}

const local = StyleSheet.create({
  input: { backgroundColor: colors.canvas, padding: 14, borderRadius: 16, minHeight: 100, fontSize: 15, lineHeight: 22, color: colors.ink, textAlignVertical: "top" },
  shortInput: { backgroundColor: colors.canvas, padding: 14, borderRadius: 16, fontSize: 14, color: colors.ink, minHeight: 48 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 20 },
});
