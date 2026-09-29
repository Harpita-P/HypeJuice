import { useCallback, useEffect, useRef, useState } from "react";
import { router, useIsFocused } from "expo-router";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Check, Search, Sparkles, Pencil, Users, ArrowRight, X } from "lucide-react-native";
import type { CreatorCatalog, CreatorIdea, CreatorIdeaRequest } from "@shared/creator-library";
import { creatorPreviewTags, creatorTagValues, matchesCreator } from "@shared/creator-library";
import type { StudioJob, StudioVideoInput } from "@shared/studio";
import { useAppProfile } from "@/context/AppProfileContext";
import { useContent } from "@/context/ContentContext";
import { getCreatorCatalog, getCreatorIdeas, getStudioJob, startStudioJob, studioRequestId, uploadStudioDemo } from "@/lib/studio-api";
import { workspace as s } from "./WorkspacePage";
import { StudioStep } from "./StudioStep";
import { SwipeDecisionCard, type SwipeChoice } from "./SwipeDecisionCard";
import { PrimaryButton } from "./PrimaryButton";
import { VideoVariationPager } from "./VideoVariationPager";
import { ContentMakingLoader } from "./ContentMakingLoader";
import { colors, fonts } from "@/theme";
import { useVideoAutoplay } from "@/lib/use-video-autoplay";

function CreatorPreview({ uri, active, onRetry }: { uri: string; active: boolean; onRetry: () => Promise<void> }) {
  const player = useVideoPlayer(uri, (p) => { p.muted = true; p.loop = true; p.timeUpdateEventInterval = 0.05; });
  const autoplay = useVideoAutoplay(player, active);
  const [status, setStatus] = useState(player.status);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    const sub = player.addListener("timeUpdate", ({ currentTime }) => { if (currentTime >= 4) player.currentTime = 0; });
    const statusSub = player.addListener("statusChange", (event) => setStatus(event.status));
    setStatus(player.status);
    // useVideoPlayer owns release on unmount. Calling pause here after Expo's
    // cleanup can access an already-released native object when filters hide tiles.
    return () => { sub.remove(); statusSub.remove(); };
  }, [player]);
  return <View {...autoplay} style={StyleSheet.absoluteFill}>
    <VideoView pointerEvents="none" player={player} nativeControls={false} contentFit="contain" playsInline surfaceType="textureView" style={StyleSheet.absoluteFill} />
    {status === "loading" || status === "idle" ? <View pointerEvents="none" style={styles.unavailable}><ActivityIndicator color="white" /></View> : null}
    {status === "error" ? <View style={styles.unavailable}><Pressable accessibilityRole="button" accessibilityLabel="Retry creator preview" disabled={retrying} onPress={(event) => { event.stopPropagation(); setRetrying(true); void onRetry(); }} style={styles.retryPreview}><Text style={styles.previewText}>{retrying ? "Reloading…" : "Tap to retry preview"}</Text></Pressable></View> : null}
  </View>;
}
const terminal = (job: StudioJob) => ["succeeded", "failed"].includes(job.status);
const angleColors = ["#FFE044", "#B5EF53", "#FFA480"];
const vibes = [
  { title: "Lightly funny", mark: ":)", color: "#FFE044" },
  { title: "Straight to the point", mark: "↗", color: "#B5EF53" },
  { title: "Emotional", mark: "♡", color: "#FFA480" },
  { title: "Candid", mark: "✳", color: "#BCABFF" },
];
function AngleTags({ idea, fallbackTone }: { idea: CreatorIdea; fallbackTone: string }) {
  return <View style={styles.angleTags}>
    {idea.audience ? <View style={styles.audiencePill}><Users size={12} color="white" /><Text style={styles.audienceText}>{idea.audience}</Text></View> : null}
    {[...new Set(idea.vibes?.length ? idea.vibes : [fallbackTone])].map((vibe) => <View key={vibe} style={styles.vibePill}><Text style={styles.vibeText}>{vibe}</Text></View>)}
  </View>;
}
export function CreatorStudio() {
  const { analysis } = useAppProfile();
  const { importVideo } = useContent();
  const focused = useIsFocused();
  const [catalog, setCatalog] = useState<CreatorCatalog | null>(null);
  const [previewAttempts, setPreviewAttempts] = useState<Record<string, number>>({});
  const [path, setPath] = useState<"library" | "generate">("library");
  const [selected, setSelected] = useState("");
  const [step, setStep] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, SwipeChoice>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"agent" | "manual">("agent");
  const [tone, setTone] = useState("Straight to the point");
  const [hook, setHook] = useState("");
  const [demoCaption, setDemoCaption] = useState("");
  const [ideas, setIdeas] = useState<CreatorIdea[]>([]);
  const [jobs, setJobs] = useState<StudioJob[]>([]);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef<{ input: StudioVideoInput; uploaded: boolean; submitted: boolean }[] | null>(null);
  const ideaRequest = useRef<CreatorIdeaRequest | null>(null);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const importRef = useRef(importVideo); importRef.current = importVideo;
  const imported = useRef(new Set<string>());
  const clips = analysis?.demoClips ?? [];
  const profileKey = analysis?.sources.find((source) => source.url)?.url ?? analysis?.brief.appName ?? "";
  const creator = catalog?.creators.find((entry) => entry.id === selected);
  const locked = busy || Boolean(attempt.current);
  const loadCatalog = useCallback(async () => {
    try { const value = await getCreatorCatalog(); if (mounted.current) { setCatalog(value); setSelected((id) => value.creators.some((entry) => entry.id === id) ? id : ""); setError(""); } }
    catch (reason) { if (mounted.current) setError(String(reason instanceof Error ? reason.message : reason)); }
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // Renew signed URLs when returning to Studio rather than keeping expired links.
  useEffect(() => { if (focused) void loadCatalog(); }, [focused, loadCatalog]);
  async function retryPreview(id: string) {
    // A tap on a failed tile still selects that creator while its URL reloads.
    setSelected(id); invalidate();
    await loadCatalog();
    if (mounted.current) setPreviewAttempts((value) => ({ ...value, [id]: (value[id] ?? 0) + 1 }));
  }
  // Poll all submitted variations, including a shared creator dependency. A
  // transient connection error keeps polling, never resubmits a paid request.
  useEffect(() => {
    if (!jobs.some((job) => !terminal(job))) return;
    let active = true;
    const timer = setTimeout(() => {
      void Promise.all(jobs.map(async (job) => {
        if (terminal(job)) return job;
        try { return await getStudioJob(job.id); }
        catch { if (active) setError("Connection interrupted. Your saved jobs may still be running; checking again shortly."); return job; }
      })).then((values) => { if (active) setJobs(values); });
    }, 3000);
    return () => { active = false; clearTimeout(timer); };
  }, [jobs]);
  useEffect(() => {
    for (const job of jobs) if (job.status === "succeeded" && job.videoUrl && !imported.current.has(job.id)) { imported.current.add(job.id); importRef.current(job); }
  }, [jobs]);

  function invalidate() { setIdeas([]); setDecisions({}); ideaRequest.current = null; setApproved(false); }
  async function brainstorm() {
    if (!analysis || busyRef.current || (path === "generate" && !approved)) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      ideaRequest.current ??= { id: studioRequestId(), brief: analysis.brief, profileKey, creatorId: path === "library" ? selected : undefined, description: path === "generate" ? description : "", tone, count: mode === "manual" ? 1 : 3, mode, hook, demoCaption, demos: clips.map((clip) => ({ clipId: clip.id, shows: clip.shows.trim() || "The app in action; specific visible features are not described.", durationMs: clip.durationMs ?? null })) };
      const response = await getCreatorIdeas(ideaRequest.current);
      if (mounted.current) { setIdeas(response.ideas); setDecisions({}); setStep(2); }
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : "Couldn’t write these angles."); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  async function render(selectedIdeas = ideas.filter((idea) => decisions[idea.id] === "keep")) {
    if (!analysis || busyRef.current || (path === "generate" && !approved) || (!attempt.current && !selectedIdeas.length)) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      if (!attempt.current) {
        const uploads = new Map(clips.map((clip) => [clip.id, clip.uploadId ?? studioRequestId()]));
        const kept = selectedIdeas;
        attempt.current = kept.map((idea, index) => {
          const clip = clips.find((entry) => entry.id === idea.clipId);
          if (!clip) throw new Error("A demo was removed. Go back and find fresh angles with the current clips.");
          return { uploaded: false, submitted: false, input: { id: idea.id, appName: analysis.brief.appName, brief: analysis.brief, profileKey, clipId: clip.id, uploadId: uploads.get(clip.id)!, creatorId: path === "library" ? selected : undefined, savedCreatorJobId: path === "generate" && index > 0 ? kept[0].id : undefined, prompt: path === "library" ? creator?.sourcePrompt ?? creator?.description ?? "Use the saved library creator." : description, hook: idea.hook, demoCaption: idea.demoCaption, post: idea.post, hookSeconds: 4, demoSeconds: Math.max(1, Math.min(10, (clip.durationMs ?? 10000) / 1000)), clampDemoDuration: true, demoTextPosition: "top", approved: true } };
        });
      }
      for (const item of attempt.current) {
        if (item.submitted) continue;
        if (!mounted.current) return;
        if (!item.uploaded) {
          const clip = clips.find((entry) => entry.id === item.input.clipId);
          if (!clip) throw new Error("Demo clip is no longer available.");
          await uploadStudioDemo(clip, item.input.uploadId!);
          for (const same of attempt.current) if (same.input.uploadId === item.input.uploadId) same.uploaded = true;
        }
        if (!mounted.current) return;
        const job = await startStudioJob(item.input); item.submitted = true;
        if (mounted.current) setJobs((values) => values.filter((value) => value.id !== job.id).concat(job));
      }
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : "Couldn’t start these videos."); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  const tags = [...new Set(catalog?.creators.flatMap(creatorTagValues) ?? [])];
  const visibleCreators = (catalog?.creators ?? []).filter((entry) => matchesCreator(entry, query) && (!tag || creatorTagValues(entry).includes(tag)));
  const selectedVisible = visibleCreators.some((entry) => entry.id === selected);
  function filterCreators(nextQuery: string, nextTag: string) { setQuery(nextQuery); setTag(nextTag); setSelected(""); invalidate(); }
  const currentIdea = ideas.find((idea) => !decisions[idea.id]);
  const currentIndex = currentIdea ? ideas.indexOf(currentIdea) : ideas.length;
  const creatorReady = path === "library" ? selectedVisible : description.trim().length >= 10;
  const captionReady = clips.length > 0 && (mode === "agent" || Boolean(hook.trim() && demoCaption.trim()));
  const editIdea = ideas.find((idea) => idea.id === editing);
  const readyJobs = jobs.filter((job) => job.status === "succeeded" && job.videoUrl);
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const producing = busy || jobs.some((job) => !terminal(job));
  async function decideAngle(choice: SwipeChoice) {
    if (!currentIdea || locked) return false;
    const next = { ...decisions, [currentIdea.id]: choice };
    setDecisions(next);
    if (ideas.every((idea) => next[idea.id])) {
      const selectedIdeas = ideas.filter((idea) => next[idea.id] === "keep");
      if (selectedIdeas.length) {
        setStep(3);
        // Pass the final choices explicitly; React state hasn't committed yet.
        void render(selectedIdeas);
      }
    }
    return true;
  }
  const footer = !jobs.length && step === 0 ? <PrimaryButton disabled={locked || !creatorReady} onPress={() => setStep(1)}>{path === "library" ? "Use this creator" : "Continue to captions"}</PrimaryButton>
    : !jobs.length && step === 1 ? <PrimaryButton loading={busy} disabled={locked || !captionReady || (path === "generate" && !approved)} onPress={() => void brainstorm()}>{mode === "manual" ? "Preview my angle" : "Find creative angles"}</PrimaryButton>
    : step === 3 && error && !busy && ideas.length > 0 && !attempt.current?.every((item) => item.submitted) ? <PrimaryButton onPress={() => void render()}>Retry connection (same jobs)</PrimaryButton> : undefined;
  return <StudioStep step={step} title={jobs.length || step === 3 ? readyJobs.length ? "Made for your app" : "Your content is taking shape" : ["Who’s in your video?", "Find the right words", "Which angles feel right?"][step]}
    subtitle={jobs.length || step === 3 ? "Your finished videos are saved to Library." : ["Pick a ready made creator, or describe someone new.", "Your creator. Your app. A fresh point of view.", "Keep or Toss. Your picks produce instantly."][step]}
    navigationDisabled={locked} onBack={step > 0 && step < 3 && !jobs.length ? () => { setStep(step - 1); setApproved(false); } : undefined}
    footer={footer}>
    {!jobs.length && step === 0 ? <>
      <View style={styles.creatorTabs}>{([{ value: "library", label: "Creator library", Icon: Users }, { value: "generate", label: "Describe your creator", Icon: Sparkles }] as const).map(({ value, label, Icon }) => <Pressable key={value} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: path === value }} disabled={locked} onPress={() => { setPath(value); invalidate(); }} style={[styles.creatorTab, { backgroundColor: value === "library" ? "#B5EF53" : "#BCABFF", borderTopRightRadius: value === "library" ? 42 : 18, borderBottomLeftRadius: value === "library" ? 18 : 42 }, path === value && styles.creatorTabSelected]}><Icon size={19} color={colors.ink} /><Text style={styles.tabText}>{label}</Text></Pressable>)}</View>
      {path === "library" ? <>
        <View style={styles.search}><Search size={19} color={colors.muted} /><TextInput accessibilityLabel="Search creator clips" editable={!locked} value={query} onChangeText={(value) => filterCreators(value, tag)} placeholder="Search a mood, setting, or action" placeholderTextColor={colors.muted} style={styles.searchInput} />{query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear creator search" onPress={() => filterCreators("", tag)} style={styles.clearSearch}><X size={18} color={colors.ink} /></Pressable> : null}</View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>{["All", ...tags].map((value) => <Pressable key={value} disabled={locked} onPress={() => filterCreators(query, value === "All" ? "" : value)} accessibilityRole="button" accessibilityLabel={"Filter: " + value} accessibilityState={{ selected: (tag || "All") === value }} style={[styles.filter, (tag || "All") === value && styles.filterSelected]}><Text style={[styles.tagText, (tag || "All") === value && { color: "white" }]}>{value}</Text></Pressable>)}</ScrollView>
        {!catalog ? <PrimaryButton onPress={() => void loadCatalog()}>Load creator library</PrimaryButton> : null}
        <View style={styles.grid}>{visibleCreators.map((entry) => <View key={entry.id} style={styles.tile}>
          <Pressable accessibilityRole="radio" accessibilityLabel={entry.name} accessibilityState={{ checked: selected === entry.id }} disabled={locked} onPress={() => { setSelected(entry.id); invalidate(); }} style={[styles.preview, selected === entry.id && { borderColor: colors.green }]}>
            {entry.previewUrl ? <CreatorPreview key={entry.previewUrl + ":" + (previewAttempts[entry.id] ?? 0)} uri={entry.previewUrl} active={focused} onRetry={() => retryPreview(entry.id)} /> : <View style={styles.unavailable}><Pressable accessibilityRole="button" accessibilityLabel="Retry creator preview" onPress={(event) => { event.stopPropagation(); void retryPreview(entry.id); }} style={styles.retryPreview}><Text style={styles.previewText}>Tap to retry preview</Text></Pressable></View>}
            <View pointerEvents="none" style={[styles.selection, selected === entry.id && { backgroundColor: colors.green, borderColor: colors.green }]}>{selected === entry.id ? <Check size={16} color="white" /> : null}</View>
            <View pointerEvents="none" style={styles.tagsOverlay}>{creatorPreviewTags(entry).map((value) => <View key={value} style={styles.overlayTag}><Text numberOfLines={1} style={styles.overlayTagText}>{value}</Text></View>)}</View>
          </Pressable>
        </View>)}</View>
        {catalog && !visibleCreators.length ? <View style={styles.empty}><Search size={30} color={colors.muted} /><Text accessibilityRole="header" style={s.sectionTitle}>0 available premade clips</Text><Pressable accessibilityRole="button" onPress={() => filterCreators("", "")} style={styles.filter}><Text style={s.copy}>Clear filters</Text></Pressable></View> : null}
      </> : <View style={styles.creatorPrompt}><View style={styles.promptHeading}><View style={styles.iconTile}><Sparkles size={25} color={colors.ink} /></View><Text style={[styles.cardTitle, { flex: 1 }]}>Describe the moment</Text></View><Text style={styles.promptNote}>Their look, reaction, and setting.</Text><TextInput accessibilityLabel="Creator prompt" editable={!locked} value={description} onChangeText={(value) => { setDescription(value); invalidate(); }} multiline maxLength={1500} placeholder="An adult creator in a bright café, smiling at a small discovery. Candid iPhone footage…" placeholderTextColor="#69616E" style={[styles.input, styles.promptInput]} /></View>}
    </> : null}
    {!jobs.length && step === 1 ? <>
      <Pressable accessibilityRole="button" accessibilityLabel="Change creator" disabled={locked} onPress={() => setStep(0)} style={styles.creatorReceipt}><View style={styles.smallCheck}><Check size={14} color="white" /></View><Text style={[styles.choiceTitle, { flex: 1 }]}>{path === "library" ? "Library creator selected" : "Custom creator described"}</Text><ArrowRight size={16} color={colors.ink} /></Pressable>
      <View style={styles.writingModes}>{([{ value: "agent", title: "Write with my agent", Icon: Sparkles }, { value: "manual", title: "Write my own", Icon: Pencil }] as const).map(({ value, title, Icon }) => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={title} accessibilityState={{ checked: mode === value }} disabled={locked} onPress={() => { setMode(value); invalidate(); }} style={[styles.writingMode, mode === value && styles.writingModeSelected]}><Icon size={17} color={mode === value ? "#4930C8" : colors.muted} /><Text style={[styles.tabText, mode === value && { color: "#4930C8" }]}>{title}</Text></Pressable>)}</View>
      {mode === "agent" ? <>
        <View style={{ gap: 16 }}><Text style={styles.cardTitle}>Set the vibe</Text><View style={styles.toneGrid}>{vibes.map(({ title, mark, color }, index) => <Pressable key={title} accessibilityRole="radio" accessibilityLabel={title} aria-checked={tone === title} accessibilityState={{ checked: tone === title }} disabled={locked} onPress={() => { setTone(title); invalidate(); }} style={[styles.toneTile, { backgroundColor: color, borderTopRightRadius: index % 2 ? 18 : 42, borderBottomLeftRadius: index % 2 ? 42 : 18 }, tone === title && styles.toneSelected]}><View style={styles.toneTop}><Text style={styles.toneMark}>{mark}</Text><View style={[styles.toneCheck, tone === title && { backgroundColor: colors.ink }]}>{tone === title ? <Check size={14} color="white" /> : null}</View></View><Text style={styles.toneTitle}>{title}</Text></Pressable>)}</View></View>
      </> : <View style={styles.formCard}>{[{ label: "Hook caption", value: hook, set: setHook }, { label: "Demo caption", value: demoCaption, set: setDemoCaption }].map((field) => <View key={field.label} style={{ gap: 8 }}><Text style={styles.eyebrow}>{field.label.toUpperCase()}</Text><TextInput accessibilityLabel={field.label} placeholder={field.label === "Hook caption" ? "me finally finding a better way…" : "here’s how i actually use it"} placeholderTextColor={colors.muted} editable={!locked} value={field.value} multiline maxLength={180} onChangeText={(value) => { field.set(value); invalidate(); }} style={[styles.input, { minHeight: 90 }]} /></View>)}</View>}
      {!clips.length ? <Pressable accessibilityRole="button" onPress={() => router.push("/(main)/your-app")} style={styles.contextStrip}><Text style={s.small}>Add demo clips in Your App to continue</Text><ArrowRight size={16} color={colors.muted} /></Pressable> : null}
      {path === "generate" ? <Pressable disabled={locked} accessibilityRole="checkbox" accessibilityLabel="Approve paid generation" accessibilityState={{ checked: approved }} onPress={() => setApproved(!approved)} style={[styles.approval, approved && styles.choiceSelected]}><View style={[styles.checkbox, approved && { backgroundColor: colors.ink }]}>{approved ? <Check size={16} color="white" /> : null}</View><View style={{ flex: 1, gap: 4 }}><Text style={styles.choiceTitle}>Approve one paid creator clip</Text><Text style={styles.choiceNote}>After your last swipe, Higgsfield generates one shared clip for your kept angles. Toss all to generate nothing.</Text></View></Pressable> : null}
    </> : null}
    {!jobs.length && step === 2 ? <>
      {currentIdea ? <>
        <SwipeDecisionCard key={currentIdea.id} disabled={locked || Boolean(editing)} keepLabel="Keep angle" tossLabel="Toss" keepAccessibilityLabel={"Keep angle " + (currentIndex + 1)} tossAccessibilityLabel={"Toss angle " + (currentIndex + 1)} onDecision={decideAngle}>
          <View style={[styles.angleCard, { backgroundColor: angleColors[currentIndex % angleColors.length] }]}><View style={styles.angleTop}><AngleTags idea={currentIdea} fallbackTone={tone} /><Pressable accessibilityRole="button" accessibilityLabel={"Edit angle " + (currentIndex + 1)} onPress={() => setEditing(currentIdea.id)} style={styles.editButton}><Pencil size={18} color={colors.ink} /></Pressable></View>
            <View style={styles.hookTile}><Text style={[styles.eyebrow, { color: colors.ink }]}>01 / CREATOR HOOK</Text><Text style={styles.hookText}>{currentIdea.hook}</Text></View>
            <View style={styles.demoTile}><Text style={[styles.eyebrow, styles.whiteText]}>02 / APP IN ACTION</Text><Text style={styles.demoText}>{currentIdea.demoCaption}</Text></View>
          </View>
        </SwipeDecisionCard>
      </> : <View style={styles.formCard}><Text style={styles.cardTitle}>Not the right fit? No problem.</Text><Text style={s.copy}>Review these again or try a different direction.</Text><PrimaryButton onPress={() => { invalidate(); setStep(1); }}>Try a different direction</PrimaryButton><Pressable accessibilityRole="button" onPress={() => setDecisions({})} style={styles.textButton}><Text style={s.copy}>Review angles again</Text></Pressable></View>}
    </> : null}
    {step === 3 && producing && !readyJobs.length ? <ContentMakingLoader /> : null}
    {readyJobs.length ? <VideoVariationPager videos={readyJobs.map((job) => ({ id: job.id, jobId: job.id, url: job.videoUrl!, post: job.post, hook: job.input.hook }))} onEditCaptions={(id) => router.push({ pathname: "/(main)/studio", params: { reuseJobId: id } })} /> : null}
    {readyJobs.length > 0 && producing ? <Text accessibilityLiveRegion="polite" style={s.small}>Finishing the rest of your variations…</Text> : null}
    {failedJobs.length ? <View style={{ gap: 12 }}><Text accessibilityRole="alert" style={styles.error}>{failedJobs.length === 1 ? "One video couldn’t finish." : "Some videos couldn’t finish."} Your other videos are safe.</Text>{failedJobs.filter((job) => job.canReuse).map((job, index) => <Pressable key={job.id} accessibilityRole="button" onPress={() => router.push({ pathname: "/(main)/studio", params: { reuseJobId: job.id } })} style={styles.textButton}><Text style={s.copy}>Retry unfinished variation {index + 1} with saved footage →</Text></Pressable>)}</View> : null}
    {jobs.length > 0 && jobs.every(terminal) && (!attempt.current || attempt.current.every((item) => item.submitted)) ? <PrimaryButton onPress={() => { attempt.current = null; setJobs([]); invalidate(); setStep(0); setError(""); }}>Create something new</PrimaryButton> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Modal visible={Boolean(editIdea)} transparent animationType="slide" onRequestClose={() => setEditing(null)}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}><View style={styles.modalSheet}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16 }}><Text style={styles.cardTitle}>Make the words yours</Text>{editIdea ? (["hook", "demoCaption"] as const).map((field) => <View key={field} style={{ gap: 8 }}><Text style={styles.eyebrow}>{field === "hook" ? "CREATOR HOOK" : "APP DEMO"}</Text><TextInput accessibilityLabel={field === "hook" ? "Angle hook caption" : "Angle demo caption"} multiline maxLength={180} value={editIdea[field]} onChangeText={(value) => setIdeas((items) => items.map((idea) => idea.id === editing ? { ...idea, [field]: value } : idea))} style={[styles.input, { minHeight: 100 }]} /></View>) : null}<PrimaryButton disabled={!editIdea?.hook.trim() || !editIdea?.demoCaption.trim()} onPress={() => setEditing(null)}>Done editing</PrimaryButton></ScrollView></View></KeyboardAvoidingView></Modal>
  </StudioStep>;
}
const styles = StyleSheet.create({
  creatorTabs: { flexDirection: "row", gap: 12 },
  creatorTab: { flex: 1, minHeight: 106, padding: 14, borderRadius: 18, borderWidth: 2, borderColor: "transparent", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  creatorTabSelected: { borderColor: colors.ink }, tabText: { fontFamily: fonts.heading, fontSize: 12, lineHeight: 17, textAlign: "center", color: colors.ink }, whiteText: { color: "white" },
  choiceSelected: { backgroundColor: "#D6F697", borderColor: colors.green },
  choiceTitle: { fontFamily: fonts.heading, fontSize: 14, lineHeight: 20, color: colors.ink }, choiceNote: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  search: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderRadius: 28, borderWidth: 1.5, borderColor: "#D4D5D0", paddingLeft: 16, paddingRight: 6 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 54, fontSize: 14, color: colors.ink }, clearSearch: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  filterSelected: { backgroundColor: "#4930C8" }, eyebrow: { color: colors.ink, fontSize: 10, letterSpacing: 1.1, fontWeight: "700", lineHeight: 16 },
  formCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 20, borderRadius: 26, gap: 16 },
  iconTile: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#FFE044", alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 27, color: colors.ink },
  creatorPrompt: { backgroundColor: "#BCABFF", padding: 22, borderRadius: 28, borderTopRightRadius: 8, gap: 18 }, promptHeading: { flexDirection: "row", alignItems: "center", gap: 14 }, promptNote: { color: "#383047", fontSize: 12, lineHeight: 19 },
  promptInput: { minHeight: 180, backgroundColor: "#FFFFFFCC", color: colors.ink, borderRadius: 12 },
  creatorReceipt: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#D9DBD3" },
  writingModes: { flexDirection: "row", gap: 16 }, writingMode: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 56, borderBottomWidth: 3, borderBottomColor: "transparent", flexWrap: "wrap", paddingVertical: 8 }, writingModeSelected: { borderBottomColor: "#4930C8" },
  contextStrip: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingLeft: 16, borderLeftWidth: 3, borderLeftColor: "#4930C8", flexWrap: "wrap" },
  toneGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: "4%", rowGap: 12 }, toneTile: { width: "48%", minHeight: 135, padding: 16, borderWidth: 2, borderColor: "transparent", borderRadius: 18, justifyContent: "space-between", gap: 14 }, toneSelected: { borderColor: colors.ink },
  toneTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, toneMark: { fontSize: 29, lineHeight: 35, color: colors.ink, fontWeight: "600" }, toneCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: "#33333355", alignItems: "center", justifyContent: "center" }, toneTitle: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 22, color: colors.ink },
  angleCard: { borderRadius: 28, overflow: "hidden", minHeight: 410 }, angleTop: { padding: 20, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  angleTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, flexShrink: 1 }, audiencePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, backgroundColor: "#25282B", maxWidth: "100%" }, audienceText: { color: "white", fontSize: 11, lineHeight: 15, flexShrink: 1, fontWeight: "600" }, vibePill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, backgroundColor: "#FFFFFF99", maxWidth: "100%" }, vibeText: { color: colors.ink, fontSize: 11, lineHeight: 15, fontWeight: "600" },
  editButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "#FFFFFF99" },
  hookTile: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 32, gap: 18, flexGrow: 1, minHeight: 175 }, hookText: { fontFamily: fonts.heading, fontSize: 29, lineHeight: 37, color: colors.ink, letterSpacing: -0.6 },
  demoTile: { padding: 24, backgroundColor: "#25282B", gap: 16, minHeight: 145 }, demoText: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 28, color: "white" },
  textButton: { minHeight: 44, justifyContent: "center", alignItems: "center" }, smallCheck: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#25282B", alignItems: "center", justifyContent: "center" },
  approval: { flexDirection: "row", alignItems: "center", gap: 12, padding: 18, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: colors.ink, alignItems: "center", justifyContent: "center" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" }, modalSheet: { maxHeight: "85%", padding: 24, paddingBottom: 36, backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  input: { borderRadius: 16, backgroundColor: colors.canvas, padding: 14, minHeight: 50, fontSize: 15, lineHeight: 22, color: colors.ink, textAlignVertical: "top" },
  grid: { flexDirection: "row", flexWrap: "wrap", columnGap: "4%", rowGap: 18 },
  tile: { width: "48%", gap: 8 },
  preview: { width: "100%", aspectRatio: 9 / 16, borderRadius: 20, overflow: "hidden", backgroundColor: "#232821", borderWidth: 2, borderColor: "transparent" },
  unavailable: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center", padding: 12 },
  retryPreview: { minHeight: 44, justifyContent: "center", paddingHorizontal: 10, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.65)" },
  previewText: { fontSize: 12, color: "#FFFFFFB0", textAlign: "center" },
  selection: { position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: "#FFFFFFB0", backgroundColor: "#00000035", alignItems: "center", justifyContent: "center" },
  tagsOverlay: { position: "absolute", bottom: 9, left: 8, right: 8, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  overlayTag: { maxWidth: "100%", borderRadius: 20, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: "rgba(0,0,0,0.58)" },
  overlayTagText: { color: "white", fontSize: 10, lineHeight: 13 },
  tagText: { color: colors.ink, fontSize: 11, lineHeight: 15 },
  filter: { justifyContent: "center", paddingHorizontal: 13, minHeight: 36, borderRadius: 20, backgroundColor: colors.surface },
  empty: { paddingVertical: 36, alignItems: "center", gap: 16 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 20 },
});
